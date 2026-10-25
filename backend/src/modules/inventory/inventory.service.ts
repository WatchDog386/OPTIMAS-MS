import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { badRequest, conflict, notFound } from '../../lib/http-error';

type Tx = Prisma.TransactionClient;

const CUSTODY = ['IN_TRANSIT', 'WITH_TECHNICIAN'] as const;
const normalise = (serials: string[]) => [...new Set(serials.map((s) => s.trim().toUpperCase()).filter(Boolean))];

async function unitsBySerial(tx: Tx, serials: string[]) {
  const list = normalise(serials);
  const units = await tx.serialUnit.findMany({ where: { serialNumber: { in: list } }, include: { item: true } });
  const found = new Set(units.map((u) => u.serialNumber));
  const unknown = list.filter((s) => !found.has(s));
  if (unknown.length) throw notFound(`Serial number(s) ${unknown.join(', ')}`);
  return units;
}

async function requireTechnician(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) throw notFound('Staff member');
  return user;
}

// ───────────────────────────── Receiving ─────────────────────────────

export async function receiveStock(
  tx: Tx,
  actorId: string,
  input: { itemId: string; quantity?: number; serials?: { serialNumber: string; macAddress?: string }[]; note?: string },
) {
  const item = await tx.inventoryItem.findUnique({ where: { id: input.itemId } });
  if (!item) throw notFound('Item');

  if (item.tracking === 'SERIALIZED') {
    if (!input.serials?.length) throw badRequest('Scan or enter the serial number of every unit received');
    const serials = input.serials.map((s) => ({ ...s, serialNumber: s.serialNumber.trim().toUpperCase() }));
    const existing = await tx.serialUnit.findMany({ where: { serialNumber: { in: serials.map((s) => s.serialNumber) } } });
    if (existing.length) throw conflict(`Already registered: ${existing.map((e) => e.serialNumber).join(', ')}`, 'DUPLICATE_SERIAL');
    for (const s of serials) {
      const unit = await tx.serialUnit.create({ data: { itemId: item.id, serialNumber: s.serialNumber, macAddress: s.macAddress } });
      await tx.stockMovement.create({
        data: { type: 'RECEIVE', itemId: item.id, serialUnitId: unit.id, quantity: 1, actorId, note: input.note },
      });
    }
    return { received: serials.length };
  }

  if (!input.quantity || input.quantity <= 0) throw badRequest('Quantity must be greater than zero');
  await tx.inventoryItem.update({ where: { id: item.id }, data: { storeQuantity: { increment: input.quantity } } });
  await tx.stockMovement.create({ data: { type: 'RECEIVE', itemId: item.id, quantity: input.quantity, actorId, note: input.note } });
  return { received: input.quantity };
}

// ───────────────────────────── Issuing ───────────────────────────────

/** Store → technician. Serialised units stay IN_TRANSIT until the technician accepts them. */
export async function issueSerials(tx: Tx, actorId: string, toUserId: string, serials: string[], note?: string) {
  await requireTechnician(tx, toUserId);
  const units = await unitsBySerial(tx, serials);
  const notInStore = units.filter((u) => u.status !== 'IN_STORE');
  if (notInStore.length) {
    throw conflict(`Not available in store: ${notInStore.map((u) => `${u.serialNumber} (${u.status})`).join(', ')}`, 'UNIT_UNAVAILABLE');
  }

  const routerUnits = units.filter((u) => u.item.category === 'ROUTER' || u.item.category === 'ONT');
  if (routerUnits.length) {
    const held = await tx.serialUnit.count({
      where: { holderId: toUserId, status: { in: [...CUSTODY] }, item: { category: { in: ['ROUTER', 'ONT'] } } },
    });
    if (held + routerUnits.length > env.MAX_ROUTERS_IN_CUSTODY) {
      throw conflict(
        `Custody limit reached: technician already holds ${held} router(s); the limit is ${env.MAX_ROUTERS_IN_CUSTODY}. ` +
          'Older units must be installed or returned first.',
        'CUSTODY_LIMIT',
      );
    }
  }

  const now = new Date();
  for (const u of units) {
    await tx.serialUnit.update({ where: { id: u.id }, data: { status: 'IN_TRANSIT', holderId: toUserId, heldSince: now } });
    await tx.stockMovement.create({
      data: { type: 'ISSUE', itemId: u.itemId, serialUnitId: u.id, quantity: 1, toUserId, actorId, note },
    });
  }
  return { issued: units.length };
}

export async function issueBulk(tx: Tx, actorId: string, toUserId: string, itemId: string, quantity: number, note?: string) {
  await requireTechnician(tx, toUserId);
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.tracking !== 'BULK') throw notFound('Bulk item');
  if (quantity <= 0) throw badRequest('Quantity must be greater than zero');
  if (item.storeQuantity < quantity) {
    throw conflict(`Only ${item.storeQuantity} ${item.unit} of ${item.name} in store`, 'INSUFFICIENT_STOCK');
  }
  await tx.inventoryItem.update({ where: { id: itemId }, data: { storeQuantity: { decrement: quantity } } });
  await tx.bulkHolding.upsert({
    where: { itemId_userId: { itemId, userId: toUserId } },
    create: { itemId, userId: toUserId, quantity },
    update: { quantity: { increment: quantity } },
  });
  await tx.stockMovement.create({ data: { type: 'ISSUE', itemId, quantity, toUserId, actorId, note } });
  return { issued: quantity };
}

/** Technician confirms physical receipt of issued units (all pending ones if no ids are given). */
export async function acceptUnits(tx: Tx, userId: string, unitIds?: string[]) {
  const units = await tx.serialUnit.findMany({
    where: { holderId: userId, status: 'IN_TRANSIT', ...(unitIds?.length ? { id: { in: unitIds } } : {}) },
  });
  const now = new Date();
  for (const u of units) {
    await tx.serialUnit.update({ where: { id: u.id }, data: { status: 'WITH_TECHNICIAN', heldSince: now } });
    await tx.stockMovement.create({
      data: { type: 'ACCEPT', itemId: u.itemId, serialUnitId: u.id, quantity: 1, toUserId: userId, actorId: userId },
    });
  }
  return { accepted: units.length };
}

// ───────────────────────────── Returns & losses ──────────────────────

export async function returnSerials(
  tx: Tx,
  actorId: string,
  serials: string[],
  condition: 'GOOD' | 'FAULTY',
  note?: string,
) {
  const units = await unitsBySerial(tx, serials);
  const notHeld = units.filter((u) => !CUSTODY.includes(u.status as (typeof CUSTODY)[number]));
  if (notHeld.length) throw conflict(`Not in a technician's custody: ${notHeld.map((u) => u.serialNumber).join(', ')}`);
  for (const u of units) {
    await tx.serialUnit.update({
      where: { id: u.id },
      data: { status: condition === 'GOOD' ? 'IN_STORE' : 'FAULTY', holderId: null, heldSince: null },
    });
    await tx.stockMovement.create({
      data: {
        type: condition === 'GOOD' ? 'RETURN' : 'REPORT_FAULTY',
        itemId: u.itemId,
        serialUnitId: u.id,
        quantity: 1,
        fromUserId: u.holderId,
        actorId,
        note,
      },
    });
  }
  return { returned: units.length };
}

export async function returnBulk(tx: Tx, actorId: string, fromUserId: string, itemId: string, quantity: number, note?: string) {
  const holding = await tx.bulkHolding.findUnique({ where: { itemId_userId: { itemId, userId: fromUserId } } });
  if (!holding || holding.quantity < quantity) throw conflict('Technician does not hold that much of this item', 'INSUFFICIENT_HOLDING');
  await tx.bulkHolding.update({ where: { id: holding.id }, data: { quantity: { decrement: quantity } } });
  await tx.inventoryItem.update({ where: { id: itemId }, data: { storeQuantity: { increment: quantity } } });
  await tx.stockMovement.create({ data: { type: 'RETURN', itemId, quantity, fromUserId, actorId, note } });
  return { returned: quantity };
}

export async function reportLost(tx: Tx, actorId: string, serialNumber: string, note: string) {
  const [unit] = await unitsBySerial(tx, [serialNumber]);
  if (unit.status === 'INSTALLED' || unit.status === 'LOST') throw conflict(`Unit is already ${unit.status}`);
  await tx.serialUnit.update({ where: { id: unit.id }, data: { status: 'LOST', heldSince: null } });
  await tx.stockMovement.create({
    data: { type: 'REPORT_LOST', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, fromUserId: unit.holderId, actorId, note },
  });
  return { serialNumber: unit.serialNumber, accountableUserId: unit.holderId };
}

// ───────────────────────────── Field usage ───────────────────────────

/** Installs a serialised unit at a customer. The unit must be accepted and held by the technician. */
export async function installSerial(
  tx: Tx,
  userId: string,
  serialNumber: string,
  task: { id: string; customerAccount: string | null },
) {
  const [unit] = await unitsBySerial(tx, [serialNumber]);
  if (unit.holderId !== userId) throw conflict(`${unit.serialNumber} is not in your custody`, 'NOT_IN_CUSTODY');
  if (unit.status === 'IN_TRANSIT') throw conflict(`Accept ${unit.serialNumber} in "My stock" before installing it`, 'NOT_ACCEPTED');
  if (unit.status !== 'WITH_TECHNICIAN') throw conflict(`${unit.serialNumber} cannot be installed (${unit.status})`);
  await tx.serialUnit.update({
    where: { id: unit.id },
    data: {
      status: 'INSTALLED',
      holderId: null,
      heldSince: null,
      taskId: task.id,
      customerAccount: task.customerAccount,
      installedAt: new Date(),
    },
  });
  await tx.stockMovement.create({
    data: { type: 'INSTALL', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, fromUserId: userId, actorId: userId, taskId: task.id },
  });
  return unit;
}

export async function consumeBulk(tx: Tx, userId: string, itemId: string, quantity: number, taskId: string) {
  const holding = await tx.bulkHolding.findUnique({ where: { itemId_userId: { itemId, userId } }, include: { item: true } });
  if (!holding || holding.quantity < quantity) {
    const name = holding?.item.name ?? 'this item';
    throw conflict(`You only hold ${holding?.quantity ?? 0} ${holding?.item.unit ?? ''} of ${name}`.trim(), 'INSUFFICIENT_HOLDING');
  }
  await tx.bulkHolding.update({ where: { id: holding.id }, data: { quantity: { decrement: quantity } } });
  await tx.stockMovement.create({ data: { type: 'CONSUME', itemId, quantity, fromUserId: userId, actorId: userId, taskId } });
  return holding.item;
}

// ───────────────────────────── Spot counts ───────────────────────────

/** Technician scans every unit physically in hand; we compare against the ledger. */
export async function stockCount(tx: Tx, userId: string, scannedSerials: string[]) {
  const scanned = normalise(scannedSerials);
  const held = await tx.serialUnit.findMany({ where: { holderId: userId, status: { in: [...CUSTODY] } } });
  const expected = held.map((u) => u.serialNumber);
  const expectedSet = new Set(expected);
  const scannedSet = new Set(scanned);
  const count = await tx.stockCount.create({
    data: {
      userId,
      expected,
      scanned,
      missing: expected.filter((s) => !scannedSet.has(s)),
      unexpected: scanned.filter((s) => !expectedSet.has(s)),
    },
  });
  return count;
}
