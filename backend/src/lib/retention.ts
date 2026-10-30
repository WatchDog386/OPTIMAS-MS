import { prisma } from './prisma';
import { storage } from './storage';

/**
 * Personal data is kept only as long as it is needed (Kenya Data Protection Act, 2019, s.39). The periods
 * here are the ones stated in the Privacy Policy; change both together.
 */
export const RETENTION = {
  /** Live-location trail points (the "last seen" position on the profile is kept). */
  locationTrailDays: 3,
  /** In-app notifications. */
  notificationDays: 180,
  /** Photos uploaded but never used for a check-in or job (abandoned captures). */
  unusedPhotoDays: 1,
  /** Camera sessions that were never completed. */
  captureChallengeDays: 1,
} as const;

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

/** One clean-up pass. Returns how much was removed, for the log. */
export async function runRetention() {
  const trail = await prisma.locationPing.deleteMany({ where: { at: { lt: ago(RETENTION.locationTrailDays) } } });
  const notes = await prisma.notification.deleteMany({ where: { createdAt: { lt: ago(RETENTION.notificationDays) } } });

  // Abandoned photos: delete the file first, then the record
  const unused = await prisma.photo.findMany({ where: { consumedAt: null, receivedAt: { lt: ago(RETENTION.unusedPhotoDays) } }, select: { id: true, storageKey: true }, take: 500 });
  for (const p of unused) {
    await storage.remove(p.storageKey).catch(() => undefined);
    await prisma.photo.delete({ where: { id: p.id } }).catch(() => undefined);
  }
  const challenges = await prisma.captureChallenge.deleteMany({ where: { photo: null, expiresAt: { lt: ago(RETENTION.captureChallengeDays) } } });
  return { trail: trail.count, notifications: notes.count, unusedPhotos: unused.length, challenges: challenges.count };
}

/** Runs the clean-up shortly after start and then every six hours. */
export function scheduleRetention() {
  const run = () =>
    runRetention()
      .then((r) => {
        if (r.trail || r.notifications || r.unusedPhotos || r.challenges) console.log('[retention] removed', r);
      })
      .catch((err) => console.error('[retention] failed', err));
  const first = setTimeout(run, 60_000);
  const every = setInterval(run, 6 * 3600_000);
  first.unref();
  every.unref();
}
