import { Platform } from 'react-native';
import { excuseLeaving } from '../store/lock';
import { readPhoto } from './barcodeDetect';

export type BarcodeKind = 'label' | 'serial' | 'mac' | 'product';

/**
 * What a scanned barcode is. Router/ONT stickers carry three barcodes: PROD ID (10 digits then letters,
 * e.g. 2150059922GUM3102017), MAC (12 hex characters) and SN (e.g. 48575443D7DF09A8, printed "SN:…").
 * Only the SN (or an Optimas label) identifies the device; the other two are recognised and skipped.
 */
export function readBarcode(raw: string): { kind: BarcodeKind; value: string } {
  // An Optimas label holds a link to the app (…/verify?c=OPTIMAS:…): the code is in it
  const link = /[?&]c=([^&#\s]+)/i.exec(raw);
  if (link) raw = decodeURIComponent(link[1]);
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/^(S\/N|SN|SERIAL( NO\.?| NUMBER)?)\s*[:#.-]?\s*/, '');
  if (v.startsWith('OPTIMAS:')) return { kind: 'label', value: v };
  const compact = v.replace(/[\s:.-]/g, '');
  if (/^[0-9A-F]{12}$/.test(compact) && (/^([0-9A-F]{2}[:.-]){5}[0-9A-F]{2}$/.test(v) || /^[0-9A-F]{12}$/.test(v))) return { kind: 'mac', value: compact };
  if (/^\d{10}[A-Z][A-Z0-9]{5,}$/.test(v)) return { kind: 'product', value: v };
  return { kind: 'serial', value: v };
}

/**
 * Opens the phone's own camera app (sharper and better focused than a live preview), then reads every
 * barcode in the photo with the phone's built-in reader (or ours where the browser has none).
 * Resolves the raw values found, [] when none, or null when the person cancelled.
 */
export function scanWithPhoneCamera(): Promise<string[] | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    excuseLeaving();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(await decodeImage(file));
      } catch {
        resolve([]);
      }
    };
    // Some browsers report a cancelled picker only by the page getting focus back
    window.addEventListener('focus', () => setTimeout(() => !input.files?.length && resolve(null), 1500), { once: true });
    input.click();
  });
}

/** Every code in the photo, read every way there is (see barcodeDetect.ts). */
const decodeImage = (file: Blob) => readPhoto(file);
