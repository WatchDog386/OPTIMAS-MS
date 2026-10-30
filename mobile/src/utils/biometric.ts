import { Platform } from 'react-native';
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { api } from '../api/client';

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

/** Registers this phone's sensor and turns the lock on for this device. */
export async function enableBiometricLock(userId: string) {
  const optionsJSON = await api<Parameters<typeof startRegistration>[0]['optionsJSON']>('/auth/passkeys/register-options', { body: {} });
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
  const optionsJSON = await api<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/auth/passkeys/unlock-options', { body: {} });
  const response = await startAuthentication({ optionsJSON });
  await api('/auth/passkeys/unlock', { body: { response: response as unknown as Record<string, unknown> } });
  return true;
}
