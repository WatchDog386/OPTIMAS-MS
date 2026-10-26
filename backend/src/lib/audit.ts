import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Records an administrative action. Never throws — auditing must not break the action itself. */
export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
  meta?: Prisma.InputJsonObject,
) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entity, entityId, summary, meta } });
  } catch (err) {
    console.error('[audit] failed', err);
  }
}
