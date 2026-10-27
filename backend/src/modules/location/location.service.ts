import { prisma } from '../../lib/prisma';
import { workDateOf } from '../../lib/time';

/** A live position counts as "live" for this long; after that the person shows as last seen. */
export const LIVE_MS = 10 * 60_000;
/** Older positions are not used to pick the nearest technician. */
export const STALE_MS = 3 * 60 * 60_000;

export interface Position {
  lat: number;
  lng: number;
  at: Date;
  heading: number | null;
  speed: number | null;
  /** 'live' = the phone is reporting right now; 'recent' = reported earlier; 'photo' = from today's GPS-stamped photo. */
  kind: 'live' | 'recent' | 'photo';
}

/**
 * Best known position for each user: the phone's last report, or failing that the newest GPS-stamped
 * photo taken today (check-in, job photos), so people who have not shared live location still show up.
 */
export async function positionsOf(userIds: string[]): Promise<Map<string, Position>> {
  const out = new Map<string, Position>();
  if (!userIds.length) return out;
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, lastLat: true, lastLng: true, lastLocationAt: true, lastHeading: true, lastSpeed: true },
  });
  for (const u of users) {
    if (u.lastLat == null || u.lastLng == null || !u.lastLocationAt) continue;
    const age = Date.now() - u.lastLocationAt.getTime();
    if (age > STALE_MS) continue;
    out.set(u.id, { lat: u.lastLat, lng: u.lastLng, at: u.lastLocationAt, heading: u.lastHeading, speed: u.lastSpeed, kind: age <= LIVE_MS ? 'live' : 'recent' });
  }
  const missing = userIds.filter((id) => !out.has(id));
  if (missing.length) {
    const photos = await prisma.photo.findMany({
      where: { userId: { in: missing }, receivedAt: { gte: workDateOf() }, lat: { not: null }, lng: { not: null } },
      orderBy: { receivedAt: 'desc' },
      select: { userId: true, lat: true, lng: true, receivedAt: true },
    });
    for (const p of photos) {
      if (out.has(p.userId)) continue;
      out.set(p.userId, { lat: p.lat!, lng: p.lng!, at: p.receivedAt, heading: null, speed: null, kind: 'photo' });
    }
  }
  return out;
}

/** The path a technician has driven recently, oldest first, as [lat, lng] pairs. */
export async function trailOf(userId: string, sinceMs = 45 * 60_000) {
  const pings = await prisma.locationPing.findMany({
    where: { userId, at: { gte: new Date(Date.now() - sinceMs) } },
    orderBy: { at: 'asc' },
    select: { lat: true, lng: true },
    take: 500,
  });
  return pings.map((p) => [p.lat, p.lng] as [number, number]);
}
