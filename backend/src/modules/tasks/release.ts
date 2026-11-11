import { prisma } from '../../lib/prisma';
import { workDateOf } from '../../lib/time';
import { notifyRoles } from '../notifications/notifications.service';
import { notifyCustomer } from '../customer/customer.service';
import { announce } from './tasks.routes';

/*
 * Tasks made for a later day stay out of the technicians' lists until that day. This hands them out on
 * the morning of their day: the technician (or the team) is told "Today task: …", the customer hears
 * who is coming, and tasks still to be assigned are pointed out to the office.
 */
export async function releaseScheduledTasks() {
  const due = await prisma.task.findMany({
    where: { scheduledFor: { lte: workDateOf() }, releasedAt: null, status: { in: ['OPEN', 'ASSIGNED'] } },
    include: { assignee: { select: { id: true, name: true } }, team: { select: { name: true, members: { select: { userId: true } } } } },
    take: 500,
  });
  for (const task of due) {
    // Claim it first, so two server processes never announce the same task twice
    const claimed = await prisma.task.updateMany({ where: { id: task.id, releasedAt: null }, data: { releasedAt: new Date(), assignedAt: task.assigneeId ? new Date() : null } });
    if (!claimed.count) continue;
    if (task.status === 'ASSIGNED') {
      announce(task, 'Today');
      void notifyCustomer(task, { title: 'Your visit is today', body: `${task.team ? task.team.name : (task.assignee?.name ?? 'Our technician')} will handle "${task.title}" today.` });
    } else {
      void notifyRoles(['ADMIN', 'SUPERVISOR', 'CUSTOMER_CARE'], { type: 'TASK_ASSIGNED', title: `For today, still to assign: ${task.title}`, body: `${task.code} · ${task.customerName} · ${task.address}`, data: { taskId: task.id } });
    }
  }
  return due.length;
}

/** Runs shortly after start and every 10 minutes (so a task for today goes out early in the morning). */
export function scheduleTaskRelease() {
  const run = () => releaseScheduledTasks().catch((err) => console.error('[release] failed', err));
  const first = setTimeout(run, 15_000);
  const every = setInterval(run, 10 * 60_000);
  first.unref();
  every.unref();
}
