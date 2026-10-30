import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { scheduleRetention } from './lib/retention';

const server = createApp().listen(env.PORT, () => {
  console.log(`🚀 Optimas MS API listening on http://localhost:${env.PORT}/api/v1`);
});
// Delete personal data once it is no longer needed (periods in lib/retention.ts and the Privacy Policy)
scheduleRetention();

const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down…`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
