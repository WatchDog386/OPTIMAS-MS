import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { forbidden, notFound } from '../../lib/http-error';
import { time, workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { notifyRoles } from '../notifications/notifications.service';

/*
 * The end-of-day report. Once their tasks are done (started and finished with photos, each with its task
 * report), a technician sends the office one report for the day; on team tasks the team leader sends it
 * for the whole team. It is put together from the task reports — members, then each task with its
 * location, status, signal, what the client paid, materials, drop cable and whether the FAT was already
 * there — and a summary, in the layout the office already uses on WhatsApp.
 */

export const dayReportsRouter = Router();

const taskInclude = {
  team: { select: { id: true, name: true, leaderId: true, members: { select: { user: { select: { id: true, name: true } } } } } },
  assignee: { select: { id: true, name: true } },
  materials: { include: { item: { select: { name: true, unit: true, tracking: true } }, unit: { select: { serialNumber: true } } } },
} as const;

const kes = (n: number) => `KES ${n.toLocaleString('en-KE')}`;
const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const mins = (m?: number | null) => (m == null ? '' : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const dayStart = (d: Date) => new Date(d.getTime() - env.TZ_OFFSET_MINUTES * 60_000);

async function todaysTasks(userId: string, workDate: Date) {
  const from = dayStart(workDate);
  const to = new Date(from.getTime() + 24 * 3600_000);
  return prisma.task.findMany({
    where: { assigneeId: userId, status: { in: ['COMPLETED', 'VERIFIED'] }, endedAt: { gte: from, lt: to } },
    include: taskInclude,
    orderBy: { endedAt: 'asc' },
  });
}
type DayTask = Awaited<ReturnType<typeof todaysTasks>>[number];

/** Builds the day's report for this person: their tasks finished today, or their team's. */
async function buildReport(user: { id: string; name: string }, workDate = workDateOf()) {
  const tasks = await todaysTasks(user.id, workDate);
  // A team member who is not the leader: the leader sends the team's report
  if (!tasks.length) {
    const from = dayStart(workDate);
    const teamTask = await prisma.task.findFirst({
      where: { team: { members: { some: { userId: user.id } } }, assigneeId: { not: user.id }, status: { in: ['COMPLETED', 'VERIFIED'] }, endedAt: { gte: from } },
      include: { assignee: { select: { name: true } }, team: { select: { name: true } } },
    });
    if (teamTask) return { canSubmit: false as const, reason: `${teamTask.assignee?.name ?? 'Your team leader'} leads ${teamTask.team?.name ?? 'your team'} and sends the team's report.`, tasks: [] as DayTask[] };
  }
  const team = tasks.find((t) => t.team)?.team ?? null;
  const members = team ? [...new Map([[user.id, user.name], ...team.members.map((m) => [m.user.id, m.user.name] as [string, string])]).entries()].map(([id, name]) => ({ id, name, leader: id === user.id })) : [];
  const collected = tasks.reduce((n, t) => n + (t.amountCollected ?? 0), 0);
  const cable = tasks.reduce((n, t) => n + (t.dropCableM ?? 0), 0);
  const routers = tasks.reduce((n, t) => n + t.materials.filter((m) => m.unit).length, 0);
  const date = new Date(dayStart(workDate).getTime() + 12 * 3600_000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

  const lines: string[] = [];
  lines.push(`*Daily report — ${team ? team.name : user.name}*`);
  lines.push(`${date} · sent by ${user.name}${team ? ' (team leader)' : ''}`);
  if (team) {
    lines.push('', '*Members*');
    members.forEach((m, i) => lines.push(`${i + 1}. ${m.name}${m.leader ? ' (leader)' : ''}`));
  }
  tasks.forEach((t, i) => {
    lines.push('', `*Task ${i + 1} — ${humanize(t.type)}* · ${t.code}`);
    lines.push(`Customer: ${t.customerName}${t.customerPhone ? ` · ${t.customerPhone}` : ''}`);
    lines.push(`Location: ${t.address}${t.houseNo ? ` · House ${t.houseNo}` : ''}`);
    lines.push(`Status: ${t.status === 'VERIFIED' ? 'Complete · verified' : 'Complete'}${t.endedAt ? ` at ${time(t.endedAt)}` : ''}${t.durationMinutes != null ? ` (${mins(t.durationMinutes)})` : ''}`);
    if (t.signal) lines.push(`Signal: ${t.signal}`);
    lines.push(`Client paid: ${t.amountCollected ? kes(t.amountCollected) : 'Nothing'}`);
    if (t.materials.length) {
      lines.push('Materials used:');
      // Devices one by one with their SN; bulk items with their quantity
      t.materials.forEach((m, k) => lines.push(`  ${k + 1}. ${m.unit ? `1 ${m.item.name} (SN ${m.unit.serialNumber})` : `${qty(m.quantity)} ${m.item.unit === 'pcs' || m.item.unit === 'pc' ? '' : `${m.item.unit} `}${m.item.name}`.replace(/\s+/g, ' ')}`));
    } else lines.push('Materials used: none');
    lines.push(`Drop cable: ${t.dropCableM != null ? `${qty(t.dropCableM)} m` : 'not recorded'}`);
    lines.push(`FAT pre-installed: ${t.fatPreinstalled == null ? 'not recorded' : t.fatPreinstalled ? 'Yes' : 'No'}`);
    if (t.completionNotes) lines.push(`Notes: ${t.completionNotes}`);
  });
  lines.push('', '*Summary*');
  lines.push(`Tasks completed: ${tasks.length}`);
  lines.push(`Client paid in total: ${kes(collected)}`);
  lines.push(`Drop cable used: ${qty(cable)} m · Routers installed: ${routers}`);

  return {
    canSubmit: tasks.length > 0,
    reason: tasks.length ? null : 'No tasks finished today yet. Finish a task (with its report) first.',
    workDate,
    team: team ? { id: team.id, name: team.name } : null,
    members,
    tasks,
    collected,
    cable,
    routers,
    text: lines.join('\n'),
  };
}

const view = (r: Awaited<ReturnType<typeof buildReport>>) => ({
  canSubmit: r.canSubmit,
  reason: r.reason,
  team: 'team' in r ? r.team : null,
  members: 'members' in r ? r.members : [],
  text: 'text' in r ? r.text : '',
  tasksDone: r.tasks.length,
  collected: 'collected' in r ? r.collected : 0,
  cable: 'cable' in r ? r.cable : 0,
  routers: 'routers' in r ? r.routers : 0,
  tasks: r.tasks.map((t) => ({ id: t.id, code: t.code, type: t.type, customerName: t.customerName, address: t.address, houseNo: t.houseNo, signal: t.signal, amountCollected: t.amountCollected, dropCableM: t.dropCableM, fatPreinstalled: t.fatPreinstalled, status: t.status })),
});

/** The day's report as it stands now, and whether it was already sent today. */
dayReportsRouter.get(
  '/mine',
  ah(async (req, res) => {
    const user = me(req);
    const r = await buildReport(user);
    const sent = await prisma.dayReport.findUnique({ where: { submittedById_workDate: { submittedById: user.id, workDate: workDateOf() } } });
    res.json({ report: view(r), sent: sent ? { id: sent.id, at: sent.updatedAt, tasksDone: sent.tasksDone } : null });
  }),
);

const submitSchema = z.object({ note: z.string().trim().max(1000).optional() });

/** Sends the day's report to the admins (sending again the same day replaces it). */
dayReportsRouter.post(
  '/',
  ah(async (req, res) => {
    const user = me(req);
    if (user.role !== 'TECHNICIAN' && user.role !== 'ADMIN' && user.role !== 'SUPERVISOR') throw forbidden('Only technicians send day reports');
    const { note } = parse(submitSchema, req.body);
    const r = await buildReport(user);
    if (!r.canSubmit || !('text' in r)) throw forbidden(r.reason ?? 'Nothing to report yet');
    const text = note ? `${r.text}\n\n*Comments*\n${note}` : r.text;
    const workDate = workDateOf();
    const data = { text, teamId: r.team?.id ?? null, taskIds: r.tasks.map((t) => t.id), tasksDone: r.tasks.length, collected: r.collected };
    const saved = await prisma.dayReport.upsert({
      where: { submittedById_workDate: { submittedById: user.id, workDate } },
      create: { ...data, workDate, submittedById: user.id },
      update: data,
    });
    void notifyRoles(['ADMIN', 'SUPERVISOR'], {
      type: 'DAY_REPORT',
      title: `Daily report — ${r.team ? `${r.team.name} (${user.name})` : user.name}`,
      body: `${r.tasks.length} task${r.tasks.length === 1 ? '' : 's'} completed · client paid ${kes(r.collected)} · ${qty(r.cable)} m drop cable`,
      data: { dayReportId: saved.id },
    }, user.id);
    await audit(user.id, 'DAY_REPORT_SENT', 'DayReport', saved.id, `${r.tasks.length} tasks · ${kes(r.collected)}`);
    res.status(201).json({ report: saved });
  }),
);

/** The office: reports sent on a day (default today), newest first. */
dayReportsRouter.get(
  '/',
  ah(async (req, res) => {
    if (!ROLES.MANAGERS.includes(me(req).role)) throw forbidden('Only the office reads day reports');
    const q = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? new Date(`${req.query.date}T00:00:00Z`) : workDateOf();
    const reports = await prisma.dayReport.findMany({
      where: { workDate: q },
      include: { submittedBy: { select: { id: true, name: true, staffNo: true } }, team: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ date: q.toISOString().slice(0, 10), reports });
  }),
);

dayReportsRouter.get(
  '/:id',
  ah(async (req, res) => {
    const r = await prisma.dayReport.findUnique({
      where: { id: req.params.id },
      include: { submittedBy: { select: { id: true, name: true, staffNo: true, phone: true } }, team: { select: { id: true, name: true } } },
    });
    if (!r) throw notFound('Report');
    if (r.submittedById !== me(req).id && !ROLES.MANAGERS.includes(me(req).role)) throw forbidden('Not your report');
    res.json({ report: r });
  }),
);
