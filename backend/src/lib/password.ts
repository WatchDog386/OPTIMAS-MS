import crypto from 'crypto';
import { z } from 'zod';

/** At least 8 characters with a letter and a number. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Readable one-time password, e.g. "Opt-7kQm4xRb". The user must change it at first sign-in. */
export function temporaryPassword(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  // guarantee a digit for the password policy
  return `Opt-${out.slice(0, 7)}${2 + (bytes[0] % 8)}`;
}
