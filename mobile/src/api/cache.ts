/**
 * Last good response per API path, kept in memory for the session. Screens render it instantly on return
 * (stale-while-revalidate) instead of flashing a spinner. Cleared on sign-out so one person's data is
 * never shown to the next person on a shared phone. Dependency-free so the auth store can import it.
 *
 * A technician's own working data (jobs, stock, today's attendance) is also saved on the phone, so those
 * screens still open with no signal. `attachPersistence` is given the saving function once a person is known.
 */
type Entry = { data: unknown; at: number };

/** The paths worth keeping on the phone. */
const KEEP = [/^\/tasks/, /^\/inventory\/my/, /^\/attendance\/today/, /^\/reports\/me/];
export const isKept = (path: string) => KEEP.some((r) => r.test(path));

let persist: ((entries: [string, Entry][]) => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => persist?.([...apiCache.entries()].filter(([k]) => isKept(k))), 1500);
}

class Cache extends Map<string, Entry> {
  set(key: string, value: Entry) {
    super.set(key, value);
    if (persist && isKept(key)) schedule();
    return this;
  }
  clear() {
    super.clear();
    clearTimeout(timer);
    persist?.([]);
  }
}

export const apiCache = new Cache();
export const clearApiCache = () => apiCache.clear();
export const attachPersistence = (fn: ((entries: [string, Entry][]) => void) | null) => {
  persist = fn;
};
