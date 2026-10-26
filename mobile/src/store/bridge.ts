import { router } from 'expo-router';
import type { CapturePurpose } from '../api/types';

/**
 * Promise bridges for full-screen flows. A screen awaits `requestCapture(...)`; the camera
 * screen resolves it with the verified photo (or null if the user backs out).
 */
export interface CaptureResult {
  /** Empty while the photo is only on the phone (taken offline). */
  photoId: string;
  uri: string;
  flags: string[];
  /** Present when the photo was taken with no signal and still has to be uploaded. */
  pending?: { capturedAt: string; lat?: number; lng?: number; accuracyM?: number; deviceId?: string };
}

let captureResolver: ((r: CaptureResult | null) => void) | null = null;
let scanResolver: ((serials: string[] | null) => void) | null = null;

export function requestCapture(purpose: CapturePurpose, opts: { taskId?: string; title?: string } = {}) {
  captureResolver?.(null);
  return new Promise<CaptureResult | null>((resolve) => {
    captureResolver = resolve;
    router.push({ pathname: '/capture', params: { purpose, taskId: opts.taskId ?? '', title: opts.title ?? '' } });
  });
}

export function resolveCapture(result: CaptureResult | null) {
  captureResolver?.(result);
  captureResolver = null;
}

export function requestScan(opts: { multiple?: boolean; title?: string } = {}) {
  scanResolver?.(null);
  return new Promise<string[] | null>((resolve) => {
    scanResolver = resolve;
    router.push({ pathname: '/scan', params: { multiple: opts.multiple ? '1' : '', title: opts.title ?? '' } });
  });
}

export function resolveScan(serials: string[] | null) {
  scanResolver?.(serials);
  scanResolver = null;
}
