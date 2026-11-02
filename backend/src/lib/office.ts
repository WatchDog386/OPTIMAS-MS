import { prisma } from './prisma';
import { env } from '../config/env';
import { geocode } from './routing';

export type Office = { lat: number; lng: number; radiusM: number; name: string; source: 'app' | 'settings' | 'address' };

const KEY = 'office';
let cached: { at: number; office: Office | null } | null = null;
const FRESH_MS = 60_000;

/**
 * Where staff check in and out. In order: the spot a supervisor set from their phone at the office (in the
 * app), the OFFICE_LAT / OFFICE_LNG settings, or the OFFICE_ADDRESS looked up on the map (saved once found).
 */
export async function getOffice(): Promise<Office | null> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.office;
  const saved = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  let office: Office | null = null;
  if (saved) {
    office = saved.value as unknown as Office;
  } else if (env.OFFICE_LAT !== undefined && env.OFFICE_LNG !== undefined) {
    office = { lat: env.OFFICE_LAT, lng: env.OFFICE_LNG, radiusM: env.OFFICE_RADIUS_M, name: env.OFFICE_ADDRESS, source: 'settings' };
  } else {
    // The address, then just the road and area if the shop itself is not on the map
    const road = env.OFFICE_ADDRESS.split(',').slice(1).join(',').trim();
    const hit = (await geocode(env.OFFICE_ADDRESS)) ?? (road ? await geocode(road) : null);
    if (hit) {
      office = { ...hit, radiusM: env.OFFICE_RADIUS_M, name: env.OFFICE_ADDRESS, source: 'address' };
      await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: office }, update: {} }).catch(() => undefined);
    }
  }
  cached = { at: Date.now(), office };
  return office;
}

/** Sets the office from a phone standing at it. */
export async function setOffice(office: Omit<Office, 'source'>, userId: string) {
  const value: Office = { ...office, source: 'app' };
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value, updatedById: userId }, update: { value, updatedById: userId } });
  cached = { at: Date.now(), office: value };
  return value;
}
