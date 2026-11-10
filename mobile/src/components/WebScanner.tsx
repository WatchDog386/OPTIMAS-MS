import { createElement, useEffect, useRef } from 'react';

import { readView, stickerReaders, viewOf, VIEWS } from '../utils/barcodeDetect';

/**
 * Live barcode scanning in the browser at the camera's full resolution. (A plain camera preview gets a
 * small 640×480 picture, too coarse for the thin barcodes on router stickers.)
 *
 * Accuracy: each frame is read one of four ways in turn (whole, middle enlarged, high contrast, turned),
 * by the phone's own reader and ours; and a code is only reported once it has been read twice within a
 * few seconds, so a single misread is never taken. Optimas QR labels (signed) are reported at once.
 */
const CONFIRM_MS = 3000;

export function WebScanner({ onCodes, torch, zoom = 1, onError }: { onCodes: (codes: string[]) => void; torch: boolean; zoom?: number; onError: (message: string) => void }) {
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
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 }, frameRate: { ideal: 30 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const t = stream.getVideoTracks()[0];
        track.current = t;
        // Keep refocusing on whatever is in front of the lens (supported on most Android phones)
        await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => undefined);
        const readers = await stickerReaders();
        if (!readers.length) throw new Error('no reader');
        let frame = 0;
        // Codes read recently: value → when it was first and last read, and whether it was reported
        const seen = new Map<string, { first: number; count: number; reported: boolean }>();
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2 && v.videoWidth) {
            const view = VIEWS[frame % VIEWS.length];
            frame += 1;
            try {
              const found = await readView(viewOf(v, v.videoWidth, v.videoHeight, view), readers);
              const now = Date.now();
              const confirmed: string[] = [];
              for (const value of new Set(found)) {
                const label = /^OPTIMAS:|[?&]c=/i.test(value);
                const s = seen.get(value);
                const entry = s && now - s.first < CONFIRM_MS ? { ...s, count: s.count + 1 } : { first: now, count: 1, reported: false };
                if (!entry.reported && (label || entry.count >= 2)) {
                  entry.reported = true;
                  confirmed.push(value);
                }
                seen.set(value, entry);
              }
              if (confirmed.length) report.current(confirmed);
            } catch {
              /* a frame that cannot be read: try the next one */
            }
          }
          timer = setTimeout(tick, 70);
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

  // Zoom (the camera's own, where the phone allows it): small barcodes fill more of the picture while the
  // phone stays far enough away to focus
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const caps = (t.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
    if (!caps.zoom) return;
    const z = Math.min(caps.zoom.max, Math.max(caps.zoom.min, zoom));
    void t.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).catch(() => undefined);
  }, [zoom]);

  return createElement('video', {
    ref: video,
    muted: true,
    playsInline: true,
    autoPlay: true,
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000' },
  });
}
