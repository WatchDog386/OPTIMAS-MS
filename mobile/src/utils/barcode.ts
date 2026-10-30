import { Platform } from 'react-native';

export type BarcodeKind = 'label' | 'serial' | 'mac' | 'product';

/**
 * What a scanned barcode is. Router/ONT stickers carry three barcodes: PROD ID (10 digits then letters,
 * e.g. 2150059922GUM3102017), MAC (12 hex characters) and SN (e.g. 48575443D7DF09A8, printed "SN:…").
 * Only the SN (or an Optimas label) identifies the device; the other two are recognised and skipped.
 */
export function readBarcode(raw: string): { kind: BarcodeKind; value: string } {
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

const FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix', 'pdf417', 'aztec'];

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

type Detector = { detect: (img: CanvasImageSource) => Promise<{ rawValue: string }[]> };

async function decodeImage(file: Blob): Promise<string[]> {
  const native = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  let detector: Detector;
  if (native) {
    const supported = await native.getSupportedFormats();
    detector = new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
  } else {
    const { BarcodeDetector } = await import('barcode-detector');
    detector = new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
  }
  const bitmap = await createImageBitmap(file);
  // Very large photos are slow to read and gain nothing: keep the long side near 2400 px
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const found = await detector.detect(canvas);
  return [...new Set(found.map((f) => f.rawValue).filter(Boolean))];
}
