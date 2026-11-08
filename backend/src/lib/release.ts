import { prisma } from './prisma';
import { env } from '../config/env';
import { notify } from '../modules/notifications/notifications.service';

const KEY = 'app.release';

/**
 * When the server starts on a new release (APP_BUILD changed since the last start), everyone is told
 * once: a phone notification and an entry in their notifications. Opening the app loads the new version.
 * Restarting on the same release says nothing.
 */
export async function announceRelease(): Promise<number> {
  const build = env.APP_BUILD.trim();
  if (!build) return 0;
  // Claim this release atomically, so it is announced once even if two servers start together
  const claimed = await prisma.$transaction(async (tx) => {
    const last = await tx.setting.findUnique({ where: { key: KEY } });
    if ((last?.value as { build?: string } | null)?.build === build) return false;
    await tx.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: { build, at: new Date().toISOString() } }, update: { value: { build, at: new Date().toISOString() } } });
    return true;
  });
  if (!claimed) return 0;
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  await notify(
    users.map((u) => u.id),
    { type: 'APP_UPDATE', title: 'Optimas MS has been updated', body: 'A new version is live. Open the app to get the latest improvements.', data: { build } },
  );
  return users.length;
}
