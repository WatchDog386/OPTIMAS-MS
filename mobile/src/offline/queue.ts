import { useMemo, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Application from 'expo-application';
import { api, ApiError } from '../api/client';
import type { CapturePurpose } from '../api/types';
import { DEMO_TOKEN } from '../api/demoToken';
import type { CaptureResult } from '../store/bridge';
import { useAuth } from '../store/auth';
import { toast } from '../store/feedback';
import { appendFile } from '../utils/upload';
import { loadQueue, photoFileUri, saveQueue, toDataUri } from './store';

/*
 * Offline work. A technician with no signal still takes the proof photo; it is kept on the phone together
 * with what they were doing, and sent automatically (photo first, then the action) when the signal returns.
 * The server records the time the photo was really taken, and marks it "taken offline" for the supervisor.
 */

export interface QueuedAction {
  id: string;
  /** Whose work it is: on a shared phone, one person's queue is never sent as another. */
  userId: string;
  kind: CapturePurpose;
  /** Shown to the person: "Job JOB-2851 started" */
  label: string;
  /** The API call that goes with the photo, e.g. /tasks/…/start */
  path: string;
  body: Record<string, unknown>;
  taskId?: string;
  /** The photo as a data: address, kept until the action is accepted. */
  photoData: string;
  /** True when the photo was taken with no signal (it still has to be uploaded). */
  offlinePhoto: boolean;
  /** Set once the photo reached the server. */
  photoId?: string;
  capturedAt: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  deviceId?: string;
  queuedAt: string;
  attempts: number;
  /** Why the server refused it (the person must look at it). */
  failed?: string;
}

let items: QueuedAction[] = [];
let loaded: Promise<void> | null = null;
let running = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const ready = () =>
  (loaded ??= loadQueue<QueuedAction>().then((saved) => {
    // Anything queued before the app finished loading stays after what was saved
    items = [...saved, ...items.filter((i) => !saved.some((s) => s.id === i.id))];
    emit();
  }));

async function persist() {
  items = [...items];
  emit();
  await saveQueue(items);
}

export const isDemoSession = () => useAuth.getState().token === DEMO_TOKEN;

async function deviceId() {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId();
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) ?? undefined;
  } catch {
    /* not available */
  }
  return undefined;
}

export async function enqueue(a: Omit<QueuedAction, 'id' | 'userId' | 'queuedAt' | 'attempts'>) {
  await ready();
  const userId = useAuth.getState().user?.id;
  if (!userId) return;
  // The same step twice (e.g. pressing "Complete" again while the first is still waiting) would only collide on the server
  if (items.some((i) => i.userId === userId && i.path === a.path && !i.failed)) {
    toast.info('Already waiting to send', a.label);
    return;
  }
  items = [...items, { ...a, userId, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString(), attempts: 0 }];
  await persist();
  void syncNow();
}

/** Sends the photo (fresh challenge, flagged as taken offline) and returns the server's photo id. */
async function uploadPhoto(item: QueuedAction) {
  const challenge = await api<{ challengeId: string; nonce: string }>('/capture/challenge', { body: { purpose: item.kind, taskId: item.taskId } });
  const form = new FormData();
  await appendFile(form, 'photo', await photoFileUri(item.photoData), 'capture.jpg', 'image/jpeg');
  form.append('challengeId', challenge.challengeId);
  form.append('nonce', challenge.nonce);
  form.append('deviceTime', item.capturedAt);
  form.append('offline', '1');
  if (item.lat != null && item.lng != null) {
    form.append('lat', String(item.lat));
    form.append('lng', String(item.lng));
    if (item.accuracyM != null) form.append('accuracyM', String(item.accuracyM));
  }
  if (item.deviceId) form.append('deviceId', item.deviceId);
  return (await api<{ photoId: string }>('/capture/upload', { body: form })).photoId;
}

type Outcome = 'sent' | 'failed' | 'retry-later';

async function sendOne(item: QueuedAction): Promise<Outcome> {
  try {
    if (!item.photoId) {
      item.photoId = await uploadPhoto(item);
      await persist();
    }
    await api(item.path, { body: { ...item.body, photoId: item.photoId } });
    return 'sent';
  } catch (e) {
    if (!(e instanceof ApiError)) return 'retry-later';
    if (e.code === 'NETWORK' || e.status === 401 || e.status === 429 || e.status >= 500) return 'retry-later';
    // The server already applied it earlier and only the answer was lost
    if (e.code === 'PHOTO_USED') return 'sent';
    // The uploaded photo waited too long: send the stored copy again
    if (e.code === 'PHOTO_STALE' || e.code === 'PHOTO_INVALID') {
      item.photoId = undefined;
      item.offlinePhoto = true;
      item.attempts += 1;
      return item.attempts < 4 ? 'retry-later' : (item.failed = e.message, 'failed');
    }
    item.failed = e.message;
    return 'failed';
  }
}

/** Sends everything that is waiting, oldest first, stopping at the first thing that needs a signal. */
export async function syncNow() {
  if (running || isDemoSession() || !useAuth.getState().token) return;
  running = true;
  try {
    await ready();
    const me = useAuth.getState().user?.id;
    for (const item of items.filter((i) => i.userId === me)) {
      if (item.failed) continue;
      const outcome = await sendOne(item);
      if (outcome === 'retry-later') {
        await persist();
        break;
      }
      if (outcome === 'sent') {
        items = items.filter((i) => i.id !== item.id);
        toast.success('Sent', item.label);
      } else {
        toast.error('Could not send', `${item.label}: ${item.failed}`);
      }
      await persist();
    }
  } finally {
    running = false;
  }
}

export async function dismiss(id: string) {
  await ready();
  items = items.filter((i) => i.id !== id);
  await persist();
}

export async function retryFailed() {
  await ready();
  const me = useAuth.getState().user?.id;
  items = items.map((i) => (i.userId === me && i.failed ? { ...i, failed: undefined, attempts: 0 } : i));
  await persist();
  void syncNow();
}

/** Starts sending in the background: every 20 s, when the signal returns, and when the app comes back to the front. */
export function startSyncLoop() {
  void ready().then(() => syncNow());
  const timer = setInterval(() => void syncNow(), 20_000);
  const onOnline = () => void syncNow();
  if (Platform.OS === 'web') globalThis.addEventListener?.('online', onOnline);
  const sub = AppState.addEventListener('change', (s) => s === 'active' && void syncNow());
  return () => {
    clearInterval(timer);
    if (Platform.OS === 'web') globalThis.removeEventListener?.('online', onOnline);
    sub.remove();
  };
}

export function useSyncQueue() {
  void ready();
  const all = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
  const me = useAuth((s) => s.user?.id);
  return useMemo(() => all.filter((i) => i.userId === me), [all, me]);
}

/**
 * Sends a captured photo and its action. Online it is one step; with no signal (the photo was taken offline,
 * or the signal dropped after it) the pair is saved on the phone and sent later.
 */
export async function submitWithPhoto<T>(
  photo: CaptureResult,
  a: { kind: CapturePurpose; label: string; path: string; body?: Record<string, unknown>; taskId?: string },
): Promise<{ queued: false; data: T } | { queued: true }> {
  const body = a.body ?? {};
  if (!photo.pending) {
    try {
      return { queued: false, data: await api<T>(a.path, { body: { ...body, photoId: photo.photoId } }) };
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'NETWORK')) throw e;
      await enqueue({ ...a, body, photoData: await toDataUri(photo.uri), offlinePhoto: false, photoId: photo.photoId, capturedAt: new Date().toISOString(), deviceId: await deviceId() });
      return { queued: true };
    }
  }
  const p = photo.pending;
  await enqueue({ ...a, body, photoData: await toDataUri(photo.uri), offlinePhoto: true, capturedAt: p.capturedAt, lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, deviceId: p.deviceId });
  return { queued: true };
}
