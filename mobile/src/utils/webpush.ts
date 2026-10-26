import { Platform } from 'react-native';
import { api } from '../api/client';

/*
 * Web push: alerts reach the installed web app even when it is closed (the browser shows them).
 * Needs the server's key pair (deploy/vapid.sh). On iPhones the app must be added to the home screen first.
 */

export type WebPushState = 'unsupported' | 'unavailable' | 'denied' | 'default' | 'granted';

const supported = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined';

function keyBytes(base64Url: string) {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function serverKey() {
  try {
    return (await api<{ publicKey: string | null }>('/notifications/web-push-key')).publicKey;
  } catch {
    return null;
  }
}

/** What the notifications screen should offer on this device. */
export async function webPushState(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  if (!(await serverKey())) return 'unavailable';
  return Notification.permission as WebPushState;
}

/** The service worker, or an error if the app is not installed/served in a way that allows one (instead of waiting forever). */
function workerReady(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The app is not ready for notifications on this device.')), 8000)),
  ]);
}

async function subscribe(key: string) {
  const reg = await workerReady();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api('/notifications/web-push', { body: sub.toJSON() as unknown as Record<string, unknown> });
}

/** Asks permission (must follow a tap) and subscribes this browser. Returns the permission result. */
export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  const key = await serverKey();
  if (!key) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') await subscribe(key);
  return permission as WebPushState;
}

/** At sign-in: if this browser already allowed notifications, make sure the server knows who is on it. */
export async function syncWebPush() {
  try {
    if (!supported() || Notification.permission !== 'granted') return;
    const key = await serverKey();
    if (key) await subscribe(key);
  } catch {
    /* alerts still arrive inside the app */
  }
}

/** Before signing out: stop sending this person's alerts to this browser. */
export async function disableWebPush() {
  try {
    if (!supported()) return;
    const sub = await (await workerReady()).pushManager.getSubscription();
    if (!sub) return;
    await api('/notifications/web-push', { method: 'DELETE', body: { endpoint: sub.endpoint } });
  } catch {
    /* best effort */
  }
}
