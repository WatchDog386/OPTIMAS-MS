import { Router, type Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/http-error';
import { time, workDateOf } from '../../lib/time';
import { ah } from '../../middleware/async';
import { ROLES, requireRole } from '../../middleware/auth';
import { buildReconciliation } from '../inventory/reconciliation';

/** Excel exports for payroll, audits and management reporting. */
export const exportsRouter = Router();
exportsRouter.use(requireRole(ROLES.STORE));

const DAY_MS = 86_400_000;
const BRAND = 'FF0E1730';
const ACCENT = 'FFB8F53B';

/** Parses ?from=YYYY-MM-DD&to=YYYY-MM-DD (company dates, inclusive). Defaults to the last 30 days. */
function range(q: Record<string, unknown>) {
  const parseDay = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : undefined);
  const to = parseDay(q.to) ?? workDateOf();
  const from = parseDay(q.from) ?? new Date(to.getTime() - 29 * DAY_MS);
  if (from > to) throw badRequest('"from" must be before "to"');
  if (to.getTime() - from.getTime() > 366 * DAY_MS) throw badRequest('Export at most one year at a time');
  return { from, to, label: `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}` };
}

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number }[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ ...c, width: c.width ?? 16 }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: ACCENT } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  header.height = 22;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

async function send(res: Response, wb: ExcelJS.Workbook, filename: string) {
  wb.creator = 'Optimas MS';
  wb.created = new Date();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

const hours = (m?: number | null) => (m == null ? null : Math.round((m / 60) * 100) / 100);

exportsRouter.get(
  '/attendance.xlsx',
  ah(async (req, res) => {
    const { from, to, label } = range(req.query);
    const records = await prisma.attendance.findMany({
      where: { workDate: { gte: from, lte: to } },
      orderBy: [{ workDate: 'asc' }, { checkInAt: 'asc' }],
      include: {
        user: { select: { name: true, staffNo: true, role: true } },
        reviewedBy: { select: { name: true } },
        checkInPhoto: { select: { flags: true } },
        checkOutPhoto: { select: { flags: true } },
      },
    });
    const wb = new ExcelJS.Workbook();
    const ws = sheet(wb, 'Attendance', [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Staff no.', key: 'staffNo', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Check in', key: 'in', width: 10 },
      { header: 'Check out', key: 'out', width: 10 },
      { header: 'Hours worked', key: 'hours', width: 13 },
      { header: 'Dress code', key: 'dress', width: 12 },
      { header: 'Reviewed by', key: 'reviewer', width: 18 },
      { header: 'Review note', key: 'note', width: 30 },
      { header: 'Photo flags', key: 'flags', width: 30 },
    ]);
    for (const r of records) {
      ws.addRow({
        date: r.workDate.toISOString().slice(0, 10),
        staffNo: r.user.staffNo,
        name: r.user.name,
        status: r.status,
        in: time(r.checkInAt),
        out: r.checkOutAt ? time(r.checkOutAt) : '',
        hours: hours(r.workedMinutes),
        dress: r.dressReview,
        reviewer: r.reviewedBy?.name ?? '',
        note: r.reviewNote ?? '',
        flags: [...new Set([...r.checkInPhoto.flags, ...(r.checkOutPhoto?.flags ?? [])])].join(', '),
      });
    }

    // Per-person summary for payroll.
    const summary = sheet(wb, 'Summary', [
      { header: 'Staff no.', key: 'staffNo', width: 14 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Days present', key: 'days', width: 13 },
      { header: 'Days late', key: 'late', width: 11 },
      { header: 'Hours worked', key: 'hours', width: 13 },
      { header: 'Dress-code rejections', key: 'rejected', width: 20 },
    ]);
    const byUser = new Map<string, { staffNo: string; name: string; days: number; late: number; minutes: number; rejected: number }>();
    for (const r of records) {
      const s = byUser.get(r.userId) ?? { staffNo: r.user.staffNo, name: r.user.name, days: 0, late: 0, minutes: 0, rejected: 0 };
      s.days++;
      if (r.status === 'LATE') s.late++;
      s.minutes += r.workedMinutes ?? 0;
      if (r.dressReview === 'REJECTED') s.rejected++;
      byUser.set(r.userId, s);
    }
    for (const s of byUser.values()) summary.addRow({ ...s, hours: hours(s.minutes) });

    await send(res, wb, `optimas-attendance_${label}.xlsx`);
  }),
);

exportsRouter.get(
  '/jobs.xlsx',
  ah(async (req, res) => {
    const { from, to } = range(req.query);
    const label = `${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}`;
    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: from, lt: new Date(to.getTime() + DAY_MS) } },
      orderBy: { createdAt: 'asc' },
      include: {
        assignee: { select: { name: true, staffNo: true } },
        team: { select: { name: true, members: { select: { user: { select: { name: true } } } } } },
        verifiedBy: { select: { name: true } },
        materials: { include: { item: { select: { name: true, unit: true } }, unit: { select: { serialNumber: true } } } },
      },
    });
    const wb = new ExcelJS.Workbook();
    const ws = sheet(wb, 'Jobs', [
      { header: 'Job', key: 'code', width: 18 },
      { header: 'Created', key: 'created', width: 17 },
      { header: 'Type', key: 'type', width: 13 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Technician', key: 'tech', width: 20 },
      { header: 'Team (members)', key: 'team', width: 30 },
      { header: 'Customer', key: 'customer', width: 24 },
      { header: 'Account', key: 'account', width: 15 },
      { header: 'Started', key: 'started', width: 10 },
      { header: 'Finished', key: 'finished', width: 10 },
      { header: 'Duration (min)', key: 'duration', width: 14 },
      { header: 'Devices installed', key: 'serials', width: 22 },
      { header: 'Materials value (KES)', key: 'materials', width: 20 },
      { header: 'Collected (KES)', key: 'collected', width: 16 },
      { header: 'Customer signed', key: 'signed', width: 18 },
      { header: 'Verified by', key: 'verifier', width: 18 },
    ]);
    const lines = sheet(wb, 'Materials', [
      { header: 'Job', key: 'code', width: 18 },
      { header: 'Technician', key: 'tech', width: 20 },
      { header: 'Item', key: 'item', width: 30 },
      { header: 'Serial', key: 'serial', width: 16 },
      { header: 'Quantity', key: 'qty', width: 10 },
      { header: 'Unit', key: 'unit', width: 8 },
      { header: 'Unit price (KES)', key: 'price', width: 15 },
      { header: 'Amount (KES)', key: 'amount', width: 14 },
    ]);
    for (const t of tasks) {
      ws.addRow({
        code: t.code,
        created: `${t.createdAt.toISOString().slice(0, 10)} ${time(t.createdAt)}`,
        type: t.type,
        priority: t.priority,
        status: t.status,
        tech: t.assignee.name,
        team: t.team ? `${t.team.name} (${t.team.members.map((m) => m.user.name).join(', ')})` : '',
        customer: t.customerName,
        account: t.customerAccount ?? '',
        started: t.startedAt ? time(t.startedAt) : '',
        finished: t.endedAt ? time(t.endedAt) : '',
        duration: t.durationMinutes,
        serials: t.materials.filter((m) => m.unit).map((m) => m.unit!.serialNumber).join(', '),
        materials: t.materials.reduce((n, m) => n + m.amount, 0),
        collected: t.amountCollected,
        signed: t.signedByName ?? '',
        verifier: t.verifiedBy?.name ?? '',
      });
      for (const m of t.materials) {
        lines.addRow({
          code: t.code,
          tech: t.assignee.name,
          item: m.item.name,
          serial: m.unit?.serialNumber ?? '',
          qty: m.quantity,
          unit: m.item.unit,
          price: m.unitPrice,
          amount: m.amount,
        });
      }
    }
    await send(res, wb, `optimas-jobs_${label}.xlsx`);
  }),
);

exportsRouter.get(
  '/reconciliation.xlsx',
  ah(async (_req, res) => {
    const report = await buildReconciliation();
    const wb = new ExcelJS.Workbook();
    const ws = sheet(wb, 'Reconciliation', [
      { header: 'Staff no.', key: 'staffNo', width: 14 },
      { header: 'Technician', key: 'name', width: 22 },
      { header: 'Issued', key: 'issued', width: 9 },
      { header: 'Installed', key: 'installed', width: 10 },
      { header: 'Returned', key: 'returned', width: 10 },
      { header: 'Lost', key: 'lost', width: 8 },
      { header: 'In hand', key: 'inHand', width: 9 },
      { header: 'Unconfirmed', key: 'pending', width: 12 },
      { header: 'Overdue serials', key: 'overdue', width: 28 },
      { header: 'Missing at last count', key: 'missing', width: 26 },
      { header: 'Materials in hand', key: 'bulk', width: 40 },
      { header: 'Risk', key: 'risk', width: 9 },
    ]);
    for (const r of report.technicians) {
      const row = ws.addRow({
        staffNo: r.technician.staffNo,
        name: r.technician.name,
        ...r.serialised,
        pending: r.serialised.pendingAcceptance,
        overdue: r.serialised.overdue.map((o) => o.serialNumber).join(', '),
        missing: r.lastCount?.missing.join(', ') ?? '',
        bulk: r.bulkInHand.map((b) => `${b.quantity} ${b.unit} ${b.name}`).join('; '),
        risk: r.risk,
      });
      if (r.risk === 'HIGH') row.getCell('risk').font = { bold: true, color: { argb: 'FFD7263D' } };
    }

    const units = await prisma.serialUnit.findMany({
      orderBy: [{ status: 'asc' }, { serialNumber: 'asc' }],
      include: { item: { select: { name: true } }, holder: { select: { name: true } }, task: { select: { code: true } } },
    });
    const devices = sheet(wb, 'Devices', [
      { header: 'Serial', key: 'serial', width: 16 },
      { header: 'Model', key: 'model', width: 28 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Holder', key: 'holder', width: 20 },
      { header: 'Held since', key: 'since', width: 12 },
      { header: 'Customer account', key: 'account', width: 18 },
      { header: 'Job', key: 'job', width: 18 },
    ]);
    for (const u of units) {
      devices.addRow({
        serial: u.serialNumber,
        model: u.item.name,
        status: u.status,
        holder: u.holder?.name ?? '',
        since: u.heldSince?.toISOString().slice(0, 10) ?? '',
        account: u.customerAccount ?? '',
        job: u.task?.code ?? '',
      });
    }
    await send(res, wb, `optimas-reconciliation_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }),
);
