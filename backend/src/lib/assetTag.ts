import crypto from 'crypto';
import { env } from '../config/env';
import { badRequest } from './http-error';

/**
 * Optimas device labels. Each sticker carries a QR code "OPTIMAS:<serial>:<signature>". The signature is
 * made with a key only the server holds, so a label cannot be copied onto another device's serial or
 * made up: scanning it proves the device is one Optimas registered, and which one.
 */
const PREFIX = 'OPTIMAS:';
const key = () => env.ASSET_TAG_SECRET || crypto.createHmac('sha256', env.JWT_SECRET).update('optimas-asset-tags').digest('hex');
const sign = (serial: string) => crypto.createHmac('sha256', key()).update(serial).digest('hex').slice(0, 12).toUpperCase();

/** What to print in the QR code for this serial number. */
export const tagFor = (serial: string) => `${PREFIX}${serial}:${sign(serial)}`;

/**
 * Turns whatever was scanned or typed into a serial number. A label is checked (a forged or altered
 * one is refused); a plain serial or maker's barcode is taken as it is (`labelled: false`).
 */
export function readCode(raw: string): { serial: string; labelled: boolean } {
  // Labels hold a link (…/verify?c=OPTIMAS:…) so the phone's own QR scanner opens the app: take the code out
  const link = /[?&]c=([^&#\s]+)/i.exec(raw);
  const s = (link ? decodeURIComponent(link[1]) : raw).trim().toUpperCase();
  if (!s.startsWith(PREFIX)) return { serial: s, labelled: false };
  const cut = s.lastIndexOf(':');
  const serial = s.slice(PREFIX.length, cut);
  const sig = s.slice(cut + 1);
  const good = sign(serial);
  if (!serial || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
    throw badRequest('This label is not a genuine Optimas label. Do not use the device; tell the store.', 'FAKE_LABEL');
  }
  return { serial, labelled: true };
}
