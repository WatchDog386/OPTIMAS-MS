import { api } from '../api/client';
import { apiCache, attachPersistence } from '../api/cache';
import type { Task } from '../api/types';
import { useAuth } from '../store/auth';
import { loadKv, saveKv } from './store';

/*
 * A technician's day on the phone: today's jobs (each with its details), their stock and attendance are kept
 * on the device and refreshed in the background, so those screens open with no signal.
 */

const cacheKey = (userId: string) => `cache:${userId}`;

/** Puts what was saved last time back into the screen cache, and starts saving new data for this person. */
export async function restoreOfflineCache(userId: string) {
  const saved = await loadKv<[string, { data: unknown; at: number }][]>(cacheKey(userId));
  for (const [path, entry] of saved ?? []) if (!apiCache.has(path)) apiCache.set(path, entry);
  attachPersistence((entries) => void saveKv(cacheKey(userId), entries));
}

const LISTS = ['/attendance/today', '/tasks?status=IN_PROGRESS,ASSIGNED', '/tasks?status=COMPLETED,VERIFIED', '/tasks', '/inventory/my', '/reports/me'];

/** Fetches the working data and every open job's details into the cache. Silent when there is no signal. */
export async function prefetchWork() {
  const { token, user } = useAuth.getState();
  if (!token || user?.role !== 'TECHNICIAN') return;
  try {
    const results = await Promise.all(
      LISTS.map(async (p) => {
        const data = await api<unknown>(p);
        apiCache.set(p, { data, at: Date.now() });
        return [p, data] as const;
      }),
    );
    const open = (results.find(([p]) => p === '/tasks?status=IN_PROGRESS,ASSIGNED')?.[1] as { tasks: Task[] } | undefined)?.tasks ?? [];
    await Promise.all(
      open.map(async (t) => {
        const path = `/tasks/${t.id}`;
        apiCache.set(path, { data: await api<unknown>(path), at: Date.now() });
      }),
    );
  } catch {
    // no signal: whatever was saved before stays in use
  }
}
