import { Platform } from 'react-native';

let started = false;

/**
 * Each page's code is a separate file that used to be downloaded only when the page was first opened, so
 * on a slow connection a page waited for its code and then for its data. Once someone is signed in, this
 * downloads every page's code in the background, a few files at a time when the phone is idle; the
 * browser keeps them (they never change, each build has new file names), so pages open with only their
 * data to wait for. Skipped when the phone asks to save data.
 */
export function prefetchPages() {
  if (Platform.OS !== 'web' || started || typeof document === 'undefined') return;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  started = true;
  const idle = (fn: () => void) =>
    (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback?.(fn, { timeout: 3000 }) ?? setTimeout(fn, 300);
  // Let the first page finish opening before starting
  setTimeout(async () => {
    let files: string[] = [];
    try {
      const res = await fetch('/chunks.json', { cache: 'no-cache' });
      if (res.ok) files = (await res.json()) as string[];
    } catch {
      return;
    }
    const loaded = new Set(Array.from(document.scripts, (s) => new URL(s.src || 'about:blank', location.href).pathname));
    const queue = files.filter((f) => typeof f === 'string' && f.startsWith('/_expo/static/js/') && !loaded.has(f));
    const next = () => {
      const batch = queue.splice(0, 4);
      if (!batch.length) return;
      Promise.all(
        batch.map(
          (href) =>
            new Promise<void>((done) => {
              const link = document.createElement('link');
              link.rel = 'prefetch';
              link.as = 'script';
              link.href = href;
              link.onload = link.onerror = () => done();
              document.head.appendChild(link);
            }),
        ),
      ).then(() => idle(next));
    };
    idle(next);
  }, 1500);
}
