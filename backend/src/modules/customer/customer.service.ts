import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { notify } from '../notifications/notifications.service';

/** Notify every customer login tied to an account (and the requester, if any) about their job. */
export async function notifyCustomer(
  task: { id: string; customerAccount: string | null; requestId?: string | null },
  msg: { type?: NotificationType; title: string; body: string },
) {
  const ids = new Set<string>();
  if (task.customerAccount) {
    const users = await prisma.user.findMany({
      where: { role: 'CUSTOMER', active: true, customerAccount: task.customerAccount },
      select: { id: true },
    });
    users.forEach((u) => ids.add(u.id));
  }
  if (task.requestId) {
    const req = await prisma.serviceRequest.findUnique({ where: { id: task.requestId }, select: { customerId: true } });
    if (req) ids.add(req.customerId);
  }
  await notify([...ids], { type: msg.type ?? 'JOB_UPDATE', title: msg.title, body: msg.body, data: { taskId: task.id } as Prisma.InputJsonObject });
}
