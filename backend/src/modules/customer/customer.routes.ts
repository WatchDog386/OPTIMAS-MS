import { Router } from 'express';
import { z } from 'zod';
import { TaskType } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { conflict, notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { notify, notifyRoles } from '../notifications/notifications.service';
import { trackJob } from '../location/track';

/**
 * Customer self-service: what a subscriber can see about their own account only —
 * visits (with the assigned technician), devices installed at their premises and their requests.
 */
export const customerRouter = Router();

const techSelect = { select: { name: true, phone: true } } as const;
const jobSelect = {
  id: true,
  code: true,
  title: true,
  type: true,
  status: true,
  address: true,
  dueAt: true,
  startedAt: true,
  endedAt: true,
  durationMinutes: true,
  signedByName: true,
  customerRating: true,
  customerFeedback: true,
  ratedAt: true,
  createdAt: true,
  assignee: techSelect,
} as const;

async function account(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user;
}

customerRouter.get(
  '/overview',
  ah(async (req, res) => {
    const user = await account(me(req).id);
    const acct = user.customerAccount;
    const accountWhere = acct ? { customerAccount: acct } : { id: '__none__' };
    const [active, history, devices, requests] = await Promise.all([
      prisma.task.findMany({
        where: { ...accountWhere, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        select: jobSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.task.findMany({
        where: { ...accountWhere, status: { in: ['COMPLETED', 'VERIFIED'] } },
        select: jobSelect,
        orderBy: { endedAt: 'desc' },
        take: 10,
      }),
      acct
        ? prisma.serialUnit.findMany({
            where: { customerAccount: acct, status: 'INSTALLED' },
            select: { serialNumber: true, installedAt: true, item: { select: { name: true, category: true } } },
            orderBy: { installedAt: 'desc' },
          })
        : Promise.resolve([]),
      prisma.serviceRequest.findMany({ where: { customerId: user.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { task: { select: { id: true, code: true, status: true } } } }),
    ]);
    res.json({
      customer: { name: user.name, account: acct, phone: user.phone, address: user.address, email: user.email },
      active,
      history,
      devices,
      requests,
      support: { phone: env.SUPPORT_PHONE || null, whatsapp: env.SUPPORT_WHATSAPP || null },
    });
  }),
);

customerRouter.get(
  '/jobs/:id',
  ah(async (req, res) => {
    const user = await account(me(req).id);
    const job = await prisma.task.findFirst({
      where: { id: req.params.id, OR: [{ customerAccount: user.customerAccount ?? '__none__' }, { request: { customerId: user.id } }] },
      select: { ...jobSelect, completionNotes: true, materials: { select: { quantity: true, item: { select: { name: true, unit: true } }, unit: { select: { serialNumber: true } } } } },
    });
    if (!job) throw notFound('Job');
    res.json({ job });
  }),
);

const requestSchema = z.object({
  type: z.enum(TaskType).default('REPAIR'),
  description: z.string().trim().min(5, 'Tell us what the problem is').max(1000),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  /** Where the customer is, from their phone (only when they allowed location). */
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

customerRouter.post(
  '/requests',
  ah(async (req, res) => {
    const user = await account(me(req).id);
    const body = parse(requestSchema, req.body);
    const request = await prisma.serviceRequest.create({
      data: {
        customerId: user.id,
        customerAccount: user.customerAccount,
        type: body.type,
        description: body.description,
        phone: body.phone || user.phone,
        address: body.address || user.address,
        // Their phone's position now, or the premises pin recorded earlier (at onboarding or a past share)
        lat: body.lat ?? user.lastLat,
        lng: body.lng ?? user.lastLng,
      },
    });
    void notifyRoles(['SUPERVISOR', 'ADMIN', 'CUSTOMER_CARE'], {
      type: 'SERVICE_REQUEST',
      title: `New ${body.type.toLowerCase()} request — ${user.name}`,
      body: body.description.slice(0, 140),
      data: { requestId: request.id },
    });
    res.status(201).json({ request });
  }),
);

customerRouter.get(
  '/requests',
  ah(async (req, res) => {
    const requests = await prisma.serviceRequest.findMany({
      where: { customerId: me(req).id },
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { id: true, code: true, status: true, assignee: techSelect } } },
    });
    res.json({ requests });
  }),
);

/** Follow the technician coming to one of my visits (only while it is on its way or under way). */
customerRouter.get(
  '/jobs/:id/track',
  ah(async (req, res) => {
    const user = await account(me(req).id);
    const job = await prisma.task.findFirst({
      where: { id: req.params.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, OR: [{ customerAccount: user.customerAccount ?? '__none__' }, { request: { customerId: user.id } }] },
    });
    if (!job) throw notFound('Visit');
    const t = await trackJob(job);
    // Customers see who is coming and where they are (the id lets them open a chat with them)
    res.json({ ...t, tech: { id: t.tech.id, name: t.tech.name, phone: t.tech.phone, position: t.tech.position } });
  }),
);

const rateSchema = z.object({
  rating: z.number().int().min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars'),
  comment: z.string().trim().max(500).optional(),
});

/** The customer rates a finished visit once; the technician is told how it went. */
customerRouter.post(
  '/jobs/:id/rate',
  ah(async (req, res) => {
    const user = await account(me(req).id);
    const body = parse(rateSchema, req.body);
    const job = await prisma.task.findFirst({
      where: { id: req.params.id, OR: [{ customerAccount: user.customerAccount ?? '__none__' }, { request: { customerId: user.id } }] },
      select: { id: true, code: true, status: true, ratedAt: true, assigneeId: true },
    });
    if (!job) throw notFound('Job');
    if (job.status !== 'COMPLETED' && job.status !== 'VERIFIED') throw conflict('You can rate a visit once the work is finished', 'NOT_FINISHED');
    // Guarded update so a double tap cannot rate twice
    const { count } = await prisma.task.updateMany({
      where: { id: job.id, ratedAt: null },
      data: { customerRating: body.rating, customerFeedback: body.comment || null, ratedAt: new Date() },
    });
    if (!count) throw conflict('You have already rated this visit', 'ALREADY_RATED');
    void notify([job.assigneeId], {
      type: 'JOB_UPDATE',
      title: `${'★'.repeat(body.rating)}${'☆'.repeat(5 - body.rating)} for ${job.code}`,
      body: body.comment ? `“${body.comment.slice(0, 120)}” — ${user.name}` : `${user.name} rated your visit ${body.rating}/5`,
      data: { taskId: job.id },
    });
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: job.id }, select: jobSelect });
    res.json({ job: updated });
  }),
);
