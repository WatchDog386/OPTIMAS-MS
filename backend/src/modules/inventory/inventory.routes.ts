import { Router } from 'express';
import { z } from 'zod';
import { ItemCategory, TrackingMode, UnitStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import * as svc from './inventory.service';
import { buildReconciliation } from './reconciliation';
import { notify, notifyRoles } from '../notifications/notifications.service';

export const inventoryRouter = Router();
const store = requireRole(ROLES.STORE);
const DAY_MS = 86_400_000;

// ───────────────────────────── Catalogue ─────────────────────────────

inventoryRouter.get(
  '/items',
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
    res.status(201).json({ item });
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
    res.status(201).json(await prisma.$transaction((tx) => svc.receiveStock(tx, me(req).id, body)));
  }),
);

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
    const actor = me(req).id;
    const result = await prisma.$transaction(async (tx) => ({
      serials: b.serials?.length ? await svc.issueSerials(tx, actor, b.userId, b.serials, b.note) : undefined,
      bulk: b.itemId && b.quantity ? await svc.issueBulk(tx, actor, b.userId, b.itemId, b.quantity, b.note) : undefined,
    }));
    const parts = [result.serials && `${result.serials.issued} device(s)`, result.bulk && `materials`].filter(Boolean).join(' and ');
    void notify([b.userId], {
      type: 'STOCK_ISSUED',
      title: 'Stock issued to you',
      body: `${parts} issued by ${me(req).name}. Confirm receipt in My stock.`,
    });
    res.status(201).json(result);
  }),
);

inventoryRouter.post(
  '/return',
  store,
  ah(async (req, res) => {
    const b = parse(transferSchema.and(z.object({ condition: z.enum(['GOOD', 'FAULTY']).default('GOOD') })), req.body);
    const actor = me(req).id;
    const result = await prisma.$transaction(async (tx) => ({
      serials: b.serials?.length ? await svc.returnSerials(tx, actor, b.serials, b.condition, b.note) : undefined,
      bulk: b.itemId && b.quantity ? await svc.returnBulk(tx, actor, b.userId, b.itemId, b.quantity, b.note) : undefined,
    }));
    res.json(result);
  }),
);

inventoryRouter.post(
  '/report-lost',
  store,
  ah(async (req, res) => {
    const b = parse(z.object({ serialNumber: z.string().min(1), note: z.string().trim().min(5, 'Explain what happened') }), req.body);
    const lost = await prisma.$transaction((tx) => svc.reportLost(tx, me(req).id, b.serialNumber, b.note));
    const msg = { type: 'UNIT_LOST' as const, title: `Device ${lost.serialNumber} reported lost`, body: b.note, data: { serialNumber: lost.serialNumber } };
    void notify([lost.accountableUserId], msg);
    void notifyRoles(['SUPERVISOR', 'ADMIN'], msg, me(req).id);
    res.json(lost);
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
    const now = Date.now();
    res.json({
      pending: units.filter((u) => u.status === 'IN_TRANSIT'),
      units: units
        .filter((u) => u.status === 'WITH_TECHNICIAN')
        .map((u) => ({ ...u, daysHeld: u.heldSince ? Math.floor((now - u.heldSince.getTime()) / DAY_MS) : 0 })),
      bulk,
      lastCount,
      ageAlertDays: env.CUSTODY_AGE_ALERT_DAYS,
    });
  }),
);

inventoryRouter.post(
  '/accept',
  ah(async (req, res) => {
    const { unitIds } = parse(z.object({ unitIds: z.array(z.string()).optional() }), req.body ?? {});
    res.json(await prisma.$transaction((tx) => svc.acceptUnits(tx, me(req).id, unitIds)));
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
        body: [count.missing.length && `Missing: ${count.missing.join(', ')}`, count.unexpected.length && `Unexpected: ${count.unexpected.join(', ')}`]
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toUpperCase() : undefined;
    const units = await prisma.serialUnit.findMany({
      where: {
        status,
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
    const unit = await prisma.serialUnit.findUnique({
      where: { serialNumber: req.params.serial.toUpperCase() },
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
  store,
  ah(async (_req, res) => {
    res.json(await buildReconciliation());
  }),
);
