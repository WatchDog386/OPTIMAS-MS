import { Platform } from 'react-native';

/*
 * Where the waiting work is kept so it survives closing the app: IndexedDB in the browser (room for photos),
 * a file in the app's own folder on a phone.
 */

const DB = 'optimas-offline';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function webLoad<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function webSave<T>(key: string, value: T) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fs() {
  return import('expo-file-system/legacy');
}
async function nativePath(key: string) {
  const FS = await fs();
  return `${FS.documentDirectory}offline-${key.replace(/[^a-z0-9_-]/gi, '_')}.json`;
}

/** Reads one saved value (undefined when nothing was saved or storage is unavailable). */
export async function loadKv<T>(key: string): Promise<T | undefined> {
  try {
    if (Platform.OS === 'web') return await webLoad<T>(key);
    const FS = await fs();
    const path = await nativePath(key);
    if (!(await FS.getInfoAsync(path)).exists) return undefined;
    return JSON.parse(await FS.readAsStringAsync(path)) as T;
  } catch {
    return undefined;
  }
}

export async function saveKv<T>(key: string, value: T) {
  try {
    if (Platform.OS === 'web') return await webSave(key, value);
    const FS = await fs();
    await FS.writeAsStringAsync(await nativePath(key), JSON.stringify(value));
  } catch {
    /* storage full or blocked: the in-memory copy still works until the app closes */
  }
}

export const loadQueue = async <T>() => (await loadKv<T[]>('queue')) ?? [];
export const saveQueue = <T>(items: T[]) => saveKv('queue', items);

/** A photo as a data: address, so it can be stored and sent later whatever the platform. */
export async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  const FS = await fs();
  return `data:image/jpeg;base64,${await FS.readAsStringAsync(uri, { encoding: 'base64' })}`;
}

/** A file address the upload form can use for a stored photo (a phone needs a real file, a browser takes the data: address). */
export async function photoFileUri(dataUri: string): Promise<string> {
  if (Platform.OS === 'web') return dataUri;
  const FS = await fs();
  const path = `${FS.cacheDirectory}offline-${Date.now()}.jpg`;
  await FS.writeAsStringAsync(path, dataUri.replace(/^data:[^,]+,/, ''), { encoding: 'base64' });
  return path;
}
