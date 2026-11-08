import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { codeVariants, matchUnit } from './inventory.service';

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
      select: { holderId: true, serialNumber: true, macAddress: true, status: true, heldSince: true, item: { select: { name: true } } },
    }),
    prisma.bulkHolding.findMany({ where: { quantity: { gt: 0 } }, include: { item: { select: { name: true, unit: true } } } }),
    prisma.stockCount.findMany({ orderBy: { createdAt: 'desc' }, distinct: ['userId'] }),
  ]);

  // Devices a past count flagged as "not on record" that are installed at a customer now
  const flagged = [...new Set(counts.flatMap((c) => c.unexpected.flatMap((u) => codeVariants(u))))];
  const installedNow = new Set(
    flagged.length ? (await prisma.serialUnit.findMany({ where: { serialNumber: { in: flagged }, status: 'INSTALLED' }, select: { serialNumber: true } })).map((u) => u.serialNumber) : [],
  );

  const alertBefore = Date.now() - env.CUSTODY_AGE_ALERT_DAYS * DAY_MS;
  const report = techs.map((t) => {
    const tally = (type: string, dir: 'to' | 'from') =>
      moves.filter((m) => m.type === type && (dir === 'to' ? m.toUserId : m.fromUserId) === t.id).length;
    const inHand = held.filter((h) => h.holderId === t.id);
    const overdue = inHand.filter((h) => h.heldSince && h.heldSince.getTime() < alertBefore);
    const raw = counts.find((c) => c.userId === t.id);
    // The last count as it stands today: a device it found missing that has since been installed,
    // returned or marked lost is no longer missing; a code it did not recognise that is one of their
    // devices (written another way) or is installed at a customer is not a mismatch
    const lastCount = raw
      ? {
          ...raw,
          missing: raw.missing.filter((s) => inHand.some((h) => h.serialNumber === s)),
          unexpected: raw.unexpected.filter((u) => !matchUnit(inHand, u) && !codeVariants(u).some((v) => installedNow.has(v))),
        }
      : null;
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
