/*
 * Reading router and ONT stickers accurately.
 *
 * - Only the barcode types found on those stickers (Code 128 above all, Code 39/93, QR, Data Matrix).
 *   EAN, UPC, ITF and Codabar were dropped: they never appear there, but often "read" a fragment of
 *   another barcode, giving short wrong numbers.
 * - Each picture is looked at several ways, in turn: as it is, the middle enlarged (thin bars become
 *   wider), its upper and lower halves enlarged (a barcode not lined up in the frame), the middle in
 *   high-contrast black and white (faded or glossy stickers), sharpened (slightly out of focus), and
 *   turned a quarter (held sideways).
 * - Two readers: the phone's own (Chrome on Android) and ours (ZXing, built in). When one finds nothing,
 *   the other is tried, since each misses barcodes the other reads.
 */

type Hit = { rawValue: string; format?: string };
type Detector = { detect: (img: CanvasImageSource) => Promise<Hit[]> };
type NativeDetector = { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };

export const STICKER_FORMATS = ['code_128', 'code_39', 'code_93', 'qr_code', 'data_matrix'];

let readers: Promise<Detector[]> | null = null;

/** The readers to use: the phone's own (if any), then ours. */
export function stickerReaders(): Promise<Detector[]> {
  readers ??= (async () => {
    const list: Detector[] = [];
    const native = (globalThis as unknown as { BarcodeDetector?: NativeDetector }).BarcodeDetector;
    if (native) {
      try {
        const supported = await native.getSupportedFormats();
        const formats = STICKER_FORMATS.filter((f) => supported.includes(f));
        if (formats.length) list.push(new native({ formats }));
      } catch {
        /* no usable built-in reader */
      }
    }
    try {
      const { BarcodeDetector } = await import('barcode-detector');
      list.push(new BarcodeDetector({ formats: STICKER_FORMATS as never }) as unknown as Detector);
    } catch {
      /* ours could not load (offline): the phone's own still works */
    }
    return list;
  })();
  return readers;
}

/** One view of the picture to read. */
export type View = 'whole' | 'zoom' | 'upper' | 'lower' | 'contrast' | 'sharp' | 'turned';
/** In turn, frame by frame: the middle (where people aim) comes up most often. */
export const VIEWS: View[] = ['zoom', 'whole', 'lower', 'sharp', 'upper', 'zoom', 'contrast', 'turned'];

const canvases = new Map<View, HTMLCanvasElement>();
const canvasFor = (v: View) => {
  let c = canvases.get(v);
  if (!c) {
    c = document.createElement('canvas');
    canvases.set(v, c);
  }
  return c;
};

/** Draws one view of `src` (a video frame or a photo) and returns what to read. */
export function viewOf(src: CanvasImageSource & { width?: number; height?: number }, w: number, h: number, view: View): CanvasImageSource {
  if (view === 'whole') return src;
  const c = canvasFor(view);
  const ctx = c.getContext('2d', { willReadFrequently: view === 'contrast' })!;
  // The middle of the picture, where the frame on screen is — or its upper or lower half, for a barcode
  // that is not lined up in the frame (stickers carry three barcodes one above the other)
  const cw = w * (view === 'upper' || view === 'lower' ? 0.92 : 0.8);
  const ch = h * (view === 'upper' || view === 'lower' ? 0.42 : 0.5);
  const sx = (w - cw) / 2;
  const sy = view === 'upper' ? h * 0.12 : view === 'lower' ? h * 0.46 : (h - ch) / 2;
  if (view === 'turned') {
    // A quarter turn of the middle, for a sticker held (or printed) sideways
    const tw = w * 0.5;
    const th = h * 0.8;
    c.width = Math.round(th * 1.5);
    c.height = Math.round(tw * 1.5);
    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, (w - tw) / 2, (h - th) / 2, tw, th, (-tw * 1.5) / 2, (-th * 1.5) / 2, tw * 1.5, th * 1.5);
    ctx.restore();
    return c;
  }
  // Enlarged so thin bars are several pixels wide (capped so it stays quick)
  const scale = Math.min(2.2, 2600 / cw);
  c.width = Math.round(cw * scale);
  c.height = Math.round(ch * scale);
  ctx.imageSmoothingEnabled = view !== 'contrast';
  ctx.drawImage(src, sx, sy, cw, ch, 0, 0, c.width, c.height);
  if (view === 'sharp') {
    // Sharpened (a slightly blurred, out-of-focus barcode gets crisp bar edges back)
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const out = new Uint8ClampedArray(d.length);
    const row = c.width * 4;
    for (let i = 0; i < d.length; i += 4) {
      const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      out[i] = y;
    }
    for (let i = row; i < d.length - row; i += 4) {
      const v = 5 * out[i] - out[i - 4] - out[i + 4] - out[i - row] - out[i + row];
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (view === 'contrast') {
    // Black and white around the picture's own middle grey: faded, glossy or dim prints read better
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const mid = sum / (d.length / 16);
    for (let i = 0; i < d.length; i += 4) {
      const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const v = y < mid * 0.92 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

/** Reads one view with the readers in turn (the second only when the first found nothing). */
export async function readView(img: CanvasImageSource, list: Detector[]): Promise<string[]> {
  for (const r of list) {
    try {
      const found = await r.detect(img);
      const values = found.map((f) => f.rawValue?.trim()).filter((v): v is string => !!v && v.length >= 6);
      if (values.length) return values;
    } catch {
      /* this reader could not read this view: try the next */
    }
  }
  return [];
}

/** Reads a still photo every way there is, and returns every distinct code in it. */
export async function readPhoto(file: Blob): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const base = document.createElement('canvas');
  base.width = Math.round(bitmap.width * scale);
  base.height = Math.round(bitmap.height * scale);
  base.getContext('2d')!.drawImage(bitmap, 0, 0, base.width, base.height);
  const list = await stickerReaders();
  const all = new Set<string>();
  for (const v of VIEWS) (await readView(viewOf(base, base.width, base.height, v), list)).forEach((x) => all.add(x));
  return [...all];
}
