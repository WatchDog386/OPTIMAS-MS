import { Router } from 'express';
import { z } from 'zod';
import { RequestStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { parse } from '../../middleware/validate';
import { notify } from '../notifications/notifications.service';
import { audit } from '../../lib/audit';
import { me } from '../../middleware/auth';

/** Supervisor inbox of customer service requests. Requests become jobs via POST /tasks with `requestId`. */
export const requestsRouter = Router();

requestsRouter.get(
  '/',
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' && req.query.status in RequestStatus ? (req.query.status as RequestStatus) : undefined;
    const requests = await prisma.serviceRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, phone: true, customerAccount: true, address: true } },
        task: { select: { id: true, code: true, status: true, assignee: { select: { name: true } } } },
      },
    });
    res.json({ requests });
  }),
);

requestsRouter.post(
  '/:id/close',
  ah(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().trim().min(3, 'Add a short note for the customer').max(500) }), req.body);
    const existing = await prisma.serviceRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Request');
    if (existing.status === 'CLOSED') throw conflict('Request is already closed');
    const request = await prisma.serviceRequest.update({ where: { id: existing.id }, data: { status: 'CLOSED', closedNote: note } });
    await audit(me(req).id, 'REQUEST_CLOSED', 'ServiceRequest', existing.id, `Closed request: ${note}`);
    void notify([existing.customerId], { type: 'JOB_UPDATE', title: 'Your request was closed', body: note, data: { requestId: existing.id } });
    res.json({ request });
  }),
);
