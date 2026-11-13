import type { Prisma, StockRequest, StockRequestType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, conflict } from '../../lib/http-error';
import { notify, notifyRoles } from '../notifications/notifications.service';
import * as svc from './inventory.service';

type Tx = Prisma.TransactionClient;
type Payload = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/*
 * Stock approvals. Every change to stock — a device installed, returned, collected or reported lost; stock
 * received, issued or adjusted — waits for an admin. When someone asks, the change is tried out at once
 * and undone (so a wrong serial or someone else's device is refused straight away), then filed as a
 * request; nothing moves until an admin approves, when it is carried out exactly as it was asked, as the
 * person who asked. An admin's own changes count as approved.
 */

/**
 * A customer's own router, confirmed: on record as the customer's device installed at that customer
 * (under a hidden catalogue entry, outside stock counts). Refused if the SN turns out to be Optimas stock.
 */
export async function recordCustomerRouter(tx: Tx, p: Payload) {
  const known = await tx.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(p.sn) } } });
  if (known && !known.customerOwned) throw conflict(`${known.serialNumber} is an Optimas device (${known.status.toLowerCase().replace('_', ' ')}), not the customer's`, 'OPTIMAS_DEVICE');
  const item = await tx.inventoryItem.upsert({
    where: { sku: 'CUSTOMER-ROUTER' },
    update: {},
    create: { sku: 'CUSTOMER-ROUTER', name: "Customer's own router", category: 'ROUTER', tracking: 'SERIALIZED', unit: 'pcs', unitPrice: 0, active: false },
  });
  const place = { status: 'INSTALLED' as const, customerOwned: true, holderId: null, heldSince: null, taskId: p.taskId ?? null, customerAccount: p.customerAccount ?? null, installedAt: new Date(), installLocation: p.location ?? null, macAddress: p.mac || undefined };
  if (known) await tx.serialUnit.update({ where: { id: known.id }, data: place });
  else await tx.serialUnit.create({ data: { ...place, serialNumber: p.sn, itemId: item.id } });
  if (p.taskId) await tx.task.update({ where: { id: p.taskId }, data: { ownRouterVerdict: 'APPROVED' } });
  return { serialNumber: p.sn, status: 'INSTALLED' };
}

/** Carries out one kind of change. `actorId` is the person who asked for it. */
const EXECUTE: Record<StockRequestType, (tx: Tx, actorId: string, p: Payload) => Promise<unknown>> = {
  RECEIVE: (tx, actor, p) => svc.receiveStock(tx, actor, p as Parameters<typeof svc.receiveStock>[2]),
  ISSUE: async (tx, actor, p) => ({
    serials: p.serials?.length ? await svc.issueSerials(tx, actor, p.userId, p.serials, p.note) : undefined,
    bulk: p.itemId && p.quantity ? await svc.issueBulk(tx, actor, p.userId, p.itemId, p.quantity, p.note) : undefined,
  }),
  RETURN: async (tx, actor, p) => ({
    serials: p.serials?.length ? await svc.returnSerials(tx, actor, p.serials, p.condition ?? 'GOOD', p.note) : undefined,
    bulk: p.itemId && p.quantity ? await svc.returnBulk(tx, actor, p.userId, p.itemId, p.quantity, p.note) : undefined,
  }),
  REPORT_LOST: (tx, actor, p) => svc.reportLost(tx, actor, p.serialNumber, p.note),
  INSTALL: (tx, actor, p) => svc.installSerial(tx, actor, p.serial, { id: p.taskId ?? null, customerAccount: p.customerAccount ?? null }, p.place ?? (p.note ? { note: p.note } : null)),
  MARK_INSTALLED: async (tx, actor, p) => {
    const unit = await tx.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(p.serial) } } });
    if (!unit) throw badRequest(`No device with serial ${p.serial}`);
    if (unit.status !== 'WITH_TECHNICIAN' && unit.status !== 'IN_TRANSIT') throw conflict(`${unit.serialNumber} is not with a technician (${unit.status.toLowerCase().replace('_', ' ')})`);
    await tx.serialUnit.update({ where: { id: unit.id }, data: { status: 'INSTALLED', holderId: null, heldSince: null, customerAccount: String(p.customerAccount).toUpperCase(), installedAt: new Date() } });
    await tx.stockMovement.create({ data: { type: 'INSTALL', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, fromUserId: unit.holderId, actorId: actor, note: p.note } });
    return { serialNumber: unit.serialNumber, status: 'INSTALLED' };
  },
  RECOVER: async (tx, actor, p) => {
    const unit = await tx.serialUnit.findUnique({ where: { id: p.unitId } });
    if (!unit || unit.status !== 'INSTALLED') throw conflict(`${p.serial} is no longer installed at a customer`);
    const status = p.storeSide ? (p.condition === 'GOOD' ? 'IN_STORE' : 'FAULTY') : 'WITH_TECHNICIAN';
    await tx.serialUnit.update({ where: { id: unit.id }, data: { status, holderId: p.storeSide ? null : actor, heldSince: p.storeSide ? null : new Date(), customerAccount: null, taskId: null, installedAt: null, installLocation: null, installNote: null, installLat: null, installLng: null } });
    await tx.stockMovement.create({
      data: { type: 'RECOVER', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, toUserId: p.storeSide ? null : actor, actorId: actor, taskId: p.taskId ?? null, note: `From ${unit.customerAccount ?? 'customer'} · ${p.condition === 'GOOD' ? 'working' : 'faulty'} · ${p.reason}` },
    });
    return { serial: unit.serialNumber, status };
  },
  CUSTOMER_ROUTER: (tx, _actor, p) => recordCustomerRouter(tx, p),
  ADJUST: async (tx, actor, p) => {
    const it = await tx.inventoryItem.findUnique({ where: { id: p.itemId } });
    if (!it) throw badRequest('Item not found', 'NOT_FOUND');
    if (it.tracking !== 'BULK') throw badRequest('Serialised devices are adjusted by marking units faulty or lost, not by quantity');
    if (it.storeQuantity + p.quantity < 0) throw badRequest(`Only ${it.storeQuantity} ${it.unit} in store`, 'INSUFFICIENT_STOCK');
    const updated = await tx.inventoryItem.update({ where: { id: it.id }, data: { storeQuantity: { increment: p.quantity } } });
    await tx.stockMovement.create({ data: { type: 'ADJUST', itemId: it.id, quantity: p.quantity, actorId: actor, note: p.reason } });
    return updated;
  },
};

/**
 * An admin approving a device installed: the admin has confirmed it is at the customer, so it is recorded
 * installed wherever the register has it now — still with the technician who asked, handed to a teammate,
 * back in the store, or issued again — instead of refusing because it left the asker's hands after they
 * asked. (When the technician asks, it must still be in their hands.) Already installed: nothing to move.
 */
async function installOnApproval(tx: Tx, actorId: string, p: Payload) {
  const unit = await tx.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(p.serial) } }, include: { holder: { select: { name: true } } } });
  if (!unit) throw badRequest(`No device with serial ${p.serial} in the register`);
  if (unit.status === 'INSTALLED') return { serialNumber: unit.serialNumber, status: 'INSTALLED', alreadyInstalled: true };
  const where =
    unit.holderId === actorId
      ? null
      : unit.holder
        ? `was with ${unit.holder.name}`
        : unit.status === 'IN_STORE'
          ? 'was still in the store'
          : `was marked ${unit.status.toLowerCase().replace('_', ' ')}`;
  if (unit.status === 'IN_TRANSIT' && unit.holderId) {
    await tx.stockMovement.create({ data: { type: 'ACCEPT', itemId: unit.itemId, serialUnitId: unit.id, quantity: 1, toUserId: unit.holderId, actorId } });
  }
  const place = p.place ?? (p.note ? { note: p.note } : null);
  await tx.serialUnit.update({
    where: { id: unit.id },
    data: {
      status: 'INSTALLED',
      holderId: null,
      heldSince: null,
      taskId: p.taskId ?? null,
      customerAccount: p.customerAccount ?? null,
      installedAt: new Date(),
      installLocation: place?.location ?? null,
      installNote: place?.note ?? null,
      installLat: place?.lat ?? null,
      installLng: place?.lng ?? null,
    },
  });
  await tx.stockMovement.create({
    data: {
      type: 'INSTALL',
      itemId: unit.itemId,
      serialUnitId: unit.id,
      quantity: 1,
      fromUserId: unit.holderId,
      actorId,
      taskId: p.taskId ?? null,
      note: [place?.location, place?.note, where && `Approved by admin; the device ${where}`].filter(Boolean).join(' — ') || undefined,
    },
  });
  return { serialNumber: unit.serialNumber, status: 'INSTALLED' };
}

/** What follows a change once it is carried out (telling the people it concerns). */
async function afterwards(type: StockRequestType, actorId: string, p: Payload, result: Payload) {
  if (type === 'ISSUE') {
    const parts = [result.serials && `${result.serials.issued} device(s)`, result.bulk && 'materials'].filter(Boolean).join(' and ');
    void notify([p.userId], { type: 'STOCK_ISSUED', title: 'Stock issued to you', body: `${parts} issued. Confirm receipt in My stock.` });
  }
  if (type === 'REPORT_LOST') {
    const msg = { type: 'UNIT_LOST' as const, title: `Device ${result.serialNumber} reported lost`, body: p.note, data: { serialNumber: result.serialNumber } };
    void notify([result.accountableUserId], msg);
    void notifyRoles(['SUPERVISOR', 'ADMIN'], msg, actorId);
  }
}

/** Tells the admins a stock change is waiting for them. */
export function tellAdmins(requestedBy: { id: string; name: string }, summary: string, stockRequestId?: string) {
  void notifyRoles(['ADMIN'], { type: 'STOCK_APPROVAL', title: `Stock approval needed — ${requestedBy.name}`, body: summary, data: stockRequestId ? { stockRequestId } : {} }, requestedBy.id);
}

class Rollback extends Error {}

/** Tries a change and undoes it: throws the same error the real change would. */
async function tryOut(type: StockRequestType, actorId: string, payload: Payload) {
  try {
    await prisma.$transaction(async (tx) => {
      await EXECUTE[type](tx, actorId, payload);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
}

/**
 * Files a change for approval and tells the admins. Inside a caller's transaction (`db` is that
 * transaction) the caller tells the admins once it has committed.
 */
export async function fileRequest(
  db: Tx | typeof prisma,
  type: StockRequestType,
  requestedBy: { id: string; name: string },
  payload: Payload,
  info: { summary: string; serialUnitId?: string | null; taskId?: string | null },
) {
  if (info.serialUnitId) {
    const waiting = await db.stockRequest.findFirst({ where: { serialUnitId: info.serialUnitId, status: 'PENDING' } });
    if (waiting) throw conflict(`This device already has a change waiting for approval: ${waiting.summary}`, 'APPROVAL_PENDING');
  }
  const request = await db.stockRequest.create({
    data: { type, payload: payload as Prisma.InputJsonObject, summary: info.summary, requestedById: requestedBy.id, serialUnitId: info.serialUnitId ?? null, taskId: info.taskId ?? null },
  });
  if (db === prisma) tellAdmins(requestedBy, info.summary, request.id);
  return request;
}

/**
 * A stock change asked for in the app: an admin's is carried out now; anyone else's is checked and filed
 * for approval. Returns what the route should answer.
 */
export async function gate(
  user: { id: string; name: string; role: string },
  type: StockRequestType,
  payload: Payload,
  info: { summary: string; serialUnitId?: string | null; taskId?: string | null },
): Promise<{ pending: true; request: StockRequest } | { pending: false; result: Payload }> {
  if (user.role === 'ADMIN') {
    const result = (await prisma.$transaction((tx) => EXECUTE[type](tx, user.id, payload))) as Payload;
    await afterwards(type, user.id, payload, result);
    return { pending: false, result };
  }
  await tryOut(type, user.id, payload);
  return { pending: true, request: await fileRequest(prisma, type, user, payload, info) };
}

/** An admin approves: the change is carried out as the person who asked for it. */
export async function approve(id: string, admin: { id: string; name: string }, note?: string) {
  const request = await prisma.$transaction(async (tx) => {
    const claimed = await tx.stockRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedById: admin.id, reviewedAt: new Date(), reviewNote: note } });
    if (!claimed.count) throw conflict('This request was already decided', 'ALREADY_DECIDED');
    const r = await tx.stockRequest.findUniqueOrThrow({ where: { id } });
    const result = (r.type === 'INSTALL' ? await installOnApproval(tx, r.requestedById, r.payload as Payload) : await EXECUTE[r.type](tx, r.requestedById, r.payload as Payload)) as Payload;
    return { r, result };
  });
  await afterwards(request.r.type, request.r.requestedById, request.r.payload as Payload, request.result);
  await audit(admin.id, 'STOCK_APPROVED', 'StockRequest', id, `Approved: ${request.r.summary}`);
  void notify([request.r.requestedById], { type: 'STOCK_APPROVAL', title: 'Approved', body: request.r.summary, data: { stockRequestId: id } });
  return request.r;
}

/** An admin rejects: nothing changes; the person who asked is told why. */
export async function reject(id: string, admin: { id: string; name: string }, note: string) {
  const claimed = await prisma.stockRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', reviewedById: admin.id, reviewedAt: new Date(), reviewNote: note } });
  if (!claimed.count) throw conflict('This request was already decided', 'ALREADY_DECIDED');
  const r = await prisma.stockRequest.findUniqueOrThrow({ where: { id } });
  // The customer's router was not confirmed: the task says so
  if (r.type === 'CUSTOMER_ROUTER' && r.taskId) await prisma.task.update({ where: { id: r.taskId }, data: { ownRouterVerdict: 'REJECTED' } });
  await audit(admin.id, 'STOCK_REJECTED', 'StockRequest', id, `Rejected: ${r.summary} — ${note}`);
  void notify([r.requestedById], { type: 'STOCK_APPROVAL', title: 'Not approved', body: `${r.summary} — ${note}`, data: { stockRequestId: id } });
  return r;
}
