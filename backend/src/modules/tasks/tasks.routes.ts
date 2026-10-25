import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error';
import { minutesBetween, workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { consumePhoto } from '../capture/capture.service';
import { consumeBulk, installSerial } from '../inventory/inventory.service';
import { notify, notifyRoles } from '../notifications/notifications.service';

export const tasksRouter = Router();
const managers = requireRole(ROLES.MANAGERS);

const person = { select: { id: true, name: true, staffNo: true, phone: true } } as const;
const photo = { select: { id: true, flags: true, lat: true, lng: true, receivedAt: true } } as const;
const detailInclude = {
  assignee: person,
  createdBy: person,
  verifiedBy: person,
  startPhoto: photo,
  endPhoto: photo,
  materials: { include: { item: { select: { name: true, sku: true, unit: true, category: true } }, unit: { select: { serialNumber: true } } } },
} satisfies Prisma.TaskInclude;

const newCode = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `JOB-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
};

async function loadTask(id: string) {
  const task = await prisma.task.findUnique({ where: { id }, include: detailInclude });
  if (!task) throw notFound('Task');
  return task;
}

// ───────────────────────────── Queries ───────────────────────────────

tasksRouter.get(
  '/',
  ah(async (req, res) => {
    const user = me(req);
    const isManager = ROLES.STORE.includes(user.role);
    const status = typeof req.query.status === 'string'
      ? (req.query.status.split(',').filter((s) => s in TaskStatus) as TaskStatus[])
      : undefined;
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: isManager ? (typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined) : user.id,
        status: status?.length ? { in: status } : undefined,
      },
      include: { assignee: person },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    res.json({ tasks });
  }),
);

tasksRouter.get(
  '/:id',
  ah(async (req, res) => {
    const user = me(req);
    const task = await loadTask(req.params.id);
    if (task.assigneeId !== user.id && !ROLES.STORE.includes(user.role)) throw forbidden();
    res.json({ task });
  }),
);

// ───────────────────────────── Management ────────────────────────────

const taskSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(TaskType),
  priority: z.enum(TaskPriority).default('NORMAL'),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().optional(),
  customerAccount: z.string().trim().optional(),
  address: z.string().trim().min(3),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  dueAt: z.coerce.date().optional(),
  assigneeId: z.string().min(1),
});

tasksRouter.post(
  '/',
  managers,
  ah(async (req, res) => {
    const body = parse(taskSchema, req.body);
    const assignee = await prisma.user.findUnique({ where: { id: body.assigneeId } });
    if (!assignee?.active || assignee.role !== 'TECHNICIAN') throw badRequest('Tasks can only be assigned to active technicians');
    const task = await prisma.task.create({ data: { ...body, code: newCode(), createdById: me(req).id }, include: detailInclude });
    void notify([task.assigneeId], {
      type: 'TASK_ASSIGNED',
      title: `New ${task.priority === 'URGENT' ? 'URGENT ' : ''}job: ${task.title}`,
      body: `${task.customerName} · ${task.address}`,
      data: { taskId: task.id },
    });
    res.status(201).json({ task });
  }),
);

tasksRouter.patch(
  '/:id',
  managers,
  ah(async (req, res) => {
    const body = parse(taskSchema.partial(), req.body);
    const task = await loadTask(req.params.id);
    if (task.status !== 'ASSIGNED') throw conflict('Only tasks that have not started can be edited or reassigned');
    const updated = await prisma.task.update({ where: { id: task.id }, data: body, include: detailInclude });
    if (body.assigneeId && body.assigneeId !== task.assigneeId) {
      void notify([updated.assigneeId], {
        type: 'TASK_ASSIGNED',
        title: `New job: ${updated.title}`,
        body: `${updated.customerName} · ${updated.address}`,
        data: { taskId: updated.id },
      });
      void notify([task.assigneeId], { type: 'TASK_CANCELLED', title: `${task.code} reassigned`, body: 'This job was moved to another technician.', data: { taskId: task.id } });
    }
    res.json({ task: updated });
  }),
);

tasksRouter.post(
  '/:id/cancel',
  managers,
  ah(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(task.status)) throw conflict(`A ${task.status.toLowerCase()} task cannot be cancelled`);
    const updated = await prisma.task.update({ where: { id: task.id }, data: { status: 'CANCELLED' }, include: detailInclude });
    void notify([task.assigneeId], { type: 'TASK_CANCELLED', title: `${task.code} cancelled`, body: task.title, data: { taskId: task.id } });
    res.json({ task: updated });
  }),
);

const verifySchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  note: z.string().trim().max(1000).optional(),
});

tasksRouter.post(
  '/:id/verify',
  managers,
  ah(async (req, res) => {
    const body = parse(verifySchema, req.body);
    const task = await loadTask(req.params.id);
    if (task.status !== 'COMPLETED') throw conflict('Only completed tasks can be verified');
    if (body.decision === 'REJECTED' && !body.note) throw badRequest('Give a reason when rejecting work');
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: body.decision, verifiedById: me(req).id, verifiedAt: new Date(), verificationNote: body.note },
      include: detailInclude,
    });
    void notify([task.assigneeId], {
      type: body.decision === 'VERIFIED' ? 'TASK_VERIFIED' : 'TASK_REJECTED',
      title: body.decision === 'VERIFIED' ? `${task.code} verified ✔` : `${task.code} returned for correction`,
      body: body.note ?? task.title,
      data: { taskId: task.id },
    });
    res.json({ task: updated });
  }),
);

// ───────────────────────────── Field execution ───────────────────────

tasksRouter.post(
  '/:id/start',
  ah(async (req, res) => {
    const userId = me(req).id;
    const { photoId } = parse(z.object({ photoId: z.string().min(1) }), req.body);
    const task = await loadTask(req.params.id);
    if (task.assigneeId !== userId) throw forbidden('This task is not assigned to you');
    if (task.status !== 'ASSIGNED') throw conflict(`Task is already ${task.status.toLowerCase().replace('_', ' ')}`);

    const attendance = await prisma.attendance.findUnique({ where: { userId_workDate: { userId, workDate: workDateOf() } } });
    if (!attendance) throw conflict('Check in for the day before starting a task', 'NOT_CHECKED_IN');
    if (attendance.checkOutAt) throw conflict('You have already checked out for the day', 'CHECKED_OUT');

    const busy = await prisma.task.findFirst({ where: { assigneeId: userId, status: 'IN_PROGRESS' } });
    if (busy) throw conflict(`Finish ${busy.code} before starting another task`, 'TASK_IN_PROGRESS');

    await prisma.$transaction(async (tx) => {
      await consumePhoto(tx, photoId, userId, 'TASK_START', task.id);
      await tx.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', startedAt: new Date(), startPhotoId: photoId } });
    });
    res.json({ task: await loadTask(task.id) });
  }),
);

const completeSchema = z.object({
  photoId: z.string().min(1),
  notes: z.string().trim().min(5, 'Describe the work done').max(2000),
  customerAccount: z.string().trim().optional(),
  amountCollected: z.number().int().min(0).optional(),
  serials: z.array(z.string().trim().min(1)).default([]),
  materials: z
    .array(z.object({ itemId: z.string().min(1), quantity: z.number().positive(), unitPrice: z.number().int().min(0).optional() }))
    .default([]),
  signature: z
    .object({
      // SVG path data only (move/line/curve commands and numbers) — never markup.
      path: z.string().min(10).max(200_000).regex(/^[MLQCZmlqcz0-9.,\s-]+$/, 'Invalid signature'),
      signedBy: z.string().trim().min(2, 'Enter the name of the person who signed'),
    })
    .optional(),
});

tasksRouter.post(
  '/:id/complete',
  ah(async (req, res) => {
    const userId = me(req).id;
    const body = parse(completeSchema, req.body);
    const task = await loadTask(req.params.id);
    if (task.assigneeId !== userId) throw forbidden('This task is not assigned to you');
    if (task.status !== 'IN_PROGRESS' || !task.startedAt) throw conflict('Start the task before completing it');
    if (task.type === 'INSTALLATION' && body.serials.length === 0) {
      throw badRequest('Scan the serial number of the router/ONT installed for this customer', 'SERIAL_REQUIRED');
    }
    if (task.type === 'INSTALLATION' && !body.signature) {
      throw badRequest('Ask the customer to sign to confirm the installation', 'SIGNATURE_REQUIRED');
    }

    const customerAccount = body.customerAccount || task.customerAccount;
    const endedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await consumePhoto(tx, body.photoId, userId, 'TASK_END', task.id);

      for (const serial of body.serials) {
        const unit = await installSerial(tx, userId, serial, { id: task.id, customerAccount: customerAccount ?? null });
        await tx.taskMaterial.create({
          data: { taskId: task.id, itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, unitPrice: unit.item.unitPrice, amount: unit.item.unitPrice },
        });
      }

      for (const m of body.materials) {
        const item = await consumeBulk(tx, userId, m.itemId, m.quantity, task.id);
        const unitPrice = m.unitPrice ?? item.unitPrice;
        await tx.taskMaterial.create({
          data: { taskId: task.id, itemId: m.itemId, quantity: m.quantity, unitPrice, amount: Math.round(unitPrice * m.quantity) },
        });
      }

      await tx.task.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          endedAt,
          endPhotoId: body.photoId,
          durationMinutes: minutesBetween(task.startedAt!, endedAt),
          completionNotes: body.notes,
          amountCollected: body.amountCollected,
          customerAccount,
          customerSignature: body.signature?.path,
          signedByName: body.signature?.signedBy,
          signedAt: body.signature ? endedAt : undefined,
        },
      });
    });
    void notifyRoles(['SUPERVISOR', 'ADMIN'], {
      type: 'TASK_COMPLETED',
      title: `${task.code} completed by ${task.assignee.name}`,
      body: `${task.customerName} · ${minutesBetween(task.startedAt!, endedAt)} min — awaiting verification`,
      data: { taskId: task.id },
    });
    res.json({ task: await loadTask(task.id) });
  }),
);
