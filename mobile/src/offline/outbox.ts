import { useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { api, ApiError, newKey } from '../api/client';
import { patchCache, patchCacheWhere } from '../api/cache';
import type { CapturePurpose } from '../api/types';
import { useAuth } from '../store/auth';
import { toast } from '../store/feedback';
import { setOnline } from '../store/network';
import { uriToBlob } from '../utils/upload';
import { kvGet, kvSet } from './kv';

/*
 * The outbox: how the app works with no signal, the way WhatsApp sends a message typed offline.
 *
 *  1. A change (check in, start or finish a task, a daily report, "used 2 ATB boxes", a chat message) is
 *     tried at once. With no signal, or while older changes are still waiting, it goes into the outbox on
 *     the phone instead (kept when the app is closed) and the screen shows it as done, "waiting to send".
 *  2. Photos taken offline wait in the outbox too, with the time and place they were really taken. A
 *     change that needs that photo refers to it as "local:…" until it has been sent.
 *  3. When the signal returns (and every 15 seconds while anything waits) the outbox is sent in the order
 *     things were done: the photo first, then the check-in that uses it, then the check-out after it.
 *  4. Each change carries the same Idempotency-Key on every try, so the server does it once even if an
 *     answer is lost on a weak signal and it is sent again.
 *  5. Sent changes show a double tick; one the server refuses (e.g. the task was reassigned meanwhile)
 *     shows why, with Retry and Remove, and the ones after it still go.
 */

export type OutboxState = 'waiting' | 'sending' | 'sent' | 'failed';

export interface OutboxPhoto {
  dataUri: string;
  purpose: CapturePurpose;
  taskId?: string;
  capturedAt: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  deviceId?: string;
}

export interface OutboxItem {
  /** Also the Idempotency-Key: the same on every try. */
  id: string;
  /** Whose work it is: on a shared phone one person's outbox is never sent as another. */
  userId: string;
  /** What the person did, as they would say it: "Started task TSK-0123". */
  label: string;
  method: string;
  path: string;
  body?: Record<string, unknown>;
  /** A photo waiting to be sent; `ref` is how later changes refer to it until it has a server id. */
  photo?: OutboxPhoto;
  ref?: string;
  taskId?: string;
  createdAt: string;
  state: OutboxState;
  attempts: number;
  error?: string;
  sentAt?: string;
}

/** Sent items stay listed (with their double tick) for a day. */
const KEEP_SENT_MS = 24 * 3_600_000;
const KEY = 'outbox';
const REFS = 'outbox-refs';

let items: OutboxItem[] = [];
/** local:… photo reference → the server's photo id, once sent. */
let refs: Record<string, string> = {};
let loaded: Promise<void> | null = null;
let running = false;
const listeners = new Set<() => void>();

const ready = () =>
  (loaded ??= Promise.all([kvGet<OutboxItem[]>(KEY), kvGet<Record<string, string>>(REFS)]).then(([saved, savedRefs]) => {
    const keep = (saved ?? []).map((i) => (i.state === 'sending' ? { ...i, state: 'waiting' as const } : i));
    items = [...keep, ...items.filter((i) => !keep.some((s) => s.id === i.id))];
    refs = { ...(savedRefs ?? {}), ...refs };
    emit();
  }));

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

async function persist() {
  const cutoff = Date.now() - KEEP_SENT_MS;
  items = items.filter((i) => i.state !== 'sent' || !i.sentAt || Date.parse(i.sentAt) > cutoff);
  emit();
  await Promise.all([kvSet(KEY, items), kvSet(REFS, refs)]);
}

const me = () => useAuth.getState().user?.id ?? null;
const mine = () => items.filter((i) => i.userId === me());
const isOpen = (i: OutboxItem) => i.state === 'waiting' || i.state === 'sending';

/** True when the phone says it has no connection at all (a weak signal still counts as online here). */
export const phoneOffline = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;

async function add(item: Omit<OutboxItem, 'userId' | 'createdAt' | 'state' | 'attempts'>) {
  await ready();
  const userId = me();
  if (!userId) throw new ApiError(401, 'Sign in again to save this.', 'SIGNED_OUT');
  items = [...items, { ...item, userId, createdAt: new Date().toISOString(), state: 'waiting', attempts: 0 }];
  await persist();
  void syncNow();
}

export type Submitted<T> = { queued: false; data: T } | { queued: true; id: string };

/**
 * Sends a change now, or keeps it in the outbox to send later. Use for anything a technician does in the
 * field. `label` is how it is listed in the outbox ("Checked in", "Started task TSK-0123").
 */
export async function submit<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  o: { label: string; taskId?: string; method?: string },
): Promise<Submitted<T>> {
  await ready();
  const method = o.method ?? 'POST';
  const id = newKey();
  // Older changes still waiting go first (a check-out never overtakes its check-in), and a change that
  // uses a photo still on the phone waits for that photo
  const mustWait = mine().some(isOpen) || JSON.stringify(body ?? {}).includes('"local:');
  if (!mustWait && !phoneOffline()) {
    try {
      return { queued: false, data: await api<T>(path, { method, body, key: id }) };
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'NETWORK')) throw e;
      // The signal dropped: keep it, under the same key (the server may have received it already)
    }
  }
  await add({ id, label: o.label, method, path, body, taskId: o.taskId });
  toast.info('Saved on this phone', phoneOffline() ? 'No internet now. It will be sent as soon as you are back online.' : 'Sending in a moment.');
  return { queued: true, id };
}

/** A photo taken with no signal: kept on the phone and sent first when the signal returns. */
export async function keepPhoto(photo: Omit<OutboxPhoto, 'dataUri'> & { uri: string }, label: string): Promise<string> {
  const { uri, ...rest } = photo;
  const ref = `local:${newKey()}`;
  await add({ id: newKey(), ref, label, method: 'POST', path: '/capture/upload', photo: { ...rest, dataUri: await toDataUri(uri) }, taskId: rest.taskId });
  return ref;
}

/** Puts the server's photo ids in place of the local:… references. */
function resolveRefs(v: unknown): unknown {
  if (typeof v === 'string' && v.startsWith('local:')) {
    if (!refs[v]) throw new MissingPhoto();
    return refs[v];
  }
  if (Array.isArray(v)) return v.map(resolveRefs);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveRefs(x)]));
  return v;
}
class MissingPhoto extends Error {}

async function sendPhoto(item: OutboxItem): Promise<string> {
  const p = item.photo!;
  // The challenge is asked for now (it is single-use); the photo keeps the time it was really taken
  const challenge = await api<{ challengeId: string; nonce: string }>('/capture/challenge', { body: { purpose: p.purpose, taskId: p.taskId } });
  const form = new FormData();
  form.append('photo', await uriToBlob(p.dataUri), 'capture.jpg');
  form.append('challengeId', challenge.challengeId);
  form.append('nonce', challenge.nonce);
  form.append('deviceTime', p.capturedAt);
  form.append('offline', '1');
  if (p.lat != null && p.lng != null) {
    form.append('lat', String(p.lat));
    form.append('lng', String(p.lng));
    if (p.accuracyM != null) form.append('accuracyM', String(p.accuracyM));
  }
  if (p.deviceId) form.append('deviceId', p.deviceId);
  return (await api<{ photoId: string }>('/capture/upload', { body: form, key: item.id })).photoId;
}

type Outcome = 'sent' | 'failed' | 'later';

async function sendOne(item: OutboxItem): Promise<Outcome> {
  try {
    if (item.photo) {
      refs[item.ref!] = await sendPhoto(item);
      item.photo = { ...item.photo, dataUri: '' }; // the photo is on the server now; free the space
    } else {
      await api(item.path, { method: item.method, body: resolveRefs(item.body) as Record<string, unknown> | undefined, key: item.id });
    }
    return 'sent';
  } catch (e) {
    if (e instanceof MissingPhoto) {
      item.error = 'Its photo could not be sent. Open it and take the photo again.';
      return 'failed';
    }
    if (!(e instanceof ApiError)) return 'later';
    if (e.code === 'NETWORK' || e.code === 'IN_PROGRESS' || e.status === 401 || e.status === 429 || e.status >= 500) return 'later';
    item.error = e.message;
    return 'failed';
  }
}

/** Sends everything waiting, oldest first; stops at the first thing that needs a better signal. */
export async function syncNow() {
  if (running || !useAuth.getState().token) return;
  running = true;
  let sent = 0;
  try {
    await ready();
    for (const item of mine()) {
      if (!isOpen(item)) continue;
      item.state = 'sending';
      item.attempts += 1;
      emit();
      const outcome = await sendOne(item);
      if (outcome === 'later') {
        item.state = 'waiting';
        await persist();
        break;
      }
      if (outcome === 'sent') {
        item.state = 'sent';
        item.sentAt = new Date().toISOString();
        item.error = undefined;
        if (!item.photo) sent += 1;
        setOnline(true);
      } else {
        item.state = 'failed';
        toast.error('Could not send', `${item.label}: ${item.error}`);
      }
      await persist();
    }
  } finally {
    running = false;
  }
  if (sent) toast.success(sent === 1 ? 'Sent' : `${sent} sent`, 'Work saved offline has reached the office.');
}

export async function retry(id: string) {
  await ready();
  items = items.map((i) => (i.id === id && i.state === 'failed' ? { ...i, state: 'waiting', error: undefined } : i));
  await persist();
  void syncNow();
}

export async function remove(id: string) {
  await ready();
  items = items.filter((i) => i.id !== id);
  await persist();
}

/** Clears the double-ticked history. */
export async function clearSent() {
  await ready();
  items = items.filter((i) => i.userId !== me() || i.state !== 'sent');
  await persist();
}

/** How many of the signed-in person's changes have not reached the server yet. */
export const unsentCount = () => mine().filter((i) => i.state !== 'sent').length;

/** Sends in the background: now, when the signal returns, when the app comes back, and every 15 s. */
export function startOutbox() {
  void ready().then(syncNow);
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => undefined;
  const onOnline = () => void syncNow();
  const onVisible = () => document.visibilityState === 'visible' && void syncNow();
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(() => {
    if (mine().some(isOpen)) void syncNow();
  }, 15_000);
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}

/** The signed-in person's outbox, newest first, kept up to date. */
export function useOutbox() {
  void ready();
  const all = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
  const userId = useAuth((s) => s.user?.id);
  return useMemo(() => all.filter((i) => i.userId === userId).reverse(), [all, userId]);
}

/** What is still waiting for one task (shown on its card and page). */
export function useTaskOutbox(taskId?: string) {
  const all = useOutbox();
  return useMemo(() => (taskId ? all.filter((i) => i.taskId === taskId && i.state !== 'sent' && !i.photo) : []), [all, taskId]);
}

/** A photo as a data: address, so it can be kept on the phone and sent later. */
export async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await uriToBlob(uri);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * A change kept in the outbox shows at once on this phone, as WhatsApp shows your message before it is
 * delivered: the task's page and every saved task list get the new state.
 */
export function showTaskLocally(taskId: string, patch: Record<string, unknown>) {
  patchCache<{ task: Record<string, unknown> }>(`/tasks/${taskId}`, (d) => (d?.task ? { ...d, task: { ...d.task, ...patch } } : d));
  patchCacheWhere<{ tasks?: Record<string, unknown>[] }>(
    (p) => p.startsWith('/tasks?'),
    (d) => (Array.isArray(d?.tasks) ? { ...d, tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : d),
  );
}
