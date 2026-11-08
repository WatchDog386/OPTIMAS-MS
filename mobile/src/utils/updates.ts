import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { toast } from '../store/feedback';

/** Build id baked in at export time (see deploy/web.Dockerfile). Absent in development. */
const BUILD = process.env.EXPO_PUBLIC_BUILD_ID;
const CHECK_EVERY_MS = 2 * 60_000;

async function newerBuildLive(): Promise<boolean> {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  const latest = ((await res.json()) as { build?: string }).build;
  return !!BUILD && !!latest && latest !== BUILD;
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
    // The first time a new version opens on this phone, say so
    try {
      const seen = localStorage.getItem('optimas.build');
      if (seen && seen !== BUILD) setTimeout(() => toast.success('Optimas MS updated', 'You are on the latest version.'), 2500);
      localStorage.setItem('optimas.build', BUILD);
    } catch {
      // private browsing: nothing to compare with
    }
    const check = async () => {
      try {
        if (!stopped && (await newerBuildLive())) setAvailable(true);
      } catch {
        // offline: try again later
      }
    };
    void check();
    const t = setInterval(check, CHECK_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      stopped = true;
      clearInterval(t);
      sub.remove();
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
