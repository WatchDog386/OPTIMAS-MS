import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { conflict } from '../../lib/http-error';
import { drivingRoute } from '../../lib/routing';
import { ah } from '../../middleware/async';
import { me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';

/**
 * Location sharing. Technicians' phones report where they are while the app is open (so managers and the
 * customer can follow them to a job); customers share once so the office knows where the premises are.
 * Nothing is recorded unless the person said yes.
 */
export const locationRouter = Router();

/** Pings closer together than this are only used to refresh the "last seen" position, not stored in the trail. */
const MIN_TRAIL_GAP_MS = 8_000;
/** Trail points are kept this long. */
const KEEP_TRAIL_MS = 3 * 24 * 60 * 60_000;

locationRouter.post(
  '/consent',
  ah(async (req, res) => {
    const { granted } = parse(z.object({ granted: z.boolean() }), req.body);
    const user = me(req);
    // Saying no also forgets where they were
    await prisma.user.update({
      where: { id: user.id },
      data: granted ? { locationConsent: true } : { locationConsent: false, lastLat: null, lastLng: null, lastAccuracy: null, lastHeading: null, lastSpeed: null, lastLocationAt: null },
    });
    if (!granted) await prisma.locationPing.deleteMany({ where: { userId: user.id } });
    res.json({ locationConsent: granted });
  }),
);

const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100_000).nullish(),
  heading: z.number().min(0).max(360).nullish(),
  speed: z.number().min(0).max(100).nullish(),
});

locationRouter.post(
  '/',
  ah(async (req, res) => {
    const user = me(req);
    const body = parse(pingSchema, req.body);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { locationConsent: true, lastLocationAt: true } });
    if (row.locationConsent !== true) throw conflict('Location sharing is off for this account', 'LOCATION_OFF');
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLat: body.lat, lastLng: body.lng, lastAccuracy: body.accuracy ?? null, lastHeading: body.heading ?? null, lastSpeed: body.speed ?? null, lastLocationAt: now },
    });
    // Only staff on the move get a trail; a customer's position is just where they live
    const trail = user.role === 'TECHNICIAN' && (!row.lastLocationAt || now.getTime() - row.lastLocationAt.getTime() >= MIN_TRAIL_GAP_MS);
    if (trail) {
      await prisma.locationPing.create({ data: { userId: user.id, lat: body.lat, lng: body.lng, accuracy: body.accuracy ?? null, heading: body.heading ?? null, speed: body.speed ?? null } });
      // Occasional tidy-up so the table stays small
      if (Math.random() < 0.02) await prisma.locationPing.deleteMany({ where: { at: { lt: new Date(now.getTime() - KEEP_TRAIL_MS) } } });
    }
    res.json({ ok: true, at: now });
  }),
);

const point = z
  .string()
  .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, 'Use lat,lng')
  .transform((s) => s.split(',').map(Number) as [number, number])
  .refine(([lat, lng]) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180, 'Out of range');

/** Driving route between two points (for in-app navigation). */
locationRouter.get(
  '/route',
  ah(async (req, res) => {
    const q = parse(z.object({ from: point, to: point }), req.query);
    res.json({ route: await drivingRoute(q.from, q.to) });
  }),
);
