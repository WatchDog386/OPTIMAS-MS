import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';

/** Build id baked in at export time (see deploy/web.Dockerfile). Absent in development. */
const BUILD = process.env.EXPO_PUBLIC_BUILD_ID;
const WEB_CHECK_MS = 5 * 60_000;
const ANDROID_CHECK_MS = 30 * 60_000;
/** Published by .github/workflows/android.yml on every build of main. */
const ANDROID_RELEASE = 'https://api.github.com/repos/WatchDog386/OPTIMAS-MS/releases/tags/android-latest';

interface Release {
  available: boolean;
  /** Where to get it (Android: the APK download). */
  url?: string;
}

async function webRelease(): Promise<Release> {
  const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return { available: false };
  const latest = ((await res.json()) as { build?: string }).build;
  return { available: !!BUILD && !!latest && latest !== BUILD };
}

async function androidRelease(): Promise<Release> {
  const res = await fetch(ANDROID_RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return { available: false };
  const rel = (await res.json()) as { body?: string; assets?: { name: string; browser_download_url: string }[] };
  const latest = Number(/versionCode:\s*(\d+)/.exec(rel.body ?? '')?.[1] ?? 0);
  const mine = Number(Application.nativeBuildVersion ?? 0);
  const apk = rel.assets?.find((a) => a.name.endsWith('.apk'))?.browser_download_url;
  return { available: !!apk && latest > mine, url: apk };
}

/**
 * Notices when a newer release is out so the person can switch with one tap:
 *  - installed web app: a new deploy (checked on start, on return to the app and every 5 min)
 *  - Android app: a newer APK on the GitHub release (on start, on return and every 30 min)
 */
export function useAppUpdate() {
  const [release, setRelease] = useState<Release>({ available: false });

  useEffect(() => {
    const web = Platform.OS === 'web';
    if (web ? !BUILD || typeof document === 'undefined' : Platform.OS !== 'android') return;
    let stopped = false;
    const check = async () => {
      try {
        const r = await (web ? webRelease() : androidRelease());
        if (!stopped && r.available) setRelease(r);
      } catch {
        // offline: try again later
      }
    };
    void check();
    const t = setInterval(check, web ? WEB_CHECK_MS : ANDROID_CHECK_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => {
      stopped = true;
      clearInterval(t);
      sub.remove();
    };
  }, []);

  const apply = async () => {
    if (Platform.OS !== 'web') {
      if (release.url) await Linking.openURL(release.url); // Android downloads it and offers to install
      return;
    }
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {
      // the reload below still fetches the new release (index.html is network-first)
    }
    window.location.reload();
  };

  return { available: release.available, apply, native: Platform.OS !== 'web' };
}
