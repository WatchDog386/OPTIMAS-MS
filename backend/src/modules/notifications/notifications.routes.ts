import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  ah(async (req, res) => {
    const userId = me(req).id;
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    res.json({ notifications, unread });
  }),
);

notificationsRouter.get(
  '/unread-count',
  ah(async (req, res) => {
    res.json({ unread: await prisma.notification.count({ where: { userId: me(req).id, readAt: null } }) });
  }),
);

/** Mark the given notifications (or all) as read. */
notificationsRouter.post(
  '/read',
  ah(async (req, res) => {
    const { ids } = parse(z.object({ ids: z.array(z.string()).optional() }), req.body ?? {});
    const { count } = await prisma.notification.updateMany({
      where: { userId: me(req).id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    res.json({ updated: count });
  }),
);

const tokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, 'Invalid Expo push token'),
  platform: z.string().max(20).optional(),
});

notificationsRouter.post(
  '/push-token',
  ah(async (req, res) => {
    const { token, platform } = parse(tokenSchema, req.body);
    // A device belongs to whoever signed in on it most recently.
    await prisma.pushToken.upsert({
      where: { token },
      create: { token, platform, userId: me(req).id },
      update: { userId: me(req).id, platform },
    });
    res.status(201).json({ ok: true });
  }),
);

notificationsRouter.delete(
  '/push-token',
  ah(async (req, res) => {
    const { token } = parse(z.object({ token: z.string() }), req.body ?? {});
    await prisma.pushToken.deleteMany({ where: { token, userId: me(req).id } });
    res.json({ ok: true });
  }),
);
