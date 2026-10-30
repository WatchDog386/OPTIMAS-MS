import { Platform } from 'react-native';
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api, ApiError } from '../api/client';

/**
 * Fingerprint lock with the phone's own sensor (WebAuthn). The server checks every unlock; this device
 * remembers only that the lock is on and which key it registered.
 */
const KEY = (userId: string) => `optimas.lock.${userId}`;

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/** Does this phone/browser have a fingerprint, face or screen-lock sensor the app can use? */
export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS !== 'web' || !browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
}

/** The key this device registered for the person, when the lock is on here. */
export const lockKeyOnThisDevice = (userId: string): string | null => storage()?.getItem(KEY(userId)) ?? null;

type RegOptions = Parameters<typeof startRegistration>[0]['optionsJSON'];
type AuthOptions = Parameters<typeof startAuthentication>[0]['optionsJSON'];

/**
 * Options are fetched before the tap, so the phone's fingerprint prompt opens straight from the tap
 * (iPhones refuse it when a network wait comes in between). They are used once and kept 4 minutes.
 */
const FRESH_MS = 4 * 60_000;
let ready: { kind: 'register' | 'unlock'; at: number; options: RegOptions | AuthOptions } | null = null;

let fetching: Promise<void> | null = null;

export function prepareBiometric(kind: 'register' | 'unlock') {
  // The server keeps one challenge per person, so only one fetch at a time and only the latest counts
  if (fetching || (ready && ready.kind === kind && Date.now() - ready.at < FRESH_MS)) return fetching ?? Promise.resolve();
  fetching = api<RegOptions | AuthOptions>(kind === 'register' ? '/auth/passkeys/register-options' : '/auth/passkeys/unlock-options', { body: {} })
    .then((options) => {
      ready = { kind, at: Date.now(), options };
    })
    .catch(() => {
      ready = null; // fetched again on the tap, which shows the reason
    })
    .finally(() => {
      fetching = null;
    });
  return fetching;
}

async function take(kind: 'register' | 'unlock') {
  if (fetching) await fetching;
  const r = ready;
  ready = null;
  if (r && r.kind === kind && Date.now() - r.at < FRESH_MS) return r.options;
  return api<RegOptions | AuthOptions>(kind === 'register' ? '/auth/passkeys/register-options' : '/auth/passkeys/unlock-options', { body: {} });
}

/** Registers this phone's sensor and turns the lock on for this device. */
export async function enableBiometricLock(userId: string) {
  const optionsJSON = (await take('register')) as RegOptions;
  const response = await startRegistration({ optionsJSON });
  const device = typeof navigator !== 'undefined' ? navigator.userAgent.replace(/\s*\(.*?\)\s*/g, ' ').slice(0, 70) : undefined;
  const { id } = await api<{ id: string }>('/auth/passkeys/register', { body: { response: response as unknown as Record<string, unknown>, deviceName: device } });
  storage()?.setItem(KEY(userId), id);
}

/** Turns the lock off on this device and forgets its key on the server. */
export async function disableBiometricLock(userId: string) {
  const id = lockKeyOnThisDevice(userId);
  storage()?.removeItem(KEY(userId));
  if (id) await api(`/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
}

/** Asks for the fingerprint and has the server check it. Resolves true when unlocked. */
export async function unlockWithBiometric(): Promise<boolean> {
  const optionsJSON = (await take('unlock')) as AuthOptions;
  const response = await startAuthentication({ optionsJSON });
  await api('/auth/passkeys/unlock', { body: { response: response as unknown as Record<string, unknown> } });
  return true;
}

/** A plain-words reason for a failed fingerprint step (the phone's own errors are cryptic). */
export function biometricProblem(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const name = (e as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'AbortError':
      return 'The fingerprint prompt was closed or timed out. Make sure this phone has a screen lock and a fingerprint set up in its Settings, then try again.';
    case 'SecurityError':
      return 'Fingerprint lock works only on the secure https:// address of the app.';
    case 'NotSupportedError':
    case 'ConstraintError':
      return 'This browser cannot use the fingerprint sensor. Open the app in Chrome (Android) or Safari (iPhone).';
    case 'InvalidStateError':
      return 'This phone already has a fingerprint key for your account. Try again.';
    default:
      return (e as { message?: string })?.message || 'Try again.';
  }
}
