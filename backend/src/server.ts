import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { scheduleRetention } from './lib/retention';
import { scheduleTaskRelease } from './modules/tasks/release';
import { scheduleFollowUp } from './modules/tasks/follow-up';
import { announceRelease } from './lib/release';

/** One API process. `background`: this one also runs the background jobs. */
export function startServer(background: boolean) {
  const server = createApp().listen(env.PORT, () => {
    console.log(`🚀 Optimas MS API listening on http://localhost:${env.PORT}/api/v1 (pid ${process.pid})`);
    if (!background) return;
    // A new release: tell everyone (once)
    announceRelease()
      .then((n) => n && console.log(`📣 Release ${env.APP_BUILD} announced to ${n} people`))
      .catch((err) => console.error('[release] announcement failed', err));
  });
  // Many phones keep their connection open between polls: keep it alive a little longer than the proxy does
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  // Delete personal data once it is no longer needed (periods in lib/retention.ts and the Privacy Policy)
  if (background) scheduleRetention();
  // Tasks made for a later day go out on the morning of their day
  if (background) scheduleTaskRelease();
  // Assigned tasks are followed until they are opened, started, finished and reported
  if (background) scheduleFollowUp();

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down…`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
