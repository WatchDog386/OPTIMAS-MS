import cluster from 'node:cluster';
import os from 'node:os';
import { env } from './config/env';

/*
 * To serve many people at once the API runs one process per CPU core (WEB_CONCURRENCY, default: the
 * number of cores in production, at most 8). They share the port; the primary process restarts any that stops, and
 * relays "data changed" between them so their in-memory answer caches stay correct. Background jobs
 * (data clean-up, the release announcement) run in one process only.
 */
// In development and tests a single process (unless WEB_CONCURRENCY says otherwise)
const cores = env.NODE_ENV === 'production' ? os.availableParallelism?.() || os.cpus().length || 1 : 1;
const workers = Math.max(1, Math.min(8, env.WEB_CONCURRENCY || cores));

if (cluster.isPrimary && workers > 1) {
  console.log(`🧵 Starting ${workers} API processes`);
  const start = (background: boolean) => {
    const w = cluster.fork({ API_BACKGROUND_JOBS: background ? '1' : '0' });
    // Relay "data changed" to every other process
    w.on('message', (m: { type?: string }) => {
      if (m?.type !== 'data-version') return;
      for (const other of Object.values(cluster.workers ?? {})) if (other && other.id !== w.id) other.send(m);
    });
    w.on('exit', (code, signal) => {
      if (stopping) return;
      console.error(`API process ${w.process.pid} stopped (${signal ?? code}); starting a new one`);
      setTimeout(() => start(background), 1000);
    });
  };
  let stopping = false;
  for (let i = 0; i < workers; i++) start(i === 0);
  const stop = () => {
    stopping = true;
    for (const w of Object.values(cluster.workers ?? {})) w?.process.kill('SIGTERM');
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} else {
  void import('./server').then((m) => m.startServer(workers === 1 || process.env.API_BACKGROUND_JOBS === '1'));
}
