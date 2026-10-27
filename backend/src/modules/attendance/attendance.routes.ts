import { Router } from 'express';
import { z } from 'zod';
import { ReviewStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, notFound } from '../../lib/http-error';
import { audit } from '../../lib/audit';
import { minutesBetween, shiftStartFor, workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { consumePhoto, eventTime } from '../capture/capture.service';
import { notify, notifyRoles } from '../notifications/notifications.service';
import { time as fmtTime } from '../../lib/time';

export const attendanceRouter = Router();

const photoSelect = { select: { id: true, flags: true, lat: true, lng: true, accuracyM: true, receivedAt: true, deviceTime: true } } as const;

/** What a technician is still responsible for — shown at check-out so nothing goes unaccounted. */
async function custodySummary(userId: string) {
  const [units, bulk, openTasks] = await Promise.all([
    prisma.serialUnit.findMany({
      where: { holderId: userId, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } },
      select: { serialNumber: true, status: true, heldSince: true, item: { select: { name: true } } },
    }),
    prisma.bulkHolding.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: { quantity: true, item: { select: { name: true, unit: true } } },
    }),
    prisma.task.count({ where: { assigneeId: userId, status: 'IN_PROGRESS' } }),
  ]);
  return {
    units: units.map((u) => ({ serialNumber: u.serialNumber, name: u.item.name, status: u.status, heldSince: u.heldSince })),
    bulk: bulk.map((b) => ({ name: b.item.name, unit: b.item.unit, quantity: b.quantity })),
    tasksInProgress: openTasks,
  };
}

attendanceRouter.get(
  '/today',
  ah(async (req, res) => {
    const userId = me(req).id;
    const workDate = workDateOf();
    const record = await prisma.attendance.findUnique({
      where: { userId_workDate: { userId, workDate } },
      include: { checkInPhoto: photoSelect, checkOutPhoto: photoSelect },
    });
    res.json({
      workDate,
      shiftStart: shiftStartFor(workDate),
      graceMinutes: env.LATE_GRACE_MINUTES,
      record,
      custody: await custodySummary(userId),
    });
  }),
);

const checklist = z.object({
  uniform: z.literal(true, { error: 'Confirm you are in full company uniform' }),
  idBadge: z.literal(true, { error: 'Confirm you are wearing your staff ID' }),
  safetyBoots: z.literal(true, { error: 'Confirm you are wearing safety boots' }),
  groomed: z.literal(true, { error: 'Confirm you are neat and well groomed' }),
});

const checkInSchema = z.object({ photoId: z.string().min(1), checklist });

attendanceRouter.post(
  '/check-in',
  ah(async (req, res) => {
    const userId = me(req).id;
    const body = parse(checkInSchema, req.body);
    const now = await eventTime(body.photoId);
    const workDate = workDateOf(now);

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({ where: { userId_workDate: { userId, workDate } } });
      if (existing) throw conflict('You have already checked in today', 'ALREADY_CHECKED_IN');
      await consumePhoto(tx, body.photoId, userId, 'CHECK_IN');
      const lateAfter = shiftStartFor(workDate).getTime() + env.LATE_GRACE_MINUTES * 60_000;
      return tx.attendance.create({
        data: {
          userId,
          workDate,
          checkInAt: now,
          checkInPhotoId: body.photoId,
          status: now.getTime() > lateAfter ? 'LATE' : 'PRESENT',
          dressChecklist: body.checklist,
        },
        include: { checkInPhoto: photoSelect },
      });
    });
    const who = me(req).name;
    if (record.status === 'LATE') {
      void notifyRoles(['SUPERVISOR', 'ADMIN'], { type: 'LATE_CHECK_IN', title: `${who} checked in late`, body: `Checked in at ${fmtTime(record.checkInAt)}`, data: { attendanceId: record.id } });
    }
    const flags = record.checkInPhoto.flags.filter((f) => f === 'OUTSIDE_GEOFENCE' || f === 'NO_LOCATION');
    if (flags.length) {
      void notifyRoles(['SUPERVISOR', 'ADMIN'], {
        type: 'PHOTO_FLAGGED',
        title: `Check-in flagged — ${who}`,
        body: flags.includes('OUTSIDE_GEOFENCE') ? 'Checked in away from the office.' : 'Checked in without GPS location.',
        data: { attendanceId: record.id },
      });
    }
    res.status(201).json({ record });
  }),
);

attendanceRouter.post(
  '/check-out',
  ah(async (req, res) => {
    const userId = me(req).id;
    const { photoId } = parse(z.object({ photoId: z.string().min(1) }), req.body);
    const now = await eventTime(photoId);
    const workDate = workDateOf(now);

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({ where: { userId_workDate: { userId, workDate } } });
      if (!existing) throw conflict('You have not checked in today', 'NOT_CHECKED_IN');
      if (existing.checkOutAt) throw conflict('You have already checked out today', 'ALREADY_CHECKED_OUT');
      await consumePhoto(tx, photoId, userId, 'CHECK_OUT');
      return tx.attendance.update({
        where: { id: existing.id },
        data: { checkOutAt: now, checkOutPhotoId: photoId, workedMinutes: minutesBetween(existing.checkInAt, now), checkOutReview: 'PENDING' },
        include: { checkInPhoto: photoSelect, checkOutPhoto: photoSelect },
      });
    });
    res.json({ record, custody: await custodySummary(userId) });
  }),
);

attendanceRouter.get(
  '/history',
  ah(async (req, res) => {
    const records = await prisma.attendance.findMany({
      where: { userId: me(req).id },
      orderBy: { workDate: 'desc' },
      take: 60,
    });
    res.json({ records });
  }),
);

/** Daily register for supervisors: everyone who checked in, plus who is absent. */
attendanceRouter.get(
  '/',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const date = typeof req.query.date === 'string' ? workDateOf(new Date(`${req.query.date}T12:00:00Z`)) : workDateOf();
    const [records, staff] = await Promise.all([
      prisma.attendance.findMany({
        where: { workDate: date },
        orderBy: { checkInAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, staffNo: true, role: true } },
          checkInPhoto: photoSelect,
          checkOutPhoto: photoSelect,
        },
      }),
      prisma.user.findMany({
        where: { active: true, role: { in: ['TECHNICIAN', 'STOREKEEPER'] } },
        select: { id: true, name: true, staffNo: true, role: true },
      }),
    ]);
    const present = new Set(records.map((r) => r.userId));
    res.json({ workDate: date, records, absent: staff.filter((s) => !present.has(s.id)) });
  }),
);

attendanceRouter.get(
  '/reviews/pending',
  requireRole(ROLES.MANAGERS),
  ah(async (_req, res) => {
    const records = await prisma.attendance.findMany({
      where: { dressReview: 'PENDING' },
      orderBy: { checkInAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true, staffNo: true } }, checkInPhoto: photoSelect },
    });
    res.json({ records });
  }),
);

const reviewSchema = z.object({
  decision: z.enum([ReviewStatus.APPROVED, ReviewStatus.REJECTED]),
  note: z.string().trim().max(500).optional(),
});

attendanceRouter.post(
  '/:id/review',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const body = parse(reviewSchema, req.body);
    const existing = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Attendance record');
    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { dressReview: body.decision, reviewNote: body.note, reviewedById: me(req).id, reviewedAt: new Date() },
    });
    await audit(me(req).id, `CHECK_IN_${body.decision}`, 'Attendance', record.id, `${body.decision === 'APPROVED' ? 'Approved' : 'Rejected'} a check-in photo${body.note ? `: ${body.note}` : ''}`);
    if (body.decision === 'REJECTED') {
      void notify([record.userId], {
        type: 'DRESS_REJECTED',
        title: 'Dress code not met',
        body: body.note ?? 'Your check-in photo did not meet the company dress code. See your supervisor.',
        data: { attendanceId: record.id },
      });
    }
    res.json({ record });
  }),
);

/** A supervisor approves or rejects the check-out photo (a rejection needs a reason, which the person is told). */
attendanceRouter.post(
  '/:id/review-checkout',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const body = parse(reviewSchema, req.body);
    if (body.decision === 'REJECTED' && !body.note) throw badRequest('Give a reason when rejecting a check-out');
    const existing = await prisma.attendance.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Attendance record');
    if (!existing.checkOutAt) throw conflict('This person has not checked out yet', 'NOT_CHECKED_OUT');
    const record = await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOutReview: body.decision, checkOutNote: body.note, checkOutReviewedById: me(req).id, checkOutReviewedAt: new Date() },
    });
    await audit(me(req).id, `CHECK_OUT_${body.decision}`, 'Attendance', record.id, `${body.decision === 'APPROVED' ? 'Approved' : 'Rejected'} a check-out photo${body.note ? `: ${body.note}` : ''}`);
    if (body.decision === 'REJECTED') {
      void notify([record.userId], {
        type: 'CHECKOUT_REJECTED',
        title: 'Check-out not accepted',
        body: body.note ?? 'Your supervisor did not accept your check-out photo.',
        data: { attendanceId: record.id },
      });
    }
    res.json({ record });
  }),
);
