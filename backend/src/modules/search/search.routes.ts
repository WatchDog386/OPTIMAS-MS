import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { ROLES, me } from '../../middleware/auth';

/**
 * One search box across the system. Technicians only see their own jobs and devices;
 * supervisors / storekeepers / admins see everything (customers only for managers).
 */
export const searchRouter = Router();

searchRouter.get(
  '/',
  ah(async (req, res) => {
    const user = me(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) throw badRequest('Type at least 2 characters');
    const store = ROLES.STORE.includes(user.role);
    const managers = ROLES.MANAGERS.includes(user.role);
    const like = { contains: q, mode: 'insensitive' as const };

    const [tasks, units, staff, customers, requests] = await Promise.all([
      prisma.task.findMany({
        where: {
          // A technician finds their own jobs and their teams' jobs
          AND: [
            store ? {} : { OR: [{ assigneeId: user.id }, { team: { members: { some: { userId: user.id } } } }] },
            { OR: [{ code: like }, { title: like }, { customerName: like }, { customerAccount: like }, { customerPhone: { contains: q } }, { address: like }] },
          ],
        },
        select: { id: true, code: true, title: true, status: true, customerName: true, assignee: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.serialUnit.findMany({
        where: {
          ...(store ? {} : { holderId: user.id }),
          OR: [{ serialNumber: like }, { macAddress: like }, { customerAccount: like }],
        },
        select: { id: true, serialNumber: true, status: true, customerAccount: true, item: { select: { name: true } }, holder: { select: { name: true } } },
        take: 15,
      }),
      store
        ? prisma.user.findMany({
            where: { role: { not: 'CUSTOMER' }, OR: [{ name: like }, { staffNo: like }, { phone: { contains: q } }, { email: like }] },
            select: { id: true, name: true, staffNo: true, role: true, active: true },
            take: 10,
          })
        : Promise.resolve([]),
      managers
        ? prisma.user.findMany({
            where: { role: 'CUSTOMER', OR: [{ name: like }, { customerAccount: like }, { phone: { contains: q } }, { email: like }, { address: like }] },
            select: { id: true, name: true, customerAccount: true, phone: true, active: true },
            take: 10,
          })
        : Promise.resolve([]),
      managers
        ? prisma.serviceRequest.findMany({
            where: { OR: [{ description: like }, { customerAccount: like }, { customer: { name: like } }] },
            select: { id: true, type: true, status: true, description: true, customer: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
    ]);
    res.json({ q, tasks, units, staff, customers, requests });
  }),
);
