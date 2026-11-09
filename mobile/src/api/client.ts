import Constants from 'expo-constants';
import { useAuth } from '../store/auth';
import { ApiError } from './errors';
import { setOnline } from '../store/network';

/** API base URL: EXPO_PUBLIC_API_URL env var, else app.json `extra.apiUrl`. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000/api/v1';

export { ApiError } from './errors';

type Body = Record<string, unknown> | FormData | undefined;

/** Turns an API answer into the result, or the error the screens show. */
function settle<T>(status: number, json: { error?: { message?: string; code?: string; details?: { field: string; message: string }[] } } | null, token: string | null): T {
  if (status < 200 || status >= 300) {
    if (status === 401 && token) useAuth.getState().logout();
    const err = json?.error ?? {};
    const detail = Array.isArray(err.details) && err.details[0]?.message;
    throw new ApiError(status, detail || err.message || 'Request failed', err.code, err.details);
  }
  return (json ?? {}) as T;
}

/** When this phone last changed something (a successful write): reads made before it are not reused. */
let lastWriteAt = 0;
export const lastWrite = () => lastWriteAt;

async function send<T>(path: string, options: { method?: string; body?: Body }): Promise<T> {
  const token = useAuth.getState().token;
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    setOnline(false);
    throw new ApiError(0, 'Cannot reach the Optimas server. Check your internet connection.', 'NETWORK');
  }
  setOnline(true);
  return settle<T>(res.status, await res.json().catch(() => ({})), token);
}

/*
 * Fewer, larger requests. Reads asked for within a few milliseconds of each other (a page opening asks for
 * all its data at once) go to the server together in ONE request (POST /batch), and the same read asked
 * twice at the same moment (two parts of the screen polling the unread count) is fetched once and shared.
 * On a phone network each request costs a round trip of a few hundred milliseconds, so this is most of
 * the waiting gone.
 */
const inFlight = new Map<string, Promise<unknown>>();
let queue: { path: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const GATHER_MS = 12;
const MAX_BATCH = 12;

function flush() {
  timer = null;
  const parts = queue.splice(0, MAX_BATCH);
  if (queue.length) timer = setTimeout(flush, 0);
  if (!parts.length) return;
  if (parts.length === 1) {
    const [one] = parts;
    send(one!.path, {}).then(one!.resolve, one!.reject);
    return;
  }
  const token = useAuth.getState().token;
  send<{ results: { status: number; body: unknown }[] }>('/batch', { body: { paths: parts.map((p) => p.path) } }).then(
    ({ results }) =>
      parts.forEach((p, i) => {
        const r = results[i];
        try {
          p.resolve(settle(r?.status ?? 502, (r?.body ?? null) as never, token));
        } catch (e) {
          p.reject(e);
        }
      }),
    // The batch itself failed (offline, or an older server without /batch): ask each one on its own
    (e) => (e instanceof ApiError && e.code === 'NETWORK' ? parts.forEach((p) => p.reject(e)) : parts.forEach((p) => send(p.path, {}).then(p.resolve, p.reject))),
  );
}

export async function api<T>(path: string, options: { method?: string; body?: Body } = {}): Promise<T> {
  const isRead = !options.body && (options.method ?? 'GET') === 'GET';
  if (!isRead) {
    const result = await send<T>(path, options);
    if (path !== '/batch') lastWriteAt = Date.now();
    return result;
  }
  const shared = inFlight.get(path);
  if (shared) return shared as Promise<T>;
  const p = new Promise<T>((resolve, reject) => {
    queue.push({ path, resolve: resolve as (v: unknown) => void, reject });
    if (!timer) timer = setTimeout(flush, GATHER_MS);
  }).finally(() => inFlight.delete(path));
  inFlight.set(path, p);
  return p;
}

/** Proof photos are served by the API (signed-in, permission-checked). */
export const photoUrl = (id: string) => `${API_URL}/capture/photos/${id}`;
export const authHeader = (): Record<string, string> => {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
