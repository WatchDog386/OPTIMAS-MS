import { Router } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';

export const reportsRouter = Router();
const DAY_MS = 86_400_000;

/** Supervisor home: one call with every number on the dashboard. */
reportsRouter.get(
  '/dashboard',
  requireRole(ROLES.STORE),
  ah(async (_req, res) => {
    const today = workDateOf();
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);
    const alertBefore = new Date(Date.now() - env.CUSTODY_AGE_ALERT_DAYS * DAY_MS);

    const [staff, attendance, taskGroups, completedWeek, unitGroups, overdueUnits, pendingReviews, lowStock, recentLost, countsWithMissing, openRequests] =
      await Promise.all([
        // Everyone expected to check in today (all staff but admins)
        prisma.user.count({ where: { active: true, role: { in: ROLES.CHECK_IN } } }),
        prisma.attendance.findMany({ where: { workDate: today }, select: { status: true, checkOutAt: true } }),
        prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.task.aggregate({
          where: { endedAt: { gte: weekAgo }, status: { in: ['COMPLETED', 'VERIFIED'] } },
          _count: { _all: true },
          _avg: { durationMinutes: true },
          _sum: { amountCollected: true },
        }),
        prisma.serialUnit.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.serialUnit.count({ where: { status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] }, heldSince: { lt: alertBefore } } }),
        prisma.attendance.count({ where: { dressReview: 'PENDING' } }),
        prisma.inventoryItem.findMany({ where: { active: true, tracking: 'BULK' }, select: { storeQuantity: true, reorderLevel: true } }),
        prisma.serialUnit.count({ where: { status: 'LOST', updatedAt: { gte: new Date(Date.now() - 30 * DAY_MS) } } }),
        prisma.stockCount.findMany({ where: { createdAt: { gte: weekAgo } }, select: { missing: true } }),
        prisma.serviceRequest.count({ where: { status: 'OPEN' } }),
      ]);

    const tasks = Object.fromEntries(taskGroups.map((g) => [g.status, g._count._all]));
    const units = Object.fromEntries(unitGroups.map((g) => [g.status, g._count._all]));
    const checkedIn = attendance.length;

    res.json({
      workDate: today,
      attendance: {
        technicians: staff,
        checkedIn,
        late: attendance.filter((a) => a.status === 'LATE').length,
        checkedOut: attendance.filter((a) => a.checkOutAt).length,
        absent: Math.max(0, staff - checkedIn),
        pendingDressReviews: pendingReviews,
      },
      tasks: {
        assigned: tasks.ASSIGNED ?? 0,
        inProgress: tasks.IN_PROGRESS ?? 0,
        awaitingVerification: tasks.COMPLETED ?? 0,
        completedLast7Days: completedWeek._count._all,
        avgDurationMinutes: Math.round(completedWeek._avg.durationMinutes ?? 0),
        amountCollectedLast7Days: completedWeek._sum.amountCollected ?? 0,
      },
      routers: {
        inStore: units.IN_STORE ?? 0,
        inTransit: units.IN_TRANSIT ?? 0,
        withTechnicians: units.WITH_TECHNICIAN ?? 0,
        installed: units.INSTALLED ?? 0,
        faulty: units.FAULTY ?? 0,
        lost: units.LOST ?? 0,
        overdueInCustody: overdueUnits,
        lostLast30Days: recentLost,
        missingInSpotCounts: countsWithMissing.reduce((n, c) => n + c.missing.length, 0),
      },
      lowStockItems: lowStock.filter((i) => i.storeQuantity <= i.reorderLevel).length,
      requests: { open: openRequests },
    });
  }),
);

/**
 * Technician home & profile: personal performance at a glance — this calendar month (profile), this week vs
 * the last 30 days, punctuality and customer rating (dashboard).
 */
reportsRouter.get(
  '/me',
  ah(async (req, res) => {
    const userId = me(req).id;
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY_MS);
    const monthAgo = new Date(now - 30 * DAY_MS);
    const done = { assigneeId: userId, status: { in: ['COMPLETED', 'VERIFIED'] as ('COMPLETED' | 'VERIFIED')[] } };
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [week, month, ratings, attendance, verified, rejected, open, calMonth, calAttendance, custody] = await Promise.all([
      prisma.task.aggregate({ where: { ...done, endedAt: { gte: weekAgo } }, _count: { _all: true }, _avg: { durationMinutes: true } }),
      prisma.task.aggregate({ where: { ...done, endedAt: { gte: monthAgo } }, _count: { _all: true }, _avg: { durationMinutes: true } }),
      prisma.task.aggregate({ where: { assigneeId: userId, customerRating: { not: null } }, _count: { customerRating: true }, _avg: { customerRating: true } }),
      prisma.attendance.findMany({ where: { userId, workDate: { gte: monthAgo } }, select: { workDate: true, status: true, workedMinutes: true } }),
      prisma.task.count({ where: { assigneeId: userId, status: 'VERIFIED', verifiedAt: { gte: monthAgo } } }),
      prisma.task.count({ where: { assigneeId: userId, status: 'REJECTED', verifiedAt: { gte: monthAgo } } }),
      prisma.task.count({ where: { assigneeId: userId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.task.aggregate({ where: { ...done, endedAt: { gte: monthStart } }, _count: { _all: true }, _avg: { durationMinutes: true } }),
      prisma.attendance.findMany({ where: { userId, workDate: { gte: monthStart } }, select: { status: true, workedMinutes: true } }),
      prisma.serialUnit.count({ where: { holderId: userId, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } } }),
    ]);
    const weekDays = attendance.filter((a) => a.workDate >= weekAgo);
    const onTime = attendance.filter((a) => a.status === 'PRESENT').length;
    res.json({
      // calendar month (profile screen)
      openTasks: open,
      completedThisMonth: calMonth._count._all,
      avgJobMinutes: Math.round(calMonth._avg.durationMinutes ?? 0),
      daysPresent: calAttendance.length,
      lateDays: calAttendance.filter((a) => a.status === 'LATE').length,
      hoursWorked: Math.round(calAttendance.reduce((n, a) => n + (a.workedMinutes ?? 0), 0) / 60),
      unitsInCustody: custody,
      week: {
        jobs: week._count._all,
        avgMinutes: Math.round(week._avg.durationMinutes ?? 0),
        hours: Math.round((weekDays.reduce((n, a) => n + (a.workedMinutes ?? 0), 0) / 60) * 10) / 10,
        days: weekDays.length,
      },
      month: {
        jobs: month._count._all,
        avgMinutes: Math.round(month._avg.durationMinutes ?? 0),
        days: attendance.length,
        onTimeRate: attendance.length ? Math.round((onTime / attendance.length) * 100) : null,
        verified,
        sentBack: rejected,
      },
      rating: { average: ratings._avg.customerRating ? Math.round(ratings._avg.customerRating * 10) / 10 : null, count: ratings._count.customerRating },
    });
  }),
);
