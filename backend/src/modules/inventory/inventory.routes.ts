import { Router } from 'express';
import { cacheFor } from '../../lib/cache';
import { z } from 'zod';
import { ItemCategory, TrackingMode, UnitStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import * as svc from './inventory.service';
import { buildReconciliation } from './reconciliation';
import { approve, gate, reject } from './stock-approval';
import { notify, notifyRoles } from '../notifications/notifications.service';
import { audit } from '../../lib/audit';
import { readCode, tagFor } from '../../lib/assetTag';
import { forbidden } from '../../lib/http-error';
import { AFTER_VISIT_MS } from '../chat/chat.service';

export const inventoryRouter = Router();
const store = requireRole(ROLES.STORE);
const DAY_MS = 86_400_000;

// ───────────────────────────── Catalogue ─────────────────────────────

inventoryRouter.get(
  '/items',
  cacheFor(15_000),
  ah(async (_req, res) => {
    const [items, unitGroups, bulkGroups] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
      prisma.serialUnit.groupBy({ by: ['itemId', 'status'], _count: { _all: true } }),
      prisma.bulkHolding.groupBy({ by: ['itemId'], _sum: { quantity: true } }),
    ]);
    res.json({
      items: items.map((item) => {
        const counts = Object.fromEntries(Object.values(UnitStatus).map((s) => [s, 0])) as Record<UnitStatus, number>;
        for (const g of unitGroups) if (g.itemId === item.id) counts[g.status] = g._count._all;
        const withTechnicians = bulkGroups.find((g) => g.itemId === item.id)?._sum.quantity ?? 0;
        return {
          ...item,
          stock:
            item.tracking === 'SERIALIZED'
              ? { inStore: counts.IN_STORE, withTechnicians: counts.IN_TRANSIT + counts.WITH_TECHNICIAN, byStatus: counts }
              : { inStore: item.storeQuantity, withTechnicians },
          lowStock: (item.tracking === 'SERIALIZED' ? counts.IN_STORE : item.storeQuantity) <= item.reorderLevel,
        };
      }),
    });
  }),
);

const itemSchema = z.object({
  sku: z.string().trim().min(2).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2),
  category: z.enum(ItemCategory),
  tracking: z.enum(TrackingMode),
  unit: z.string().trim().default('pcs'),
  unitPrice: z.number().int().min(0).default(0),
  reorderLevel: z.number().min(0).default(0),
});

inventoryRouter.post(
  '/items',
  store,
  ah(async (req, res) => {
    const item = await prisma.inventoryItem.create({ data: parse(itemSchema, req.body) });
    await audit(me(req).id, 'ITEM_CREATED', 'InventoryItem', item.id, `Added ${item.name} (${item.sku}) to the catalogue`);
    res.status(201).json({ item });
  }),
);

/** One-screen catalogue entry: name + scan serials + reorder level, saved as one item with that many units. */
const catalogEntrySchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  category: z.enum(ItemCategory).default('ROUTER'),
  reorderLevel: z.number().min(0).default(0),
  serials: z.array(z.string().trim().min(3, 'Serial number too short')).min(1, 'Scan at least one serial number'),
});

inventoryRouter.post(
  '/items/catalog-entry',
  store,
  ah(async (req, res) => {
    const body = parse(catalogEntrySchema, req.body);
    const actor = me(req).id;
    const sku = `${body.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)}-${Date.now().toString().slice(-4)}`;

    const { item, count } = await prisma.$transaction(async (tx) => {
      const it = await tx.inventoryItem.create({
        data: {
          sku,
          name: body.name,
          category: body.category,
          tracking: 'SERIALIZED',
          unit: 'pcs',
          unitPrice: 0,
          reorderLevel: body.reorderLevel,
        },
      });

      const existing = await tx.serialUnit.findMany({
        where: { serialNumber: { in: body.serials.map((s) => s.toUpperCase()) } },
        select: { serialNumber: true },
      });
      if (existing.length) {
        throw conflict(`Already registered: ${existing.map((e) => e.serialNumber).join(', ')}`, 'DUPLICATE_SERIAL');
      }

      for (const sn of body.serials) {
        const unit = await tx.serialUnit.create({
          data: { itemId: it.id, serialNumber: sn.toUpperCase(), status: 'IN_STORE' },
        });
        await tx.stockMovement.create({
          data: { type: 'RECEIVE', itemId: it.id, serialUnitId: unit.id, quantity: 1, actorId: actor, note: 'Catalogue entry' },
        });
      }

      return { item: it, count: body.serials.length };
    });

    await audit(actor, 'CATALOG_ENTRY', 'InventoryItem', item.id, `Added ${count} × ${item.name} by serial`);
    res.status(201).json({ item, count });
  }),
);

/** Bulk catalogue entry: items that arrive without serials/barcodes. Auto-generate serials for each unit and return labels. */
const catalogBulkSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  category: z.enum(ItemCategory).default('ROUTER'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(500, 'Maximum 500 labels at once'),
  reorderLevel: z.number().min(0).default(0),
});

inventoryRouter.post(
  '/items/catalog-entry-bulk',
  store,
  ah(async (req, res) => {
    const body = parse(catalogBulkSchema, req.body);
    const actor = me(req).id;
    const sku = `${body.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20)}-${Date.now().toString().slice(-4)}`;

    const { item, units } = await prisma.$transaction(async (tx) => {
      const it = await tx.inventoryItem.create({
        data: {
          sku,
          name: body.name,
          category: body.category,
          tracking: 'SERIALIZED',
          unit: 'pcs',
          unitPrice: 0,
          reorderLevel: body.reorderLevel,
        },
      });

      const base = sku.toUpperCase().replace(/-+$/, '');
      const taken = new Set((await tx.serialUnit.findMany({ where: { itemId: it.id }, select: { serialNumber: true } })).map((u) => u.serialNumber));
      let next = 1;
      const units: { serialNumber: string }[] = [];
      for (let i = 0; i < body.quantity; i++) {
        let sn = `${base}-${String(next).padStart(4, '0')}`;
        while (taken.has(sn)) { next += 1; sn = `${base}-${String(next).padStart(4, '0')}`; }
        taken.add(sn);
        next += 1;
        const unit = await tx.serialUnit.create({
          data: { itemId: it.id, serialNumber: sn.toUpperCase(), status: 'IN_STORE' },
        });
        await tx.stockMovement.create({
          data: { type: 'RECEIVE', itemId: it.id, serialUnitId: unit.id, quantity: 1, actorId: actor, note: 'Catalogue entry bulk' },
        });
        units.push(unit);
      }
      return { item: it, units };
    });

    const labels = units.map((u) => ({ serial: u.serialNumber, item: item.name, sku: item.sku, code: tagFor(u.serialNumber) }));
    await audit(actor, 'CATALOG_ENTRY_BULK', 'InventoryItem', item.id, `Added ${body.quantity} × ${item.name} with auto-generated serials`);
    res.status(201).json({ item, labels, count: labels.length });
  }),
);

const itemUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  unit: z.string().trim().min(1).optional(),
  unitPrice: z.number().int().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

/** Edit catalogue details. SKU, category and tracking mode are fixed once stock exists. */
inventoryRouter.patch(
  '/items/:id',
  store,
  ah(async (req, res) => {
    const body = parse(itemUpdateSchema, req.body);
    const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) throw badRequest('Item not found', 'NOT_FOUND');
    if (body.active === false) {
      const [inField, held] = await Promise.all([
        prisma.serialUnit.count({ where: { itemId: existing.id, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } } }),
        prisma.bulkHolding.aggregate({ where: { itemId: existing.id }, _sum: { quantity: true } }),
      ]);
      if (inField || (held._sum.quantity ?? 0) > 0) throw badRequest('This item is still with technicians. Recover it before archiving.', 'ITEM_IN_FIELD');
    }
    const item = await prisma.inventoryItem.update({ where: { id: existing.id }, data: body });
    const changes = Object.entries(body)
      .map(([k, v]) => `${k}: ${String((existing as Record<string, unknown>)[k])} → ${String(v)}`)
      .join('; ');
    await audit(me(req).id, 'ITEM_UPDATED', 'InventoryItem', item.id, `${item.name}: ${changes}`);
    res.json({ item });
  }),
);

const adjustSchema = z.object({
  itemId: z.string().min(1),
  /** Positive to add (found / correction), negative to remove (damaged / count shortfall). */
  quantity: z.number().refine((n) => n !== 0, 'Quantity cannot be zero'),
  reason: z.string().trim().min(5, 'Explain the adjustment').max(300),
});

/** Store stock-take correction for BULK items, recorded in the ledger as ADJUST. */
inventoryRouter.post(
  '/adjust',
  store,
  ah(async (req, res) => {
    const body = parse(adjustSchema, req.body);
    const it = await prisma.inventoryItem.findUnique({ where: { id: body.itemId } });
    if (!it) throw badRequest('Item not found', 'NOT_FOUND');
    const out = await gate(me(req), 'ADJUST', body, { summary: `Adjust ${it.name}: ${body.quantity > 0 ? '+' : ''}${body.quantity} ${it.unit} — ${body.reason}` });
    if (out.pending) return void res.status(202).json(out);
    await audit(me(req).id, 'STOCK_ADJUSTED', 'InventoryItem', it.id, `${body.quantity > 0 ? '+' : ''}${body.quantity} ${it.unit} ${it.name}: ${body.reason}`);
    res.json({ item: out.result });
  }),
);

// ───────────────────────────── Store operations ──────────────────────

const receiveSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive().optional(),
  serials: z.array(z.object({ serialNumber: z.string().trim().min(3), macAddress: z.string().trim().optional() })).optional(),
  note: z.string().trim().max(300).optional(),
});

inventoryRouter.post(
  '/receive',
  store,
  ah(async (req, res) => {
    const body = parse(receiveSchema, req.body);
    const it = await prisma.inventoryItem.findUnique({ where: { id: body.itemId } });
    if (!it) throw badRequest('Item not found', 'NOT_FOUND');
    const what = body.serials?.length ? `${body.serials.length} × ${it.name}` : `${body.quantity ?? 0} ${it.unit} ${it.name}`;
    const out = await gate(me(req), 'RECEIVE', body, { summary: `Receive ${what} into the store` });
    res.status(out.pending ? 202 : 201).json(out.pending ? out : out.result);
  }),
);

const generateSchema = z.object({
  itemId: z.string().min(1),
  count: z.number().int().min(1).max(200),
  prefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,20}$/, 'Use letters, numbers and dashes only')
    .optional(),
});

/** For unlabelled stock: the next free serial numbers of that product's series (SKU-0001…). */
inventoryRouter.post('/serials/generate', store, ah(async (req, res) => res.json(await svc.generateSerials(parse(generateSchema, req.body)))));

const transferSchema = z
  .object({
    userId: z.string().min(1),
    serials: z.array(z.string()).optional(),
    itemId: z.string().optional(),
    quantity: z.number().positive().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((b) => b.serials?.length || (b.itemId && b.quantity), { message: 'Provide serial numbers, or an item and quantity' });

inventoryRouter.post(
  '/issue',
  store,
  ah(async (req, res) => {
    const b = parse(transferSchema, req.body);
    const to = await prisma.user.findUnique({ where: { id: b.userId }, select: { name: true } });
    const item = b.itemId ? await prisma.inventoryItem.findUnique({ where: { id: b.itemId }, select: { name: true, unit: true } }) : null;
    const what = [b.serials?.length ? `${b.serials.length} device(s) (${b.serials.slice(0, 3).join(', ')}${b.serials.length > 3 ? '…' : ''})` : null, item && b.quantity ? `${b.quantity} ${item.unit} ${item.name}` : null].filter(Boolean).join(' and ');
    const out = await gate(me(req), 'ISSUE', b, { summary: `Issue ${what} to ${to?.name ?? 'a technician'}` });
    res.status(out.pending ? 202 : 201).json(out.pending ? out : out.result);
  }),
);

inventoryRouter.post(
  '/return',
  store,
  ah(async (req, res) => {
    const b = parse(transferSchema.and(z.object({ condition: z.enum(['GOOD', 'FAULTY']).default('GOOD') })), req.body);
    const from = await prisma.user.findUnique({ where: { id: b.userId }, select: { name: true } });
    const what = [b.serials?.length ? `${b.serials.length} device(s) (${b.serials.slice(0, 3).join(', ')}${b.serials.length > 3 ? '…' : ''})` : null, b.itemId && b.quantity ? `${b.quantity} of an item` : null].filter(Boolean).join(' and ');
    const out = await gate(me(req), 'RETURN', b, { summary: `Return ${what} from ${from?.name ?? 'a technician'} to the store (${b.condition === 'GOOD' ? 'working' : 'faulty'})` });
    if (out.pending) return void res.status(202).json(out);
    res.json(out.result);
  }),
);

inventoryRouter.post(
  '/report-lost',
  store,
  ah(async (req, res) => {
    const b = parse(z.object({ serialNumber: z.string().min(1), note: z.string().trim().min(5, 'Explain what happened') }), req.body);
    const unit = await prisma.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(b.serialNumber) } }, select: { id: true, serialNumber: true } });
    const out = await gate(me(req), 'REPORT_LOST', b, { summary: `Report ${unit?.serialNumber ?? b.serialNumber} lost — ${b.note}`, serialUnitId: unit?.id });
    if (out.pending) return void res.status(202).json(out);
    await audit(me(req).id, 'UNIT_LOST', 'SerialUnit', String(out.result.serialNumber), `Reported ${out.result.serialNumber} lost: ${b.note}`);
    res.json(out.result);
  }),
);

// ───────────────────────────── Technician self-service ───────────────

inventoryRouter.get(
  '/my',
  ah(async (req, res) => {
    const userId = me(req).id;
    const [units, bulk, lastCount] = await Promise.all([
      prisma.serialUnit.findMany({
        where: { holderId: userId, status: { in: ['IN_TRANSIT', 'WITH_TECHNICIAN'] } },
        include: { item: { select: { id: true, name: true, sku: true, category: true } } },
        orderBy: { heldSince: 'asc' },
      }),
      prisma.bulkHolding.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { item: { select: { id: true, name: true, sku: true, unit: true, unitPrice: true, category: true } } },
      }),
      prisma.stockCount.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const waiting = await prisma.stockRequest.findMany({ where: { requestedById: userId, status: 'PENDING' }, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, summary: true, serialUnitId: true, createdAt: true } });
    const now = Date.now();
    res.json({
      pending: units.filter((u) => u.status === 'IN_TRANSIT'),
      units: units
        .filter((u) => u.status === 'WITH_TECHNICIAN')
        .map((u) => ({ ...u, daysHeld: u.heldSince ? Math.floor((now - u.heldSince.getTime()) / DAY_MS) : 0, awaitingApproval: waiting.find((w) => w.serialUnitId === u.id)?.summary ?? null })),
      waiting,
      bulk,
      // As it stands today: devices since installed, returned or lost are no longer missing
      lastCount: lastCount && {
        ...lastCount,
        missing: lastCount.missing.filter((s) => units.some((u) => u.serialNumber === s)),
        unexpected: lastCount.unexpected.filter((c) => !svc.matchUnit(units, c)),
      },
      ageAlertDays: env.CUSTODY_AGE_ALERT_DAYS,
    });
  }),
);

/** Which of my devices a scanned code means (the job-completion screen checks every scan with this). */
inventoryRouter.get(
  '/my/find',
  ah(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code.trim()) throw badRequest('Scan or type a serial number');
    const unit = await svc.findHeldUnit(prisma, me(req).id, code);
    if (!unit) {
      const elsewhere = await prisma.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(code) } }, include: { holder: { select: { name: true } } } });
      if (elsewhere) throw conflict(`${elsewhere.serialNumber} is not one of your devices${elsewhere.holder ? ` (${elsewhere.holder.name} holds it)` : ` (${elsewhere.status.toLowerCase().replace('_', ' ')})`}`, 'NOT_IN_CUSTODY');
      throw notFound('That code among your devices. Scan the code marked SN, or pick the device from your list');
    }
    res.json({ unit: { id: unit.id, serialNumber: unit.serialNumber, status: unit.status, item: { name: unit.item.name } } });
  }),
);

const installSchema = z.object({
  serial: z.string().trim().min(3),
  customerAccount: z.string().trim().min(2, 'Enter the customer account number'),
  note: z.string().trim().max(300).optional(),
});

/** A technician records a device installed at a customer when there was no Installation job in the app. */
inventoryRouter.post(
  '/install',
  ah(async (req, res) => {
    const user = me(req);
    if (user.role !== 'TECHNICIAN') throw forbidden('Only technicians install devices');
    const b = parse(installSchema, req.body);
    const account = b.customerAccount.toUpperCase();
    const held = await prisma.$transaction((tx) => svc.findHeldUnit(tx, user.id, b.serial));
    const out = await gate(user, 'INSTALL', { serial: held?.serialNumber ?? b.serial, customerAccount: account, note: b.note }, { summary: `Install ${held?.serialNumber ?? b.serial}${held ? ` (${held.item.name})` : ''} at ${account}${b.note ? ` — ${b.note}` : ''}`, serialUnitId: held?.id });
    if (out.pending) return void res.status(202).json(out);
    res.json({ unit: { serialNumber: out.result.serialNumber, status: 'INSTALLED', customerAccount: account } });
  }),
);

/** Store or managers: a device a technician already installed, but which still shows as in their hands. */
inventoryRouter.post(
  '/units/:serial/mark-installed',
  store,
  ah(async (req, res) => {
    const b = parse(installSchema.omit({ serial: true }).extend({ note: z.string().trim().min(5, 'Say how you know it is installed') }), req.body);
    const serial = readCode(req.params.serial).serial;
    const unit = await prisma.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(serial) } } });
    if (!unit) throw badRequest(`No device with serial ${serial}`);
    const account = b.customerAccount.toUpperCase();
    const out = await gate(me(req), 'MARK_INSTALLED', { serial: unit.serialNumber, customerAccount: account, note: b.note }, { summary: `Mark ${unit.serialNumber} installed at ${account} — ${b.note}`, serialUnitId: unit.id });
    if (out.pending) return void res.status(202).json(out);
    await audit(me(req).id, 'UNIT_INSTALLED', 'SerialUnit', unit.id, `Marked ${unit.serialNumber} installed at ${account}: ${b.note}`);
    res.json({ unit: { serialNumber: unit.serialNumber, status: 'INSTALLED' } });
  }),
);

// ───────────────────────────── Stock approvals ───────────────────────

const requestInclude = { requestedBy: { select: { id: true, name: true, staffNo: true, role: true } }, reviewedBy: { select: { id: true, name: true } } } as const;

/**
 * Stock changes waiting for an admin (status=PENDING) or decided (status=DONE). Admins see everyone's; the
 * store and supervisors see everyone's too (read only); anyone else sees their own.
 */
inventoryRouter.get(
  '/requests',
  ah(async (req, res) => {
    const user = me(req);
    const done = req.query.status === 'DONE';
    const requests = await prisma.stockRequest.findMany({
      where: { status: done ? { in: ['APPROVED', 'REJECTED'] } : 'PENDING', ...(ROLES.STORE.includes(user.role) ? {} : { requestedById: user.id }) },
      orderBy: { createdAt: done ? 'desc' : 'asc' },
      take: done ? 100 : 300,
      include: requestInclude,
    });
    res.json({ requests });
  }),
);

const adminOnly = requireRole(ROLES.ADMIN);

/** An admin approves a stock change: it is carried out now, as the person who asked for it. */
inventoryRouter.post(
  '/requests/:id/approve',
  adminOnly,
  ah(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().trim().max(300).optional() }), req.body ?? {});
    const r = await approve(req.params.id, me(req), note);
    res.json({ request: await prisma.stockRequest.findUnique({ where: { id: r.id }, include: requestInclude }) });
  }),
);

/** An admin rejects a stock change: nothing moves, and the person who asked is told why. */
inventoryRouter.post(
  '/requests/:id/reject',
  adminOnly,
  ah(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().trim().min(3, 'Say why it is not approved').max(300) }), req.body);
    const r = await reject(req.params.id, me(req), note);
    res.json({ request: await prisma.stockRequest.findUnique({ where: { id: r.id }, include: requestInclude }) });
  }),
);

inventoryRouter.post(
  '/accept',
  ah(async (req, res) => {
    const { unitIds, serials } = parse(z.object({ unitIds: z.array(z.string()).optional(), serials: z.array(z.string()).max(100).optional() }), req.body ?? {});
    res.json(await prisma.$transaction((tx) => svc.acceptUnits(tx, me(req).id, unitIds, serials)));
  }),
);

inventoryRouter.post(
  '/stock-count',
  ah(async (req, res) => {
    const { serials } = parse(z.object({ serials: z.array(z.string()) }), req.body);
    const count = await prisma.$transaction((tx) => svc.stockCount(tx, me(req).id, serials));
    if (count.missing.length || count.unexpected.length) {
      void notifyRoles(['STOREKEEPER', 'SUPERVISOR', 'ADMIN'], {
        type: 'STOCK_COUNT_MISMATCH',
        title: `Stock count mismatch — ${me(req).name}`,
        body: [
          count.missing.length && `Not scanned: ${count.missing.join(', ')} (if installed, mark it installed in My stock or Trace a device)`,
          count.unexpected.length && `Not on their record: ${count.unexpected.join(', ')}`,
        ]
          .filter(Boolean)
          .join(' · '),
        data: { userId: me(req).id },
      });
    }
    res.status(201).json({ count });
  }),
);

// ───────────────────────────── Lookup & audit ────────────────────────

inventoryRouter.get(
  '/units',
  store,
  ah(async (req, res) => {
    const status = typeof req.query.status === 'string' && req.query.status in UnitStatus ? (req.query.status as UnitStatus) : undefined;
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toUpperCase() : undefined;
    const units = await prisma.serialUnit.findMany({
      where: {
        status,
        itemId,
        holderId: typeof req.query.holderId === 'string' ? req.query.holderId : undefined,
        ...(q ? { OR: [{ serialNumber: { contains: q } }, { customerAccount: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: { item: { select: { name: true, category: true } }, holder: { select: { id: true, name: true, staffNo: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    res.json({ units });
  }),
);

/** Full chain-of-custody trail for one serial number. */
inventoryRouter.get(
  '/units/:serial/history',
  store,
  ah(async (req, res) => {
    // The exact serial first, then its other printed forms (GPON text/hex, "SN:" prefix), then the MAC
    const code = readCode(req.params.serial).serial;
    const found =
      (await prisma.serialUnit.findFirst({ where: { serialNumber: { in: svc.codeVariants(code) } }, select: { id: true } })) ??
      (await prisma.serialUnit.findFirst({ where: { macAddress: { equals: code, mode: 'insensitive' } }, select: { id: true } }));
    const unit = !found ? null : await prisma.serialUnit.findUnique({
      where: { id: found.id },
      include: {
        item: true,
        holder: { select: { id: true, name: true, staffNo: true } },
        task: { select: { id: true, code: true, customerName: true, endPhotoId: true } },
        movements: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { name: true } },
            fromUser: { select: { name: true } },
            toUser: { select: { name: true } },
            task: { select: { code: true } },
          },
        },
      },
    });
    if (!unit) throw badRequest('Serial number not found', 'NOT_FOUND');
    res.json({ unit });
  }),
);

inventoryRouter.get(
  '/movements',
  store,
  ah(async (req, res) => {
    const movements = await prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
      include: {
        item: { select: { name: true, unit: true } },
        unit: { select: { serialNumber: true } },
        actor: { select: { name: true } },
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        task: { select: { code: true } },
      },
    });
    res.json({ movements });
  }),
);

/**
 * Reconciliation: for every technician, what was issued vs. what is accounted for
 * (installed / returned / lost) vs. what is still in hand, plus overdue units and the last stock count.
 */
inventoryRouter.get(
  '/reconciliation',
  cacheFor(15_000),
  store,
  ah(async (_req, res) => {
    res.json(await buildReconciliation());
  }),
);

// ───────────────────────────── Labels & checking a device ────────────

/** QR labels to print and stick on devices: by serial numbers, or every unit of an item still in the store. */
inventoryRouter.get(
  '/labels',
  store,
  ah(async (req, res) => {
    const serials = typeof req.query.serials === 'string' ? req.query.serials.split(',').map((s) => readCode(s).serial).filter(Boolean) : [];
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
    if (!serials.length && !itemId) throw badRequest('Choose the devices to print labels for');
    const units = await prisma.serialUnit.findMany({
      where: serials.length ? { serialNumber: { in: serials } } : { itemId, status: 'IN_STORE' },
      include: { item: { select: { name: true, sku: true } } },
      orderBy: { serialNumber: 'asc' },
      take: 300,
    });
    res.json({ labels: units.map((u) => ({ serial: u.serialNumber, mac: u.macAddress, item: u.item.name, sku: u.item.sku, code: tagFor(u.serialNumber) })) });
  }),
);

const fmt = (d: Date) => d.toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * "Is this the one we issued?" Scan a label (or type a serial or MAC) and get a plain answer for the
 * person asking: whether the label is genuine, what the device is, who has it and since when.
 */
inventoryRouter.post(
  '/verify',
  ah(async (req, res) => {
    const user = me(req);
    const { code } = parse(z.object({ code: z.string().trim().min(3).max(200) }), req.body);
    let read: { serial: string; labelled: boolean };
    try {
      read = readCode(code);
    } catch {
      res.json({ label: 'fake', unit: null, verdict: { tone: 'danger', title: 'Fake or altered label', detail: 'This sticker was not printed by Optimas, or someone changed it. Do not install or accept this device; hand it to the store.' } });
      return;
    }
    const mac = read.serial.replace(/[^0-9A-F]/g, '');
    const unit = await prisma.serialUnit.findFirst({
      where: { OR: [{ serialNumber: read.serial }, ...(mac.length === 12 ? [{ macAddress: { in: [mac.match(/../g)!.join(':'), mac.match(/../g)!.join('-'), mac] } }] : [])] },
      include: {
        item: { select: { name: true, sku: true, category: true } },
        holder: { select: { id: true, name: true, staffNo: true } },
        task: { select: { id: true, code: true, assigneeId: true } },
        movements: { where: { type: 'ISSUE' }, orderBy: { createdAt: 'desc' }, take: 1, include: { actor: { select: { name: true } }, toUser: { select: { name: true } } } },
      },
    });
    const label = read.labelled ? 'genuine' : 'none';
    if (!unit) {
      res.json({ label, unit: null, verdict: { tone: 'danger', title: 'Not an Optimas device', detail: `${read.serial} is not in the Optimas register. It was never received into the store, so it was not issued by us.` } });
      return;
    }
    const issue = unit.movements[0];
    const issued = issue ? `issued by ${issue.actor.name} on ${fmt(issue.createdAt)}` : '';
    const mine = unit.holderId === user.id;
    const staffView = ROLES.STORE.includes(user.role);
    let verdict: { tone: 'success' | 'info' | 'warning' | 'danger'; title: string; detail: string };
    switch (unit.status) {
      case 'IN_STORE':
        verdict = staffView ? { tone: 'success', title: 'In the store', detail: 'Not issued to anyone yet.' } : { tone: 'warning', title: 'Not issued to you', detail: 'The register says this device is still in the store. Ask the store to issue it to you first.' };
        break;
      case 'IN_TRANSIT':
      case 'WITH_TECHNICIAN':
        if (mine) verdict = { tone: 'success', title: 'Yes, this is the one issued to you', detail: `${issued[0]?.toUpperCase()}${issued.slice(1)}.${unit.status === 'IN_TRANSIT' ? ' Confirm you received it in My stock.' : ''}` };
        else if (staffView) verdict = { tone: 'info', title: `With ${unit.holder?.name ?? 'a technician'}`, detail: `${unit.status === 'IN_TRANSIT' ? 'Not yet confirmed by them · ' : ''}${issued || 'issue not recorded'}.` };
        else verdict = { tone: 'danger', title: 'Not yours', detail: `This device was issued to ${unit.holder?.name ?? 'another technician'}. Do not install it; return it to them or to the store.` };
        break;
      case 'INSTALLED':
        verdict = { tone: 'info', title: `Installed at ${unit.customerAccount ?? 'a customer'}`, detail: `Installed${unit.installedAt ? ` on ${fmt(unit.installedAt)}` : ''}${unit.task ? ` on job ${unit.task.code}` : ''}.` };
        break;
      case 'FAULTY':
        verdict = { tone: 'warning', title: 'Marked faulty', detail: 'This device came back faulty. It should not be issued or installed.' };
        break;
      default:
        verdict = { tone: 'danger', title: 'Reported lost', detail: 'This device was reported lost. Hand it to the store so the register can be put right.' };
    }
    await audit(user.id, 'DEVICE_CHECKED', 'SerialUnit', unit.id, `Checked ${unit.serialNumber}${read.labelled ? ' (label)' : ''}: ${verdict.title}`);
    res.json({
      label,
      unit: {
        serial: unit.serialNumber,
        mac: unit.macAddress,
        item: unit.item,
        status: unit.status,
        holder: unit.holder,
        heldSince: unit.heldSince,
        customerAccount: staffView || unit.task?.assigneeId === user.id ? unit.customerAccount : null,
        installedAt: unit.installedAt,
        task: unit.task ? { id: unit.task.id, code: unit.task.code } : null,
        issued: issue ? { by: issue.actor.name, to: issue.toUser?.name ?? null, at: issue.createdAt } : null,
      },
      verdict,
    });
  }),
);

/**
 * Taking a device back from a customer (relocation, disconnection, faulty swap). A technician can only
 * collect from a customer they have a current or recent job for; it comes into their custody, to be
 * returned to the store. The store can take it straight back in.
 */
inventoryRouter.post(
  '/recover',
  ah(async (req, res) => {
    const user = me(req);
    const b = parse(z.object({ code: z.string().trim().min(3).max(200), reason: z.string().trim().min(3, 'Say why the device is being collected').max(300), condition: z.enum(['GOOD', 'FAULTY']).default('GOOD') }), req.body);
    const { serial } = readCode(b.code);
    const unit = await prisma.serialUnit.findUnique({ where: { serialNumber: serial }, include: { item: true } });
    if (!unit) throw badRequest(`${serial} is not in the Optimas register`, 'NOT_FOUND');
    if (unit.status !== 'INSTALLED') throw badRequest(`${serial} is not installed at a customer (${unit.status.toLowerCase().replace('_', ' ')})`, 'NOT_INSTALLED');
    const storeSide = ROLES.STORE.includes(user.role);
    let taskId: string | null = null;
    if (!storeSide) {
      if (user.role !== 'TECHNICIAN') throw forbidden();
      const job = await prisma.task.findFirst({
        where: {
          customerAccount: unit.customerAccount ?? '__none__',
          OR: [{ assigneeId: user.id }, { team: { members: { some: { userId: user.id } } } }],
          AND: [{ OR: [{ status: { in: ['ASSIGNED', 'IN_PROGRESS'] } }, { endedAt: { gte: new Date(Date.now() - AFTER_VISIT_MS) } }] }],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!job) throw forbidden('You can only collect a device from a customer you have a current or recent job for');
      taskId = job.id;
    }
    const out = await gate(user, 'RECOVER', { unitId: unit.id, serial, storeSide, taskId, condition: b.condition, reason: b.reason }, { summary: `Collect ${serial} (${unit.item.name}) from ${unit.customerAccount ?? 'a customer'} · ${b.condition === 'GOOD' ? 'working' : 'faulty'} — ${b.reason}`, serialUnitId: unit.id, taskId });
    if (out.pending) return void res.status(202).json(out);
    await audit(user.id, 'DEVICE_RECOVERED', 'SerialUnit', unit.id, `Collected ${serial} from ${unit.customerAccount ?? 'customer'} (${b.condition.toLowerCase()}): ${b.reason}`);
    res.json({ serial, status: out.result.status, holder: storeSide ? null : user.name });
  }),
);
