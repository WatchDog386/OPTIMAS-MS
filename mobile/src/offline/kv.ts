/*
 * The phone's own storage for offline use (IndexedDB: room for photos, kept when the app is closed).
 * If the browser blocks it (private mode) or it stops answering, everything still works for as long as
 * the app stays open: nothing here may ever hold up signing in or opening the app.
 */

// Not "optimas-offline": versions of the app from before 15 Nov delete that one when they start, and an
// old copy still open on the phone would then block this one (sign-in hung waiting for it)
const DB = 'optimas-outbox';
const STORE = 'kv';
/** The longest any storage step may take before the app carries on without it. */
const WAIT_MS = 2000;
let db: Promise<IDBDatabase> | null = null;

const within = <T>(p: Promise<T>, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), WAIT_MS))]);

function open(): Promise<IDBDatabase> {
  return (db ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No storage'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const d = req.result;
      // Another copy of the app wants to change or delete the store: let it, and open again next time
      d.onversionchange = () => {
        d.close();
        db = null;
      };
      resolve(d);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Storage blocked'));
    setTimeout(() => reject(new Error('Storage not answering')), WAIT_MS);
  }).catch((e) => {
    db = null;
    throw e;
  }));
}

export function kvGet<T>(key: string): Promise<T | undefined> {
  return within(
    open().then(
      (d) =>
        new Promise<T | undefined>((resolve, reject) => {
          const req = d.transaction(STORE).objectStore(STORE).get(key);
          req.onsuccess = () => resolve(req.result as T | undefined);
          req.onerror = () => reject(req.error);
        }),
    ),
    undefined,
  );
}

export function kvSet<T>(key: string, value: T): Promise<void> {
  return within(
    open().then(
      (d) =>
        new Promise<void>((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    ),
    undefined,
  );
}

export function kvDelete(key: string): Promise<void> {
  return within(
    open().then(
      (d) =>
        new Promise<void>((resolve) => {
          const tx = d.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        }),
    ),
    undefined,
  );
}

/**
 * Reads (once) what the 14–15 Nov version kept under the old store name, so work saved offline then is
 * not lost. Gives up quietly after a moment if that store is busy or gone.
 */
const MIGRATED = 'optimas.outbox.migrated';
export const legacyDone = () => {
  try {
    localStorage.setItem(MIGRATED, '1');
  } catch {
    /* ignore */
  }
};
export function legacyGet<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);
  try {
    if (localStorage.getItem(MIGRATED)) return Promise.resolve(undefined);
  } catch {
    /* ignore */
  }
  return within(
    new Promise<T | undefined>((resolve) => {
      const req = indexedDB.open('optimas-offline', 1);
      req.onupgradeneeded = () => req.transaction?.abort(); // it was never there: create nothing
      req.onerror = () => resolve(undefined);
      req.onblocked = () => resolve(undefined);
      req.onsuccess = () => {
        const d = req.result;
        try {
          const get = d.transaction(STORE).objectStore(STORE).get(key);
          get.onsuccess = () => (resolve(get.result as T | undefined), d.close());
          get.onerror = () => (resolve(undefined), d.close());
        } catch {
          d.close();
          resolve(undefined);
        }
      };
    }),
    undefined,
  );
}
