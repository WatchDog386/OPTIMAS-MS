import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/**
 * Who may message whom:
 * - staff with staff (office ↔ technicians, store ↔ technicians…)
 * - supervisors/admins with any customer
 * - a technician with a customer only while they have (or recently had) a job for that customer
 * - a customer with the office through their single "Optimas support" conversation
 */

export const MANAGER_ROLES: Role[] = ['ADMIN', 'SUPERVISOR'];
export const isManagerRole = (r: Role) => MANAGER_ROLES.includes(r);
/** The office side of the customer support line: managers and customer care. */
export const SUPPORT_ROLES: Role[] = ['ADMIN', 'SUPERVISOR', 'CUSTOMER_CARE'];
export const isSupportRole = (r: Role) => SUPPORT_ROLES.includes(r);
/** A technician can keep chatting with a customer this long after the visit ended. */
export const AFTER_VISIT_MS = 14 * 24 * 60 * 60_000;

export interface Person {
  id: string;
  role: Role;
  active?: boolean;
}

/** Jobs that connect this technician and this customer right now (open, or ended in the last two weeks). */
export async function linkingJobs(techId: string, customerId: string) {
  const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { customerAccount: true } });
  if (!customer) return [];
  return prisma.task.findMany({
    where: {
      assigneeId: techId,
      OR: [{ customerAccount: customer.customerAccount ?? '__none__' }, { request: { customerId } }],
      AND: [{ OR: [{ status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }, { endedAt: { gte: new Date(Date.now() - AFTER_VISIT_MS) } }] }],
    },
    select: { id: true, code: true, title: true, status: true },
    orderBy: { createdAt: 'desc' },
  });
}

/** null when allowed, otherwise the reason to show. */
export async function chatBlockedReason(a: Person, b: Person): Promise<string | null> {
  if (a.id === b.id) return 'You cannot message yourself';
  if (b.active === false) return 'This account is no longer active';
  const aCust = a.role === 'CUSTOMER';
  const bCust = b.role === 'CUSTOMER';
  if (aCust && bCust) return 'Customers cannot message each other';
  if (!aCust && !bCust) return null;
  const staff = aCust ? b : a;
  const customer = aCust ? a : b;
  if (isSupportRole(staff.role)) return null;
  if (staff.role === 'TECHNICIAN' && (await linkingJobs(staff.id, customer.id)).length) return null;
  return staff.role === 'TECHNICIAN' ? 'You can only message customers you have a current or recent job for' : 'Customers can message the office or their technician';
}

export const pairKey = (a: string, b: string) => [a, b].sort().join(':');
