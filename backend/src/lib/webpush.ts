import webpush from 'web-push';
import { env } from '../config/env';

/** Web push is on only when the server has been given its VAPID key pair. */
export const webPushPublicKey = env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? env.VAPID_PUBLIC_KEY : null;

if (webPushPublicKey) webpush.setVapidDetails(env.VAPID_SUBJECT, webPushPublicKey, env.VAPID_PRIVATE_KEY!);

export interface WebPushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one push; resolves false when the browser says the subscription is gone (so it can be removed). */
export async function sendWebPush(target: WebPushTarget, payload: Record<string, unknown>): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return false;
    console.warn('[web-push] send failed', status ?? err);
    return true;
  }
}
