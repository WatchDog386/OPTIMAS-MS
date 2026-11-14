import { kvDelete, kvGet, kvSet } from '../offline/kv';

/**
 * Last good response per API path. Screens render it instantly (then refresh from the server) instead of
 * flashing a spinner, and it is also kept on the phone for the signed-in person, so with no signal the app
 * opens on the last tasks, stock and attendance it saw, the way WhatsApp opens on your last chats.
 * Cleared on sign-out so one person's data is never shown to the next person.
 */
type Entry = { data: unknown; at: number };

/** Kept on the phone: the newest few hundred answers; very large ones (long lists) are left out. */
const MAX_SAVED = 200;
const MAX_BYTES = 400_000;

let owner: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const KEY = (userId: string) => `cache:${userId}`;

class SavedCache extends Map<string, Entry> {
  override set(path: string, entry: Entry) {
    super.set(path, entry);
    scheduleSave();
    return this;
  }
}

export const apiCache = new SavedCache();

function scheduleSave() {
  if (!owner || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!owner) return;
    const rows = [...apiCache.entries()]
      .filter(([path, e]) => path !== '/batch' && JSON.stringify(e.data ?? null).length < MAX_BYTES)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, MAX_SAVED);
    void kvSet(KEY(owner), rows);
  }, 1500);
}

/** After sign-in (or when the app opens signed in): put back what this person's phone saved last time. */
export async function restoreApiCache(userId: string) {
  owner = userId;
  const rows = await kvGet<[string, Entry][]>(KEY(userId));
  if (!rows || owner !== userId) return;
  for (const [path, e] of rows) if (!apiCache.has(path)) Map.prototype.set.call(apiCache, path, e);
}

export const clearApiCache = () => {
  apiCache.clear();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (owner) void kvDelete(KEY(owner));
  owner = null;
};

/** Changes saved data in place (a change made offline shows at once, before the server has it). */
export function patchCache<T>(path: string, fn: (data: T) => T) {
  const e = apiCache.get(path);
  if (e) apiCache.set(path, { data: fn(e.data as T), at: e.at });
}

/** Every saved answer whose path starts with `prefix` (e.g. all task lists). */
export function patchCacheWhere<T>(match: (path: string) => boolean, fn: (data: T) => T) {
  for (const [path, e] of [...apiCache.entries()]) if (match(path)) apiCache.set(path, { data: fn(e.data as T), at: e.at });
}
