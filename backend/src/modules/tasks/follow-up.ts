import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { time, workDateOf } from '../../lib/time';
import { notify, notifyRoles } from '../notifications/notifications.service';

/*
 * Seeing every task through: a task given to a technician (the leader, for a team) is followed until it is
 * opened, started, finished and reported.
 * - Not opened 10 minutes after it was given: reminded every 15 minutes; after 30 minutes the office hears.
 * - Opened but not started when it is due within the hour (or 3 hours after it was given, with no due
 *   time): reminded every 30 minutes; 30 minutes past due the office hears.
 * - Started more than 3 hours ago: reminded every hour to finish and send the report; after 5 hours the
 *   office hears.
 * - From 17:30, finished tasks but no daily report: reminded every hour.
 * Reminders go out between 07:00 and 20:00 only. Check-out also waits for the reports (attendance).
 */

const MIN = 60_000;
const OFFICE = ['ADMIN', 'SUPERVISOR'] as const;

/** Minutes past midnight, company time. */
const localMinutes = (at: Date) => {
  const l = new Date(at.getTime() + env.TZ_OFFSET_MINUTES * MIN);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
};

const dayReportReminded = new Map<string, number>();

export async function runFollowUp(now = new Date(), opts: { anyHour?: boolean } = {}) {
  const minute = localMinutes(now);
  if (!opts.anyHour && (minute < 7 * 60 || minute >= 20 * 60)) return { reminded: 0, alerted: 0 };
  const today = workDateOf(now);
  const ago = (m: number) => new Date(now.getTime() - m * MIN);
  const released = { OR: [{ scheduledFor: null }, { scheduledFor: { lte: today } }] };
  const tasks = await prisma.task.findMany({
    where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, assigneeId: { not: null }, assignee: { active: true }, ...released },
    include: { assignee: { select: { id: true, name: true } } },
    take: 1000,
  });
  let reminded = 0;
  let alerted = 0;
  const remind = async (t: (typeof tasks)[number], title: string, body: string) => {
    await prisma.task.update({ where: { id: t.id }, data: { lastReminderAt: now, reminderCount: { increment: 1 } } });
    await notify([t.assigneeId!], { type: 'TASK_ASSIGNED', title, body, data: { taskId: t.id } });
    reminded++;
  };
  const alert = async (t: (typeof tasks)[number], stage: string, title: string, body: string) => {
    if (t.escalated === stage) return;
    await prisma.task.update({ where: { id: t.id }, data: { escalated: stage } });
    await notifyRoles([...OFFICE], { type: 'JOB_UPDATE', title, body, data: { taskId: t.id } });
    alerted++;
  };
  const since = (d: Date | null, m: number) => !d || d < ago(m);

  for (const t of tasks) {
    const given = t.assignedAt ?? t.updatedAt;
    const who = t.assignee?.name ?? 'The technician';
    if (t.status === 'ASSIGNED' && !t.seenAt) {
      if (given < ago(10) && since(t.lastReminderAt, 15) && t.reminderCount < 8) await remind(t, `Open your new task: ${t.title}`, `${t.code} · ${t.customerName} · ${t.address}. Open it so the office knows you have it.`);
      if (given < ago(30)) await alert(t, 'unseen', `${who} has not opened ${t.code}`, `${t.title} · given ${time(given)} · reminded ${t.reminderCount} time(s)`);
    } else if (t.status === 'ASSIGNED') {
      const dueSoon = t.dueAt ? t.dueAt.getTime() - now.getTime() <= 60 * MIN : given < ago(180);
      if (dueSoon && since(t.lastReminderAt, 30)) await remind(t, `Start ${t.code} now`, `${t.title} · ${t.customerName}${t.dueAt ? ` · due ${time(t.dueAt)}` : ''}. Take the start photo when you begin.`);
      if (t.dueAt && t.dueAt < ago(30)) await alert(t, 'unstarted', `${who} has not started ${t.code}`, `${t.title} · was due ${time(t.dueAt)}`);
    } else if (t.status === 'IN_PROGRESS' && t.startedAt) {
      if (t.startedAt < ago(180) && since(t.lastReminderAt, 60)) await remind(t, `Finish ${t.code} and send the report`, `Started at ${time(t.startedAt)}. Take the completion photo and fill in the task report.`);
      if (t.startedAt < ago(300)) await alert(t, 'long', `${t.code} still in progress`, `${who} started it at ${time(t.startedAt)} and has not reported yet`);
    }
  }

  // From 17:30: finished tasks today (as the one who reports) and no daily report yet
  if (opts.anyHour || minute >= 17 * 60 + 30) {
    const from = new Date(today.getTime() - env.TZ_OFFSET_MINUTES * MIN);
    const finished = await prisma.task.groupBy({ by: ['assigneeId'], where: { status: { in: ['COMPLETED', 'VERIFIED'] }, endedAt: { gte: from }, assigneeId: { not: null } }, _count: { _all: true } });
    const sent = new Set((await prisma.dayReport.findMany({ where: { workDate: today }, select: { submittedById: true } })).map((r) => r.submittedById));
    for (const f of finished) {
      const id = f.assigneeId!;
      if (sent.has(id) || (dayReportReminded.get(id) ?? 0) > now.getTime() - 60 * MIN) continue;
      dayReportReminded.set(id, now.getTime());
      await notify([id], { type: 'DAY_REPORT', title: 'Send your daily report', body: `${f._count._all} task(s) finished today. Send the report before you check out.`, data: {} });
      reminded++;
    }
  }
  return { reminded, alerted };
}

/** Every 5 minutes (background process only). */
export function scheduleFollowUp() {
  const run = () => runFollowUp().catch((err) => console.error('[follow-up] failed', err));
  const first = setTimeout(run, 30_000);
  const every = setInterval(run, 5 * MIN);
  first.unref();
  every.unref();
}
