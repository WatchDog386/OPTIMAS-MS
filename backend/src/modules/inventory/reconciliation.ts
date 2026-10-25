import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const DAY_MS = 86_400_000;

export type ReconciliationReport = Awaited<ReturnType<typeof buildReconciliation>>;

/**
 * For every technician: what was issued vs. what is accounted for (installed / returned / lost)
 * vs. what is still in hand, plus overdue units and the last stock count.
 */
export async function buildReconciliation() {
  const techs = await prisma.user.findMany({ where: { role: 'TECHNICIAN' }, orderBy: { name: 'asc' } });
  const [moves, held, bulk, counts] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { serialUnitId: { not: null }, type: { in: ['ISSUE', 'INSTALL', 'RETURN', 'REPORT_FAULTY', 'REPORT_LOST'] } },
      select: { type: true, toUserId: true, fromUserId: true },
    }),
    prisma.serialUnit.findMany({
      where: { status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } },
      select: { holderId: true, serialNumber: true, status: true, heldSince: true, item: { select: { name: true } } },
    }),
    prisma.bulkHolding.findMany({ where: { quantity: { gt: 0 } }, include: { item: { select: { name: true, unit: true } } } }),
    prisma.stockCount.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['userId'] }),
  ]);

  const alertBefore = Date.now() - env.CUSTODY_AGE_ALERT_DAYS * DAY_MS;
  const report = techs.map((t) => {
    const tally = (type: string, dir: 'to' | 'from') =>
      moves.filter((m) => m.type === type && (dir === 'to' ? m.toUserId : m.fromUserId) === t.id).length;
    const inHand = held.filter((h) => h.holderId === t.id);
    const overdue = inHand.filter((h) => h.heldSince && h.heldSince.getTime() < alertBefore);
    const lastCount = counts.find((c) => c.userId === t.id);
    return {
      technician: { id: t.id, name: t.name, staffNo: t.staffNo },
      serialised: {
        issued: tally('ISSUE', 'to'),
        installed: tally('INSTALL', 'from'),
        returned: tally('RETURN', 'from') + tally('REPORT_FAULTY', 'from'),
        lost: tally('REPORT_LOST', 'from'),
        inHand: inHand.length,
        pendingAcceptance: inHand.filter((h) => h.status === 'IN_TRANSIT').length,
        overdue: overdue.map((o) => ({ serialNumber: o.serialNumber, name: o.item.name, heldSince: o.heldSince })),
      },
      bulkInHand: bulk
        .filter((b) => b.userId === t.id)
        .map((b) => ({ name: b.item.name, unit: b.item.unit, quantity: b.quantity })),
      lastCount: lastCount
        ? { at: lastCount.createdAt, missing: lastCount.missing, unexpected: lastCount.unexpected }
        : null,
      risk:
        overdue.length > 0 || (lastCount?.missing.length ?? 0) > 0 || tally('REPORT_LOST', 'from') > 0 ? 'HIGH' : inHand.length ? 'NORMAL' : 'CLEAR',
    };
  });
  return { generatedAt: new Date(), ageAlertDays: env.CUSTODY_AGE_ALERT_DAYS, technicians: report };
}
