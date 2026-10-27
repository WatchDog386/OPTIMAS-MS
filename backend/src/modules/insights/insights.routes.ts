import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { positionsOf } from '../location/location.service';
import { workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';

/**
 * Manager insights: leaderboard, live map, charts and customer ratings.
 * Everything is computed from the existing tasks, attendance, photos (GPS) and stock ledger.
 */
export const insightsRouter = Router();
const DAY_MS = 86_400_000;
const dayKey = (d: Date) => workDateOf(d).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const DONE = ['COMPLETED', 'VERIFIED'] as const;

/** The last `days` calendar days (company time), oldest first. */
function lastDays(days: number) {
  return Array.from({ length: days }, (_, i) => dayKey(new Date(Date.now() - (days - 1 - i) * DAY_MS)));
}

insightsRouter.get(
  '/leaderboard',
  ah(async (req, res) => {
    const range = req.query.range === 'month' ? 'month' : 'week';
    const days = range === 'month' ? 30 : 7;
    const from = new Date(Date.now() - days * DAY_MS);

    const [staff, tasks, attendance] = await Promise.all([
      prisma.user.findMany({ where: { active: true, role: 'TECHNICIAN' }, select: { id: true, name: true, staffNo: true, region: true } }),
      prisma.task.findMany({
        where: { status: { in: [...DONE] }, endedAt: { gte: from } },
        select: { assigneeId: true, durationMinutes: true, customerRating: true, dueAt: true, endedAt: true },
      }),
      prisma.attendance.findMany({ where: { workDate: { gte: workDateOf(from) } }, select: { userId: true, status: true } }),
    ]);

    const leaders = staff.map((u) => {
      const mine = tasks.filter((t) => t.assigneeId === u.id);
      const rated = mine.filter((t) => t.customerRating != null);
      const timed = mine.filter((t) => t.durationMinutes != null);
      const days_ = attendance.filter((a) => a.userId === u.id);
      const late = days_.filter((a) => a.status === 'LATE').length;
      const onTime = mine.filter((t) => t.dueAt && t.endedAt);
      const rating = rated.length ? round1(rated.reduce((n, t) => n + (t.customerRating ?? 0), 0) / rated.length) : null;
      const score = Math.max(0, Math.round(mine.length * 10 + (rating ?? 0) * 8 + days_.length * 2 - late * 3));
      return {
        user: u,
        jobs: mine.length,
        avgMinutes: timed.length ? Math.round(timed.reduce((n, t) => n + (t.durationMinutes ?? 0), 0) / timed.length) : 0,
        rating: { average: rating, count: rated.length },
        daysPresent: days_.length,
        lateDays: late,
        onTimeRate: onTime.length ? Math.round((onTime.filter((t) => t.endedAt! <= t.dueAt!).length / onTime.length) * 100) : null,
        score,
      };
    });
    leaders.sort((a, b) => b.score - a.score || b.jobs - a.jobs);
    res.json({ range, days, from: from.toISOString(), leaders: leaders.map((l, i) => ({ rank: i + 1, ...l })) });
  }),
);

insightsRouter.get(
  '/map',
  ah(async (_req, res) => {
    const today = workDateOf();
    const [staff, attendance, open, requests] = await Promise.all([
      prisma.user.findMany({ where: { active: true, role: 'TECHNICIAN' }, select: { id: true, name: true, staffNo: true, phone: true } }),
      prisma.attendance.findMany({ where: { workDate: today }, select: { userId: true, checkOutAt: true } }),
      prisma.task.findMany({
        where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        select: { id: true, code: true, title: true, status: true, priority: true, address: true, lat: true, lng: true, assigneeId: true, customerName: true, assignee: { select: { name: true } } },
      }),
      // Customer requests nobody has scheduled yet, with where the customer is
      prisma.serviceRequest.findMany({
        where: { status: 'OPEN' },
        select: { id: true, type: true, description: true, address: true, lat: true, lng: true, createdAt: true, customer: { select: { name: true, lastLat: true, lastLng: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);
    // Live phone position, or today's newest GPS-stamped photo
    const where = await positionsOf(staff.map((u) => u.id));

    const people = staff.map((u) => {
      const att = attendance.find((a) => a.userId === u.id);
      const task = open.find((t) => t.assigneeId === u.id && t.status === 'IN_PROGRESS');
      const pos = where.get(u.id);
      const state = !att || att.checkOutAt ? 'OFFLINE' : task ? 'ON_JOB' : 'AVAILABLE';
      return {
        user: u,
        state,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        heading: pos?.heading ?? null,
        seenAt: pos?.at ?? null,
        live: pos?.kind === 'live',
        currentTask: task ? { id: task.id, code: task.code, title: task.title } : null,
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      staff: people,
      jobs: open.map(({ assignee, ...t }) => ({ ...t, assigneeName: assignee.name })),
      requests: requests.map(({ customer, ...r }) => ({ ...r, lat: r.lat ?? customer.lastLat, lng: r.lng ?? customer.lastLng, customerName: customer.name })),
    });
  }),
);

insightsRouter.get(
  '/charts',
  ah(async (req, res) => {
    const days = Math.min(30, Math.max(7, Number(req.query.days) || 14));
    const keys = lastDays(days);
    const from = new Date(Date.now() - days * DAY_MS);

    const [created, done, attendance, movements] = await Promise.all([
      prisma.task.findMany({ where: { createdAt: { gte: from } }, select: { createdAt: true, type: true } }),
      prisma.task.findMany({ where: { status: { in: [...DONE] }, endedAt: { gte: from } }, select: { endedAt: true, type: true, amountCollected: true } }),
      prisma.attendance.findMany({ where: { workDate: { gte: workDateOf(from) } }, select: { workDate: true, status: true } }),
      prisma.stockMovement.findMany({ where: { createdAt: { gte: from }, type: { in: ['ISSUE', 'RETURN', 'INSTALL', 'CONSUME'] } }, select: { createdAt: true, type: true, quantity: true } }),
    ]);

    const perDay = keys.map((date) => {
      const doneDay = done.filter((t) => dayKey(t.endedAt!) === date);
      const att = attendance.filter((a) => a.workDate.toISOString().slice(0, 10) === date);
      const mv = movements.filter((m) => dayKey(m.createdAt) === date);
      const sum = (type: string) => Math.round(mv.filter((m) => m.type === type).reduce((n, m) => n + m.quantity, 0));
      return {
        date,
        created: created.filter((t) => dayKey(t.createdAt) === date).length,
        completed: doneDay.length,
        collected: doneDay.reduce((n, t) => n + (t.amountCollected ?? 0), 0),
        present: att.length,
        late: att.filter((a) => a.status === 'LATE').length,
        issued: sum('ISSUE'),
        returned: sum('RETURN'),
        installed: sum('INSTALL'),
        consumed: sum('CONSUME'),
      };
    });

    const byType = Object.entries(
      done.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.type]: (acc[t.type] ?? 0) + 1 }), {}),
    )
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ days, perDay, byType });
  }),
);

insightsRouter.get(
  '/ratings',
  ah(async (_req, res) => {
    const from = new Date(Date.now() - 90 * DAY_MS);
    const rated = await prisma.task.findMany({
      where: { customerRating: { not: null }, ratedAt: { gte: from } },
      orderBy: { ratedAt: 'desc' },
      select: { id: true, code: true, title: true, customerName: true, customerRating: true, customerFeedback: true, ratedAt: true, assignee: { select: { id: true, name: true, staffNo: true } } },
    });

    const total = rated.reduce((n, t) => n + (t.customerRating ?? 0), 0);
    const distribution = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: rated.filter((t) => t.customerRating === stars).length }));
    const byTech = new Map<string, { user: { id: string; name: string; staffNo: string }; sum: number; count: number }>();
    for (const t of rated) {
      const row = byTech.get(t.assignee.id) ?? { user: t.assignee, sum: 0, count: 0 };
      row.sum += t.customerRating ?? 0;
      row.count += 1;
      byTech.set(t.assignee.id, row);
    }

    res.json({
      average: rated.length ? round1(total / rated.length) : null,
      count: rated.length,
      distribution,
      byTechnician: [...byTech.values()]
        .map((r) => ({ user: r.user, average: round1(r.sum / r.count), count: r.count }))
        .sort((a, b) => b.average - a.average || b.count - a.count),
      recent: rated.slice(0, 20).map((t) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        customerName: t.customerName,
        rating: t.customerRating,
        feedback: t.customerFeedback,
        ratedAt: t.ratedAt,
        technician: t.assignee.name,
      })),
    });
  }),
);
