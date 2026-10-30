import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { workDateOf } from '../../lib/time';
import { notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { notify } from '../notifications/notifications.service';

/*
 * The supervisor's review desk: everything a technician submits with a photo (check-in, check-out, finished
 * jobs) waits here to be approved or sent back, and the activity timeline shows a person's whole day.
 */
export const approvalsRouter = Router();

const DAY_MS = 86_400_000;
const photo = { select: { id: true, flags: true, lat: true, lng: true, accuracyM: true, receivedAt: true, deviceTime: true, purpose: true } } as const;
const person = { select: { id: true, name: true, staffNo: true, phone: true } } as const;
const reviewer = { select: { id: true, name: true } } as const;
const statusQuery = z.object({ status: z.enum(['PENDING', 'DONE']).default('PENDING') });
const flagged = (...photos: ({ flags: string[] } | null | undefined)[]) => photos.some((p) => (p?.flags.length ?? 0) > 0);

/** How much is waiting in each queue. */
approvalsRouter.get(
  '/summary',
  ah(async (_req, res) => {
    const [checkIns, checkOuts, jobs] = await Promise.all([
      prisma.attendance.findMany({ where: { dressReview: 'PENDING' }, select: { checkInPhoto: { select: { flags: true } } } }),
      prisma.attendance.findMany({ where: { checkOutReview: 'PENDING' }, select: { checkOutPhoto: { select: { flags: true } } } }),
      prisma.task.findMany({ where: { status: 'COMPLETED' }, select: { startPhoto: { select: { flags: true } }, endPhoto: { select: { flags: true } } } }),
    ]);
    res.json({
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      jobs: jobs.length,
      total: checkIns.length + checkOuts.length + jobs.length,
      flagged: checkIns.filter((r) => flagged(r.checkInPhoto)).length + checkOuts.filter((r) => flagged(r.checkOutPhoto)).length + jobs.filter((t) => flagged(t.startPhoto, t.endPhoto)).length,
    });
  }),
);

approvalsRouter.get(
  '/check-ins',
  ah(async (req, res) => {
    const { status } = parse(statusQuery, req.query);
    const records = await prisma.attendance.findMany({
      where: status === 'PENDING' ? { dressReview: 'PENDING' } : { dressReview: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: status === 'PENDING' ? { checkInAt: 'asc' } : { reviewedAt: 'desc' },
      take: status === 'PENDING' ? 200 : 50,
      include: { user: person, checkInPhoto: photo, reviewedBy: reviewer },
    });
    res.json({ records });
  }),
);

approvalsRouter.get(
  '/check-outs',
  ah(async (req, res) => {
    const { status } = parse(statusQuery, req.query);
    const records = await prisma.attendance.findMany({
      where: status === 'PENDING' ? { checkOutReview: 'PENDING' } : { checkOutReview: { in: ['APPROVED', 'REJECTED'] } },
      orderBy: status === 'PENDING' ? { checkOutAt: 'asc' } : { checkOutReviewedAt: 'desc' },
      take: status === 'PENDING' ? 200 : 50,
      include: { user: person, checkInPhoto: photo, checkOutPhoto: photo },
    });
    const reviewers = await prisma.user.findMany({ where: { id: { in: records.map((r) => r.checkOutReviewedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    res.json({ records: records.map((r) => ({ ...r, checkOutReviewedBy: reviewers.find((u) => u.id === r.checkOutReviewedById) ?? null })) });
  }),
);

approvalsRouter.get(
  '/jobs',
  ah(async (req, res) => {
    const { status } = parse(statusQuery, req.query);
    const tasks = await prisma.task.findMany({
      where: status === 'PENDING' ? { status: 'COMPLETED' } : { status: { in: ['VERIFIED', 'REJECTED'] }, verifiedAt: { not: null } },
      orderBy: status === 'PENDING' ? { endedAt: 'asc' } : { verifiedAt: 'desc' },
      take: status === 'PENDING' ? 200 : 50,
      include: {
        assignee: person,
        verifiedBy: reviewer,
        startPhoto: photo,
        endPhoto: photo,
        materials: { include: { item: { select: { name: true, unit: true } }, unit: { select: { serialNumber: true } } } },
      },
    });
    // The signature itself is big; the list only needs to know it is there
    res.json({ tasks: tasks.map(({ customerSignature, ...t }) => ({ ...t, signed: !!customerSignature })) });
  }),
);

const bulkSchema = z.object({
  items: z.array(z.object({ kind: z.enum(['CHECK_IN', 'CHECK_OUT', 'JOB']), id: z.string().min(1) })).min(1).max(100),
});

/** Approve many at once (the clean ones). Rejections always go one by one, with a reason. */
approvalsRouter.post(
  '/bulk-approve',
  ah(async (req, res) => {
    const { items } = parse(bulkSchema, req.body);
    const actor = me(req);
    const now = new Date();
    let approved = 0;
    const verifiedJobs: { id: string; code: string; title: string; assigneeId: string; team: { members: { userId: string }[] } | null }[] = [];
    for (const item of items) {
      if (item.kind === 'CHECK_IN') {
        const r = await prisma.attendance.updateMany({ where: { id: item.id, dressReview: 'PENDING' }, data: { dressReview: 'APPROVED', reviewedById: actor.id, reviewedAt: now } });
        approved += r.count;
      } else if (item.kind === 'CHECK_OUT') {
        const r = await prisma.attendance.updateMany({ where: { id: item.id, checkOutReview: 'PENDING' }, data: { checkOutReview: 'APPROVED', checkOutReviewedById: actor.id, checkOutReviewedAt: now } });
        approved += r.count;
      } else {
        const task = await prisma.task.findFirst({ where: { id: item.id, status: 'COMPLETED' }, select: { id: true, code: true, title: true, assigneeId: true, team: { select: { members: { select: { userId: true } } } } } });
        if (!task) continue;
        await prisma.task.update({ where: { id: task.id }, data: { status: 'VERIFIED', verifiedById: actor.id, verifiedAt: now } });
        verifiedJobs.push(task);
        approved += 1;
      }
    }
    for (const t of verifiedJobs) {
      // The whole team hears the job was approved
      const crew = [...new Set([t.assigneeId, ...(t.team?.members.map((m) => m.userId) ?? [])])];
      void notify(crew, { type: 'TASK_VERIFIED', title: `${t.code} verified ✔`, body: t.title, data: { taskId: t.id } });
    }
    if (approved) await audit(actor.id, 'BULK_APPROVED', 'Approvals', null, `Approved ${approved} item(s) at once`, { items });
    res.json({ approved, skipped: items.length - approved });
  }),
);

/** Everything one person did on one day, in order, with the photos. */
approvalsRouter.get(
  '/activity',
  ah(async (req, res) => {
    const q = parse(z.object({ userId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query);
    const user = await prisma.user.findUnique({ where: { id: q.userId }, select: { id: true, name: true, staffNo: true, role: true, phone: true } });
    if (!user) throw notFound('Person');
    const workDate = q.date ? workDateOf(new Date(`${q.date}T12:00:00Z`)) : workDateOf();
    const from = new Date(workDate.getTime() - env.TZ_OFFSET_MINUTES * 60_000);
    const to = new Date(from.getTime() + DAY_MS);
    const inDay = { gte: from, lt: to };

    const [attendance, tasks, movements] = await Promise.all([
      prisma.attendance.findUnique({ where: { userId_workDate: { userId: user.id, workDate } }, include: { checkInPhoto: photo, checkOutPhoto: photo } }),
      prisma.task.findMany({
        where: { assigneeId: user.id, OR: [{ startedAt: inDay }, { endedAt: inDay }, { verifiedAt: inDay }] },
        include: { startPhoto: photo, endPhoto: photo, verifiedBy: reviewer },
      }),
      prisma.stockMovement.findMany({
        where: { createdAt: inDay, OR: [{ actorId: user.id }, { toUserId: user.id }, { fromUserId: user.id }] },
        include: { item: { select: { name: true, unit: true } }, unit: { select: { serialNumber: true } }, task: { select: { id: true, code: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    type Event = { at: Date; kind: string; title: string; detail?: string; photo?: unknown; status?: string | null; note?: string | null; taskId?: string; attendanceId?: string };
    const events: Event[] = [];
    if (attendance) {
      events.push({ at: attendance.checkInAt, kind: 'CHECK_IN', title: attendance.status === 'LATE' ? 'Checked in late' : 'Checked in', photo: attendance.checkInPhoto, status: attendance.dressReview, note: attendance.reviewNote, attendanceId: attendance.id });
      if (attendance.checkOutAt) {
        events.push({ at: attendance.checkOutAt, kind: 'CHECK_OUT', title: 'Checked out', detail: attendance.workedMinutes != null ? `${Math.floor(attendance.workedMinutes / 60)} h ${attendance.workedMinutes % 60} min worked` : undefined, photo: attendance.checkOutPhoto, status: attendance.checkOutReview, note: attendance.checkOutNote, attendanceId: attendance.id });
      }
    }
    for (const t of tasks) {
      if (t.startedAt && t.startedAt >= from && t.startedAt < to) events.push({ at: t.startedAt, kind: 'JOB_START', title: `Started ${t.code}`, detail: `${t.title} · ${t.customerName} · ${t.address}`, photo: t.startPhoto, taskId: t.id });
      if (t.endedAt && t.endedAt >= from && t.endedAt < to) {
        events.push({ at: t.endedAt, kind: 'JOB_END', title: `Completed ${t.code}`, detail: `${t.durationMinutes ?? 0} min${t.amountCollected ? ` · KES ${t.amountCollected.toLocaleString('en-KE')} collected` : ''}`, photo: t.endPhoto, status: t.status, note: t.verificationNote, taskId: t.id });
      }
      if (t.verifiedAt && t.verifiedAt >= from && t.verifiedAt < to && (t.status === 'VERIFIED' || t.status === 'REJECTED')) {
        events.push({ at: t.verifiedAt, kind: t.status === 'VERIFIED' ? 'JOB_VERIFIED' : 'JOB_REJECTED', title: `${t.code} ${t.status === 'VERIFIED' ? 'verified' : 'sent back'}${t.verifiedBy ? ` by ${t.verifiedBy.name}` : ''}`, note: t.verificationNote, taskId: t.id });
      }
    }
    const MOVE: Record<string, string> = { ISSUE: 'Stock issued', ACCEPT: 'Accepted stock', RETURN: 'Returned stock', CONSUME: 'Used materials', INSTALL: 'Installed a device', REPORT_LOST: 'Reported a device lost', REPORT_FAULTY: 'Reported a device faulty', RECEIVE: 'Received stock', ADJUST: 'Stock adjusted' };
    for (const m of movements) {
      events.push({ at: m.createdAt, kind: `STOCK_${m.type}`, title: MOVE[m.type] ?? m.type, detail: `${m.unit ? `${m.item.name} · S/N ${m.unit.serialNumber}` : `${m.quantity} ${m.item.unit ?? ''} ${m.item.name}`}${m.task ? ` · ${m.task.code}` : ''}`, taskId: m.task?.id });
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    const jobsDone = tasks.filter((t) => t.endedAt && t.endedAt >= from && t.endedAt < to).length;
    const photos = events.filter((e) => e.photo).length;
    const flags = events.filter((e) => (e.photo as { flags?: string[] } | undefined)?.flags?.length).length;
    res.json({ user, date: workDate.toISOString().slice(0, 10), summary: { jobsDone, minutesWorked: attendance?.workedMinutes ?? null, photos, flags, checkedIn: !!attendance }, events });
  }),
);
