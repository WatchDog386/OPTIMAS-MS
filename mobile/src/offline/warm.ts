import { api, onWrite } from '../api/client';
import { apiCache } from '../api/cache';
import type { Task } from '../api/types';
import { useAuth } from '../store/auth';

/*
 * While there is a signal, a technician's working set is fetched in the background and kept on the phone
 * (see api/cache.ts): today's tasks and each open task's details, their stock, attendance and today's
 * report. Walking into a basement with no signal, every one of those pages still opens.
 */

const FIELD = ['TECHNICIAN', 'SUPERVISOR'];
const PATHS = [
  '/attendance/today',
  '/attendance/checkout-ready',
  '/tasks?status=IN_PROGRESS,ASSIGNED',
  '/tasks?status=IN_PROGRESS,ASSIGNED&created=today',
  '/tasks?created=today',
  '/inventory/my',
  '/day-reports/mine',
  '/reports/me',
];

let running = false;
let again = false;

export async function warmForOffline(): Promise<void> {
  const user = useAuth.getState().user;
  if (!user || !FIELD.includes(user.role)) return;
  // Asked again while fetching (a change was just made): fetch once more afterwards
  if (running) return void (again = true);
  running = true;
  try {
    const got = await Promise.all(
      PATHS.map((p) =>
        api<unknown>(p)
          .then((data) => (apiCache.set(p, { data, at: Date.now() }), data))
          .catch(() => null),
      ),
    );
    // The open tasks' own pages (details, customer, map pin)
    const open = (got[2] as { tasks?: Task[] } | null)?.tasks ?? [];
    await Promise.all(
      open.slice(0, 25).map((t) =>
        api<unknown>(`/tasks/${t.id}`)
          .then((data) => apiCache.set(`/tasks/${t.id}`, { data, at: Date.now() }))
          .catch(() => undefined),
      ),
    );
  } finally {
    running = false;
  }
  if (again) {
    again = false;
    return warmForOffline();
  }
}

/** Now, every 5 minutes, after each change, and whenever the signal returns. */
export function startWarming() {
  const first = setTimeout(() => void warmForOffline(), 4000);
  const timer = setInterval(() => void warmForOffline(), 5 * 60_000);
  const onOnline = () => void warmForOffline();
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
  // After a check-in, a started task or a sent report, the copy on the phone is brought up to date at once
  let soon: ReturnType<typeof setTimeout> | null = null;
  const offWrite = onWrite((path) => {
    if (/^\/(location|chat|notifications|capture)/.test(path)) return;
    if (soon) clearTimeout(soon);
    soon = setTimeout(() => void warmForOffline(), 1500);
  });
  return () => {
    offWrite();
    if (soon) clearTimeout(soon);
    clearTimeout(first);
    clearInterval(timer);
    if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
  };
}
