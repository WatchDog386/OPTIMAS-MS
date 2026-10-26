import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Build id baked in at export time (see deploy/web.Dockerfile). Absent in development. */
const BUILD = process.env.EXPO_PUBLIC_BUILD_ID;
const CHECK_EVERY_MS = 5 * 60_000;

async function latestBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { build?: string }).build ?? null;
  } catch {
    return null; // offline: try again later
  }
}

/**
 * Installed web app: notices when a newer release has been deployed (on start, when the app is brought
 * back to the foreground, and every few minutes) so the person can switch to it with one tap.
 */
export function useAppUpdate() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !BUILD || typeof document === 'undefined') return;
    let stopped = false;
    const check = async () => {
      const latest = await latestBuild();
      if (!stopped && latest && latest !== BUILD) setAvailable(true);
    };
    const onVisible = () => document.visibilityState === 'visible' && void check();
    void check();
    const t = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const apply = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {
      // the reload below still fetches the new release (index.html is network-first)
    }
    window.location.reload();
  };

  return { available, apply };
}
