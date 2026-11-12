import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma, TaskPriority, TaskStatus, TaskType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error';
import { minutesBetween, workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { NOTES_MIN_WORDS, reportProblem, taskReportProblem, taskReportSchema, taskReportText } from '../../lib/task-report';
import { parse } from '../../middleware/validate';
import { consumePhoto, eventTime } from '../capture/capture.service';
import { consumeBulk, installSerial, requireHeldUnit } from '../inventory/inventory.service';
import { fileRequest, tellAdmins } from '../inventory/stock-approval';
import { notify, notifyRoles } from '../notifications/notifications.service';
import { notifyCustomer } from '../customer/customer.service';
import { audit } from '../../lib/audit';
import { env } from '../../config/env';
import { distanceMetres } from '../../lib/geo';
import { estimateMinutes } from '../../lib/routing';
import { positionsOf } from '../location/location.service';
import { fillJobCoordinates, trackJob } from '../location/track';
import { createTeam, newTeamSchema, teamInclude } from '../teams/teams.routes';

export const tasksRouter = Router();
const managers = requireRole(ROLES.MANAGERS);
const dispatchers = requireRole(ROLES.DISPATCH);
/** Customer care can give a job to a technician or a saved team, but only managers make new teams. */
const mayMakeTeam = (role: string, newTeam: unknown) => {
  if (newTeam && role === 'CUSTOMER_CARE') throw forbidden('Only a supervisor or admin can make a new team. Choose a saved team or one technician.');
};

const person = { select: { id: true, name: true, staffNo: true, phone: true } } as const;
const photo = { select: { id: true, flags: true, lat: true, lng: true, receivedAt: true } } as const;
const detailInclude = {
  assignee: person,
  createdBy: person,
  verifiedBy: person,
  startPhoto: photo,
  endPhoto: photo,
  materials: { include: { item: { select: { name: true, sku: true, unit: true, category: true } }, unit: { select: { serialNumber: true } } } },
  team: { include: teamInclude },
} satisfies Prisma.TaskInclude;

/** Drop cable used: the difference between the length marks when both are given, otherwise as entered. */
export function cableUsed(b: { dropCableM?: number | null; dropStartM?: number | null; dropEndM?: number | null }) {
  return b.dropStartM != null && b.dropEndM != null ? Math.round(Math.abs(b.dropStartM - b.dropEndM) * 10) / 10 : (b.dropCableM ?? undefined);
}

/** A task given (again) to someone: the follow-up starts over (not opened yet, no reminders). */
const freshFollowUp = (given: boolean) => ({ assignedAt: given ? new Date() : null, seenAt: null, lastReminderAt: null, reminderCount: 0, escalated: null, returnNote: null });

/** Today, company time, as a @db.Date value; and the instant today starts. */
const todayDate = () => workDateOf();
const todayStart = () => new Date(workDateOf().getTime() - env.TZ_OFFSET_MINUTES * 60_000);
/** "Sat 14 Nov" for a scheduled day. */
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
/** Tasks the technicians see: not scheduled for a later day. */
const notFuture = (): Prisma.TaskWhereInput => ({ OR: [{ scheduledFor: null }, { scheduledFor: { lte: todayDate() } }] });

type Crewed = { assigneeId: string | null; team?: { members: { userId: string }[] } | null };
/** Everyone working the job: the assignee plus, for a team job, every member (nobody while it is OPEN). */
const crewOf = (task: Crewed) => [...new Set([task.assigneeId, ...(task.team?.members.map((m) => m.userId) ?? [])])].filter((id): id is string => !!id);
/** Team members other than the leader. */
const helpersOf = (task: Crewed) => crewOf(task).filter((id) => id !== task.assigneeId);
/** Who has the job, for messages ("Not assigned" while it is OPEN). */
const lead = (task: { assignee: { name: string } | null }) => task.assignee?.name ?? 'Not assigned';
/** Only the assignee (the team leader on a team job) may start or report the job. */
function mustBeAssignee(task: { assigneeId: string | null; assignee: { name: string } | null; team?: { name: string; members: { userId: string }[] } | null }, userId: string) {
  if (!task.assigneeId) throw forbidden('This task has not been given to a technician yet');
  if (task.assigneeId === userId) return;
  if (task.team?.members.some((m) => m.userId === userId)) throw forbidden(`${lead(task)} leads ${task.team.name} and files the report for this task`);
  throw forbidden('This task is not assigned to you');
}
const onCrew = (task: Parameters<typeof crewOf>[0], userId: string) => crewOf(task).includes(userId);

const newCode = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // 6 characters: 16 million codes a day, so two jobs practically never collide (and a clash is retried)
  return `TSK-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
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
    const isManager = ROLES.JOB_VIEWERS.includes(user.role);
    const status = typeof req.query.status === 'string'
      ? (req.query.status.split(',').filter((s) => s in TaskStatus) as TaskStatus[])
      : undefined;
    const forTech = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined;
    // A technician sees their own jobs and their teams' jobs
    const who = isManager ? forTech : user.id;
    // ?scheduled=1 (office): tasks for a later day; otherwise those only show once their day comes
    const future = isManager && req.query.scheduled === '1';
    const where: Prisma.TaskWhereInput = {
      AND: [
        who ? { OR: [{ assigneeId: who }, { team: { members: { some: { userId: who } } } }] } : {},
        future ? { scheduledFor: { gt: todayDate() } } : notFuture(),
      ],
      status: status?.length ? { in: status } : undefined,
    };
    // ?due=soon (due in the next 2 hours) or ?due=overdue (past due), open tasks only: the overview's tiles
    if (req.query.due === 'soon' || req.query.due === 'overdue') {
      const now = new Date();
      where.status = status?.length ? { in: status } : { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] };
      where.dueAt = req.query.due === 'soon' ? { gte: now, lt: new Date(now.getTime() + 2 * 3600_000) } : { lt: now };
    }
    // ?created=today: only tasks created today (company time); `earlier` says how many older ones match
    // A task scheduled for a day counts as that day's
    const today = req.query.created === 'today' && !future ? todayStart() : null;
    const isToday: Prisma.TaskWhereInput = { OR: [{ scheduledFor: null, createdAt: { gte: today ?? new Date(0) } }, { scheduledFor: todayDate() }] };
    const tasks = await prisma.task.findMany({
      where: today ? { AND: [where, isToday] } : where,
      include: { assignee: person, createdBy: { select: { id: true, name: true } }, team: { select: { id: true, name: true, leaderId: true, _count: { select: { members: true } } } } },
      orderBy: future ? [{ scheduledFor: 'asc' }, { dueAt: 'asc' }] : [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    // Earlier: made before today without a day, or scheduled for an earlier day (spelled out: NOT on a
    // nullable column would skip the tasks without a day)
    const isEarlier: Prisma.TaskWhereInput = { OR: [{ scheduledFor: null, createdAt: { lt: today ?? new Date(0) } }, { scheduledFor: { lt: todayDate() } }] };
    if (today) return void res.json({ tasks, earlier: await prisma.task.count({ where: { AND: [where, isEarlier] } }) });
    res.json({ tasks });
  }),
);

tasksRouter.get(
  '/:id',
  ah(async (req, res) => {
    const user = me(req);
    const task = await loadTask(req.params.id);
    if (!onCrew(task, user.id) && !ROLES.JOB_VIEWERS.includes(user.role)) throw forbidden();
    // The technician (the leader) opened it: they have seen it, the reminders to open it stop
    if (task.assigneeId === user.id && !task.seenAt && (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS')) {
      const seenAt = new Date();
      await prisma.task.update({ where: { id: task.id }, data: { seenAt } });
      return void res.json({ task: { ...task, seenAt } });
    }
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
  /** A later day (YYYY-MM-DD, company time): the technicians see and hear of the task only on that day */
  scheduledFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date')
    .nullable()
    .optional(),
  /** One technician… */
  assigneeId: z.string().min(1).optional(),
  /** …or a team: an existing one, or a new one made here. The leader becomes the assignee. */
  teamId: z.string().min(1).nullable().optional(),
  newTeam: newTeamSchema.optional(),
  /** Customer service request this job fulfils. */
  requestId: z.string().optional(),
  /** Save the job now and give it to a technician later (e.g. logged in the evening, assigned in the morning). */
  assignLater: z.boolean().optional(),
});

/** Who the job goes to: { assigneeId, teamId } from an individual, an existing team or a new team. */
async function resolveAssignment(tx: Prisma.TransactionClient, body: { assigneeId?: string; teamId?: string | null; newTeam?: z.infer<typeof newTeamSchema> }, actorId: string) {
  if (body.newTeam) {
    const team = await createTeam(tx, body.newTeam, actorId);
    return { assigneeId: team.leaderId, teamId: team.id };
  }
  if (body.teamId) {
    const team = await tx.team.findUnique({ where: { id: body.teamId }, include: { leader: true, members: { include: { user: true } } } });
    if (!team) throw badRequest('Team not found');
    if (!team.leader.active || team.leader.role !== 'TECHNICIAN') throw badRequest(`${team.leader.name} can no longer lead ${team.name}. Make a new team.`);
    return { assigneeId: team.leaderId, teamId: team.id };
  }
  if (!body.assigneeId) throw badRequest('Choose a technician or a team');
  const assignee = await tx.user.findUnique({ where: { id: body.assigneeId } });
  if (!assignee?.active || assignee.role !== 'TECHNICIAN') throw badRequest('Tasks can only be assigned to active technicians');
  return { assigneeId: assignee.id, teamId: null };
}

/** Tells the leader (or the one technician) and the rest of the team about a new job. */
export function announce(task: { id: string; title: string; priority: string; customerName: string; address: string; assigneeId: string | null; assignee: { name: string } | null; team: { name: string; members: { userId: string }[] } | null }, prefix = 'New') {
  if (!task.assigneeId) return;
  const urgent = task.priority === 'URGENT' ? 'URGENT ' : '';
  void notify([task.assigneeId], {
    type: 'TASK_ASSIGNED',
    title: `${prefix} ${urgent}task: ${task.title}`,
    body: `${task.team ? `You lead ${task.team.name} and file the report · ` : ''}${task.customerName} · ${task.address}`,
    data: { taskId: task.id },
  });
  const helpers = helpersOf(task);
  if (task.team && helpers.length) {
    void notify(helpers, {
      type: 'TASK_ASSIGNED',
      title: `${task.team.name}: ${urgent}${task.title}`,
      body: `${lead(task)} leads and files the report · ${task.customerName} · ${task.address}`,
      data: { taskId: task.id },
    });
  }
}

tasksRouter.post(
  '/',
  dispatchers,
  ah(async (req, res) => {
    mayMakeTeam(me(req).role, req.body?.newTeam);
    const { newTeam, teamId: _teamId, assigneeId: _assigneeId, assignLater, scheduledFor: day, ...fields } = parse(taskSchema, req.body);
    const scheduledFor = day ? new Date(`${day}T00:00:00Z`) : null;
    if (scheduledFor && scheduledFor < todayDate()) throw badRequest('Pick today or a later day');
    // For a later day: kept quiet until then (released by the morning run)
    const laterDay = !!scheduledFor && scheduledFor > todayDate();
    const body = { ...fields, scheduledFor, releasedAt: scheduledFor && !laterDay ? new Date() : null };
    // Nobody chosen and "assign later": the job waits, OPEN, until someone assigns it
    const later = !!assignLater && !newTeam && !_teamId && !_assigneeId;
    if (body.requestId) {
      const request = await prisma.serviceRequest.findUnique({ where: { id: body.requestId }, include: { task: true } });
      if (!request) throw badRequest('Service request not found');
      if (request.status === 'CLOSED' || request.task) throw conflict('This request already has a task or was closed');
      // The customer's phone said where they are: use it unless the manager pinned the job themselves
      if (body.lat == null && request.lat != null && request.lng != null) Object.assign(body, { lat: request.lat, lng: request.lng });
    }
    const create = () =>
      prisma.$transaction(async (tx) => {
        const who = later ? { assigneeId: null, teamId: null, status: 'OPEN' as const } : await resolveAssignment(tx, { newTeam, teamId: _teamId, assigneeId: _assigneeId }, me(req).id);
        const created = await tx.task.create({ data: { ...body, ...who, ...freshFollowUp(!!who.assigneeId && !laterDay), code: newCode(), createdById: me(req).id }, include: detailInclude });
        if (body.requestId) await tx.serviceRequest.update({ where: { id: body.requestId }, data: { status: 'SCHEDULED' } });
        return created;
      });
    const codeClash = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target ?? '').includes('code');
    const task = await create().catch((e) => (codeClash(e) ? create() : Promise.reject(e)));
    if (task.lat == null) void fillJobCoordinates(task.id, task.address);
    if (later) {
      await audit(me(req).id, 'TASK_CREATED', 'Task', task.id, `Created ${task.code} to assign later${laterDay ? ` for ${dayLabel(scheduledFor!)}` : ''}`);
      return void res.status(201).json({ task });
    }
    if (laterDay) {
      await audit(me(req).id, 'TASK_SCHEDULED', 'Task', task.id, `Scheduled ${task.code} for ${dayLabel(scheduledFor!)}${task.team ? ` (${task.team.name})` : ''}`);
      return void res.status(201).json({ task });
    }
    void notifyCustomer(task, {
      title: task.team ? 'A team has been assigned' : 'A technician has been assigned',
      body: `${task.team ? `${task.team.name}, led by ${lead(task)},` : lead(task)} will handle "${task.title}"${task.dueAt ? ` · due ${task.dueAt.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}` : ''}.`,
    });
    if (task.team) await audit(me(req).id, 'TASK_TEAM_ASSIGNED', 'Task', task.id, `Assigned ${task.code} to ${task.team.name} (leader ${lead(task)})`);
    announce(task);
    res.status(201).json({ task });
  }),
);

tasksRouter.patch(
  '/:id',
  dispatchers,
  ah(async (req, res) => {
    // Linking to a customer request is only allowed at creation, where it is validated.
    mayMakeTeam(me(req).role, req.body?.newTeam);
    const { newTeam, teamId, assigneeId, scheduledFor: day, ...fields } = parse(taskSchema.omit({ requestId: true }).partial(), req.body);
    const task = await loadTask(req.params.id);
    // Moving the day: to a later day it goes quiet again; to today it is given out now
    const newDay = day === undefined ? undefined : day ? new Date(`${day}T00:00:00Z`) : null;
    if (newDay && newDay < todayDate() && newDay.getTime() !== task.scheduledFor?.getTime()) throw badRequest('Pick today or a later day');
    const body = newDay === undefined ? fields : { ...fields, scheduledFor: newDay, releasedAt: newDay && newDay > todayDate() ? null : (task.releasedAt ?? new Date()) };
    const wasQuiet = !!task.scheduledFor && task.scheduledFor > todayDate();
    if (task.status !== 'ASSIGNED' && task.status !== 'OPEN') throw conflict('Only tasks that have not started can be edited or reassigned');
    // Assigning an OPEN job, or reassigning: to a new team, another team, or one technician (which ends the team job)
    const reassigning =
      task.status === 'OPEN'
        ? !!(newTeam || teamId || assigneeId)
        : !!newTeam || (teamId !== undefined && teamId !== task.teamId) || (!!assigneeId && assigneeId !== task.assigneeId && teamId === undefined);
    const updated = await prisma.$transaction(async (tx) => {
      const who = reassigning ? { ...(await resolveAssignment(tx, { newTeam, teamId, assigneeId: assigneeId ?? task.assigneeId ?? undefined }, me(req).id)), status: 'ASSIGNED' as const } : {};
      // A new address without a pin: forget the old pin and look the new address up
      const moved = body.address && body.address !== task.address && body.lat == null;
      // Given to someone (else): the follow-up starts over; a task moved to a later day waits for its morning
      const quiet = (newDay !== undefined ? newDay : task.scheduledFor) ? ((newDay !== undefined ? newDay : task.scheduledFor) as Date) > todayDate() : false;
      const follow = reassigning ? freshFollowUp(!quiet) : newDay !== undefined && !quiet && wasQuiet ? { assignedAt: new Date() } : {};
      return tx.task.update({ where: { id: task.id }, data: { ...(moved ? { ...body, lat: null, lng: null } : body), ...who, ...follow }, include: detailInclude });
    });
    if (body.address && body.address !== task.address && body.lat == null) void fillJobCoordinates(task.id, updated.address);
    const quietNow = !!updated.scheduledFor && updated.scheduledFor > todayDate();
    if (reassigning && (updated.assigneeId !== task.assigneeId || updated.teamId !== task.teamId)) {
      const from = task.team ? `${task.team.name} (${lead(task)})` : lead(task);
      const to = updated.team ? `${updated.team.name} (${lead(updated)})` : lead(updated);
      await audit(me(req).id, task.status === 'OPEN' ? 'TASK_ASSIGNED' : 'TASK_REASSIGNED', 'Task', task.id, task.status === 'OPEN' ? `Assigned ${task.code} to ${to}` : `Reassigned ${task.code} from ${from} to ${to}`);
      if (task.status === 'OPEN')
        void notifyCustomer(updated, { title: updated.team ? 'A team has been assigned' : 'A technician has been assigned', body: `${updated.team ? `${updated.team.name}, led by ${lead(updated)},` : lead(updated)} will handle "${updated.title}".` });
      if (!quietNow) announce(updated);
      const dropped = crewOf(task).filter((id) => !crewOf(updated).includes(id));
      if (dropped.length && !wasQuiet) void notify(dropped, { type: 'TASK_CANCELLED', title: `${task.code} reassigned`, body: 'This task was moved to another technician.', data: { taskId: task.id } });
    } else if (wasQuiet && !quietNow) announce(updated, 'Today');
    res.json({ task: updated });
  }),
);

/**
 * The technician cannot do an assigned task (customer away, no fibre at the FAT, …): it goes back to the
 * office to assign again, with their reason. This is how a task leaves their hands without a report.
 */
tasksRouter.post(
  '/:id/unable',
  ah(async (req, res) => {
    const user = me(req);
    const { reason } = parse(z.object({ reason: z.string().trim().min(5, 'Say why it cannot be done').max(500) }), req.body);
    const task = await loadTask(req.params.id);
    if (task.assigneeId !== user.id) throw forbidden(task.team ? `${lead(task)} leads ${task.team.name} and decides for this task` : 'This task is not assigned to you');
    if (task.status !== 'ASSIGNED' && task.status !== 'IN_PROGRESS') throw conflict(`Task is already ${task.status.toLowerCase().replace('_', ' ')}`);
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { status: 'OPEN', assigneeId: null, teamId: null, startedAt: null, startPhotoId: null, ...freshFollowUp(false), returnNote: `${user.name}: ${reason}` },
      include: detailInclude,
    });
    await audit(user.id, 'TASK_HANDED_BACK', 'Task', task.id, `${task.code} handed back: ${reason}`);
    void notifyRoles(['ADMIN', 'SUPERVISOR', 'CUSTOMER_CARE'], {
      type: 'TASK_REJECTED',
      title: `${user.name} could not do ${task.code}`,
      body: `${reason} · ${task.customerName} · back in To assign`,
      data: { taskId: task.id },
    });
    res.json({ task: updated });
  }),
);

/**
 * What stops a technician checking out: tasks given to them (they lead) that are not finished with their
 * report, and — once they have finished tasks today as the one who reports — the day's report.
 */
export async function checkoutBlockers(userId: string) {
  const open = await prisma.task.findMany({
    where: { assigneeId: userId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] }, ...notFuture() },
    select: { id: true, code: true, title: true, status: true, customerName: true },
    orderBy: { assignedAt: 'asc' },
  });
  const doneToday = await prisma.task.count({ where: { assigneeId: userId, status: { in: ['COMPLETED', 'VERIFIED'] }, endedAt: { gte: todayStart() } } });
  const report = doneToday ? await prisma.dayReport.findUnique({ where: { submittedById_workDate: { submittedById: userId, workDate: todayDate() } } }) : null;
  return { tasks: open, needsDayReport: doneToday > 0 && !report };
}

// ───────────────────────────── Tracking & dispatch ───────────────────

/** Follow the technician to the job: live position, trail, road route and arrival time. */
tasksRouter.get(
  '/:id/track',
  ah(async (req, res) => {
    const user = me(req);
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { team: { select: { members: { select: { userId: true } } } } } });
    if (!task) throw notFound('Task');
    if (!onCrew(task, user.id) && !ROLES.JOB_VIEWERS.includes(user.role)) throw forbidden();
    const { team: _team, ...plain } = task;
    res.json(await trackJob(plain));
  }),
);

/**
 * Technicians ranked by how quickly they could reach this job: free and checked-in people first, then by
 * driving time from where their phone (or today's GPS photo) last placed them.
 */
tasksRouter.get(
  '/:id/nearby',
  dispatchers,
  ah(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { id: true, lat: true, lng: true, assigneeId: true, status: true } });
    if (!task) throw notFound('Task');
    const techs = await prisma.user.findMany({
      where: { role: 'TECHNICIAN', active: true },
      select: {
        id: true,
        name: true,
        phone: true,
        staffNo: true,
        attendance: { where: { workDate: workDateOf() }, select: { checkInAt: true, checkOutAt: true } },
        tasksAssigned: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }, select: { status: true } },
      },
    });
    const where = await positionsOf(techs.map((t) => t.id));
    const site = task.lat != null && task.lng != null ? ([task.lat, task.lng] as [number, number]) : null;
    const rows = techs.map((t) => {
      const pos = where.get(t.id) ?? null;
      const today = t.attendance[0];
      const onDuty = !!today && !today.checkOutAt;
      const busy = t.tasksAssigned.some((x) => x.status === 'IN_PROGRESS');
      const distanceM = pos && site ? Math.round(distanceMetres(pos.lat, pos.lng, site[0], site[1])) : null;
      return {
        user: { id: t.id, name: t.name, phone: t.phone, staffNo: t.staffNo },
        current: t.id === task.assigneeId,
        onDuty,
        busy,
        openJobs: t.tasksAssigned.length,
        position: pos ? { lat: pos.lat, lng: pos.lng, at: pos.at.toISOString(), kind: pos.kind } : null,
        distanceKm: distanceM == null ? null : Math.round(distanceM / 100) / 10,
        etaMinutes: pos && site ? estimateMinutes([pos.lat, pos.lng], site) : null,
      };
    });
    // Free and on duty before busy or off duty; then the closest; people we cannot place go last
    const rank = (r: (typeof rows)[number]) => (r.onDuty ? 0 : 2) + (r.busy ? 1 : 0);
    rows.sort((a, b) => rank(a) - rank(b) || (a.etaMinutes ?? 1e9) - (b.etaMinutes ?? 1e9) || a.openJobs - b.openJobs);
    const best = rows.find((r) => !r.current && r.onDuty && !r.busy && r.etaMinutes != null) ?? null;
    res.json({ job: { id: task.id, lat: task.lat, lng: task.lng, status: task.status }, suggestedId: best?.user.id ?? null, technicians: rows });
  }),
);

/** Hand a job that has not started to another technician (usually the nearest one). */
tasksRouter.post(
  '/:id/forward',
  dispatchers,
  ah(async (req, res) => {
    const body = parse(z.object({ technicianId: z.string().min(1), note: z.string().trim().max(300).optional() }), req.body);
    const task = await loadTask(req.params.id);
    if (task.status !== 'ASSIGNED' && task.status !== 'OPEN') throw conflict('Only tasks that have not started can be forwarded', 'NOT_FORWARDABLE');
    if (body.technicianId === task.assigneeId) throw badRequest(`${lead(task)} already has this task`);
    const tech = await prisma.user.findUnique({ where: { id: body.technicianId } });
    if (!tech?.active || tech.role !== 'TECHNICIAN') throw badRequest('Tasks can only go to active technicians');
    // Guarded so two managers forwarding at once cannot both win
    // Forwarding gives the job to one technician, so a team job stops being a team job
    const { count } = await prisma.task.updateMany({ where: { id: task.id, status: task.status, assigneeId: task.assigneeId }, data: { assigneeId: tech.id, teamId: null, status: 'ASSIGNED', ...freshFollowUp(true) } });
    if (!count) throw conflict('This task changed while you were looking. Refresh and try again.', 'STALE');
    const updated = await loadTask(task.id);
    await audit(me(req).id, 'TASK_FORWARDED', 'Task', task.id, `Forwarded ${task.code} from ${lead(task)} to ${tech.name}${body.note ? `: ${body.note}` : ''}`);
    void notify([tech.id], {
      type: 'TASK_ASSIGNED',
      title: `Task forwarded to you: ${task.title}`,
      body: `${task.customerName} · ${task.address}${body.note ? ` — ${body.note}` : ''}`,
      data: { taskId: task.id },
    });
    void notify(crewOf(task).filter((id) => id !== tech.id), { type: 'TASK_CANCELLED', title: `${task.code} moved to ${tech.name}`, body: 'A closer technician will handle this task.', data: { taskId: task.id } });
    void notifyCustomer(updated, { title: 'Your technician has changed', body: `${tech.name} is now handling "${task.title}".` });
    res.json({ task: updated });
  }),
);

tasksRouter.post(
  '/:id/cancel',
  managers,
  ah(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(task.status)) throw conflict(`A ${task.status.toLowerCase()} task cannot be cancelled`);
    const updated = await prisma.$transaction(async (tx) => {
      // A cancelled job releases its customer request so it can be rescheduled.
      if (task.requestId) await tx.serviceRequest.update({ where: { id: task.requestId }, data: { status: 'OPEN' } });
      return tx.task.update({ where: { id: task.id }, data: { status: 'CANCELLED', requestId: null }, include: detailInclude });
    });
    void notify(crewOf(task), { type: 'TASK_CANCELLED', title: `${task.code} cancelled`, body: task.title, data: { taskId: task.id } });
    await audit(me(req).id, 'TASK_CANCELLED', 'Task', task.id, `Cancelled ${task.code} (${task.title})`);
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
    await audit(me(req).id, `TASK_${body.decision}`, 'Task', task.id, `${body.decision === 'VERIFIED' ? 'Verified' : 'Rejected'} ${task.code}${body.note ? `: ${body.note}` : ''}`);
    void notify(crewOf(task), {
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
    mustBeAssignee(task, userId);
    if (task.status !== 'ASSIGNED') throw conflict(`Task is already ${task.status.toLowerCase().replace('_', ' ')}`);
    if (task.scheduledFor && task.scheduledFor > todayDate()) throw conflict(`This task is for ${dayLabel(task.scheduledFor)}`, 'NOT_YET');

    // A job started offline counts for the day it was really started, even if it is sent later
    const startedAt = await eventTime(photoId);
    const attendance = await prisma.attendance.findUnique({ where: { userId_workDate: { userId, workDate: workDateOf(startedAt) } } });
    if (!attendance) throw conflict('Check in for the day before starting a task', 'NOT_CHECKED_IN');
    if (attendance.checkOutAt && attendance.checkOutAt < startedAt) throw conflict('You have already checked out for the day', 'CHECKED_OUT');

    const busy = await prisma.task.findFirst({ where: { assigneeId: userId, status: 'IN_PROGRESS' } });
    if (busy) throw conflict(`Finish ${busy.code} before starting another task`, 'TASK_IN_PROGRESS');

    await prisma.$transaction(async (tx) => {
      await consumePhoto(tx, photoId, userId, 'TASK_START', task.id);
      await tx.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', startedAt, startPhotoId: photoId } });
    });
    void notifyCustomer(task, { title: 'Your technician has started', body: `${task.team ? `${task.team.name}, led by ${lead(task)}, is` : `${lead(task)} is`} now working on "${task.title}".` });
    if (helpersOf(task).length) void notify(helpersOf(task), { type: 'JOB_UPDATE', title: `${task.code} started`, body: `${lead(task)} started the task for ${task.team!.name}.`, data: { taskId: task.id } });
    res.json({ task: await loadTask(task.id) });
  }),
);

const completeSchema = z.object({
  photoId: z.string().min(1),
  // The task report, filed after the completion photo. Older app versions send one text in notes.
  report: taskReportSchema.optional(),
  notes: z.string().trim().max(4000).optional(),
  customerAccount: z.string().trim().optional(),
  amountCollected: z.number().int().min(0).optional(),
  /** The task report: router signal as read on site, house number, drop cable used (m), FAT already there */
  signal: z.string().trim().max(20).optional(),
  houseNo: z.string().trim().max(40).optional(),
  dropCableM: z.number().min(0).max(5000).optional(),
  /** The length marks printed on the drop cable where the run started and ended; their difference is the cable used */
  dropStartM: z.number().min(0).max(100_000).optional(),
  dropEndM: z.number().min(0).max(100_000).optional(),
  fatPreinstalled: z.boolean().optional(),
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
    mustBeAssignee(task, userId);
    if (task.status !== 'IN_PROGRESS' || !task.startedAt) throw conflict('Start the task before completing it');
    if (task.type === 'INSTALLATION' && body.serials.length === 0) {
      throw badRequest('Enter the serial number (SN) of the router/ONT installed for this customer', 'SERIAL_REQUIRED');
    }
    if (task.type === 'INSTALLATION' && !body.signature) {
      throw badRequest('Ask the customer to sign to confirm the installation', 'SIGNATURE_REQUIRED');
    }
    // Never completed on the photos alone: a real report of the work is required (the photo is not used up).
    let notes: string;
    if (body.report) {
      const problem = taskReportProblem(body.report);
      if (problem) throw badRequest(problem, 'REPORT_REQUIRED');
      notes = taskReportText(body.report);
    } else {
      const problem = reportProblem(body.notes ?? '', 'Task report', NOTES_MIN_WORDS);
      if (problem) throw badRequest(`${problem}. Update the app to file the full task report.`, 'REPORT_REQUIRED');
      notes = body.notes!;
    }

    const customerAccount = body.customerAccount || task.customerAccount;
    const endedAt = await eventTime(body.photoId);

    await prisma.$transaction(async (tx) => {
      await consumePhoto(tx, body.photoId, userId, 'TASK_END', task.id);

      for (const serial of body.serials) {
        // The device installed: an admin approves it before it leaves the technician's stock (an admin's own counts now)
        const unit =
          me(req).role === 'ADMIN'
            ? await installSerial(tx, userId, serial, { id: task.id, customerAccount: customerAccount ?? null })
            : await requireHeldUnit(tx, userId, serial);
        if (me(req).role !== 'ADMIN') {
          await fileRequest(tx, 'INSTALL', me(req), { serial: unit.serialNumber, customerAccount: customerAccount ?? null, taskId: task.id }, {
            summary: `Install ${unit.serialNumber} (${unit.item.name}) at ${customerAccount ?? task.customerName} — task ${task.code}`,
            serialUnitId: unit.id,
            taskId: task.id,
          });
        }
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
          completionNotes: notes,
          amountCollected: body.amountCollected,
          signal: body.signal || undefined,
          houseNo: body.houseNo || undefined,
          dropCableM: cableUsed(body),
          dropStartM: body.dropStartM,
          dropEndM: body.dropEndM,
          fatPreinstalled: body.fatPreinstalled,
          customerAccount,
          customerSignature: body.signature?.path,
          signedByName: body.signature?.signedBy,
          signedAt: body.signature ? endedAt : undefined,
        },
      });
    });
    if (body.serials.length && me(req).role !== 'ADMIN') tellAdmins(me(req), `${body.serials.length} device(s) installed on task ${task.code} (${task.customerName}) — approve to move them to Installed`);
    void notifyCustomer(task, { title: 'Task completed', body: `"${task.title}" was completed by ${lead(task)}. Thank you for choosing Optimas.` });
    // The job report goes to the office: supervisors, admins and customer care
    void notifyRoles(['SUPERVISOR', 'ADMIN', 'CUSTOMER_CARE'], {
      type: 'TASK_COMPLETED',
      title: `${task.code} completed by ${task.team ? `${task.team.name} (${lead(task)})` : lead(task)}`,
      body: `${task.customerName} · ${minutesBetween(task.startedAt!, endedAt)} min — awaiting verification`,
      data: { taskId: task.id },
    });
    res.json({ task: await loadTask(task.id) });
  }),
);
