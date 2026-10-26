import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { ah } from '../../middleware/async';

/** Admin-only, read-only view of the audit trail. */
export const auditRouter = Router();

auditRouter.get(
  '/',
  ah(async (req, res) => {
    const entity = typeof req.query.entity === 'string' ? req.query.entity : undefined;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
    const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined;
    const entries = await prisma.auditLog.findMany({
      where: { entity, entityId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
      include: { actor: { select: { name: true, staffNo: true, role: true } } },
    });
    res.json({ entries });
  }),
);
