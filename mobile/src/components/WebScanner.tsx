import { createElement, useEffect, useRef } from 'react';

type Detector = { detect: (img: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type NativeDetector = { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };

const FORMATS = ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix', 'pdf417', 'aztec'];

/** The phone's own barcode reader where the browser has one (Chrome on Android), otherwise ours. */
async function makeDetector(): Promise<Detector> {
  const native = (globalThis as unknown as { BarcodeDetector?: NativeDetector }).BarcodeDetector;
  if (native) {
    const supported = await native.getSupportedFormats();
    return new native({ formats: FORMATS.filter((f) => supported.includes(f)) });
  }
  const { BarcodeDetector } = await import('barcode-detector');
  return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector;
}

/**
 * Live barcode scanning in the browser at the camera's full resolution. (A plain camera preview gets a
 * small 640×480 picture, too coarse for the thin barcodes on router stickers.) Reports every code seen.
 */
export function WebScanner({ onCodes, torch, onError }: { onCodes: (codes: string[]) => void; torch: boolean; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const report = useRef(onCodes);
  report.current = onCodes;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const t = stream.getVideoTracks()[0];
        track.current = t;
        // Keep refocusing on whatever is in front of the lens (supported on most Android phones)
        await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        const detector = await makeDetector();
        // Every other frame: the middle of the picture (where the frame on screen is), enlarged, so a thin
        // barcode held in the frame has wider bars to read
        const zoom = document.createElement('canvas');
        let frame = 0;
        const source = (): CanvasImageSource => {
          frame += 1;
          if (frame % 2) return v;
          const w = v.videoWidth * 0.7;
          const h = v.videoHeight * 0.4;
          zoom.width = Math.round(w * 2);
          zoom.height = Math.round(h * 2);
          zoom.getContext('2d')!.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, zoom.width, zoom.height);
          return zoom;
        };
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2 && v.videoWidth) {
            try {
              const found = await detector.detect(source());
              if (found.length) report.current(found.map((f) => f.rawValue).filter(Boolean));
            } catch {
              /* a frame that cannot be read: try the next one */
            }
          }
          timer = setTimeout(tick, 120);
        };
        void tick();
      } catch (e) {
        onError((e as { name?: string })?.name === 'NotAllowedError' ? 'Camera access was refused. Allow the camera for this site in the browser settings.' : 'The camera could not start.');
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The torch, where the phone allows it from the browser
  useEffect(() => {
    void track.current?.applyConstraints({ advanced: [{ torch } as MediaTrackConstraintSet] }).catch(() => undefined);
  }, [torch]);

  return createElement('video', {
    ref: video,
    muted: true,
    playsInline: true,
    autoPlay: true,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
  });
}
