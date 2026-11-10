import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isDark } from '../theme/colors';

/**
 * PWA install support for the web console. The browser fires `beforeinstallprompt`
 * once the app is installable; we keep the event so an Install button can trigger it later.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
/** Set when this browser installed the app, so the tab it was installed from stops offering it. */
const INSTALLED_KEY = 'optimas.installed';
const installedHere = () => {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
};

if (isWeb) {
  // Caught by /pwa-early.js before this code loaded
  const early = () => {
    const e = (window as unknown as { __optimasInstall?: InstallEvent | null }).__optimasInstall;
    if (e && e !== deferred) {
      deferred = e;
      emit();
    }
  };
  early();
  window.addEventListener('optimas-installable', early);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    try {
      localStorage.setItem(INSTALLED_KEY, '1');
    } catch {
      /* private mode */
    }
    emit();
  });
}

/** Already running as an installed app (home-screen icon / standalone window). */
export function runningAsApp(): boolean {
  if (!isWeb) return true; // the native app is already "installed"
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Waits up to `ms` for the browser to offer installing (it can come a moment after the page loads). */
function offerWithin(ms: number): Promise<InstallEvent | null> {
  if (deferred) return Promise.resolve(deferred);
  return new Promise((resolve) => {
    const done = () => {
      listeners.delete(check);
      clearTimeout(t);
      resolve(deferred);
    };
    const check = () => {
      if (deferred) done();
    };
    listeners.add(check);
    const t = setTimeout(done, ms);
  });
}

/**
 * The Install button: installs the app straight away, with no steps to follow.
 * - Chrome, Edge, Samsung Internet (and Chrome on a laptop): the phone's own Install opens at once.
 * - Inside WhatsApp / Facebook / Instagram, or Firefox, on Android (which cannot install apps): the app
 *   reopens in Chrome, where the Install comes up straight away.
 * - iPhone and iPad: Apple lets no website install itself; resolves 'blocked' (only Safari's Share →
 *   Add to Home Screen can do it).
 */
export async function installNow(): Promise<'installed' | 'dismissed' | 'reopened' | 'blocked'> {
  if (!isWeb) return 'blocked';
  const e = await offerWithin(2500);
  if (e) {
    try {
      await e.prompt();
    } catch {
      return 'dismissed';
    }
    const { outcome } = await e.userChoice;
    deferred = null;
    (window as unknown as { __optimasInstall?: InstallEvent | null }).__optimasInstall = null;
    emit();
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  }
  // A browser on Android that cannot install apps (inside WhatsApp & co, Firefox, Samsung without the
  // offer): reopen in Chrome. Never from Chrome itself (or after a reopen), so it cannot go round in circles.
  const kind = browserKind();
  if (/Android/i.test(navigator.userAgent) && (kind === 'in-app' || kind === 'firefox' || kind === 'samsung') && !reopenedToInstall()) {
    // Open this app in Chrome, which installs it; ?install=1 brings the Install up there at once
    const url = new URL(window.location.href);
    url.searchParams.set('install', '1');
    window.location.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
    return 'reopened';
  }
  return 'blocked';
}

/** The page was reopened in Chrome by the Install button: bring Install up again straight away. */
export const reopenedToInstall = () => isWeb && new URLSearchParams(window.location.search).get('install') === '1';

export const isIosSafari = () =>
  isWeb && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const install = async () => {
    if (!deferred) return false;
    const e = deferred;
    try {
      await e.prompt();
    } catch {
      return false; // e.g. the tap was too long ago: the offer stays for the next tap
    }
    const { outcome } = await e.userChoice;
    // The browser's offer can be used once
    deferred = null;
    (window as unknown as { __optimasInstall?: InstallEvent | null }).__optimasInstall = null;
    emit();
    return outcome === 'accepted';
  };
  const ios = isIosSafari();
  return {
    /** The browser has offered a one-tap install. */
    canInstall: !!deferred,
    /** iPhone Safari: install only via Share → Add to Home Screen. */
    needsIosSteps: ios && !deferred,
    /**
     * Shown to everyone who opened the app in a browser and has not installed it; tapping installs it
     * (see installNow). Hidden inside the installed app.
     */
    available: isWeb && !runningAsApp() && !installedHere(),
    install,
  };
}

/** Which browser the page is open in, for install steps. */
export type BrowserKind = 'in-app' | 'ios-safari' | 'ios-other' | 'samsung' | 'firefox' | 'chrome' | 'desktop';
export function browserKind(): BrowserKind {
  if (!isWeb) return 'chrome';
  const ua = navigator.userAgent;
  // WhatsApp, Facebook, Instagram, Telegram… open links in their own small browser, which cannot install
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Telegram|Line\/|MicroMessenger|; wv\)/i.test(ua)) return 'in-app';
  if (/iPhone|iPad|iPod/i.test(ua)) return /CriOS|FxiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox/i.test(ua)) return 'firefox';
  if (/Android/i.test(ua)) return 'chrome';
  return 'desktop';
}

/** Phone status bar colour at rest: the page's own colour, so the top of the screen is one even surface. */
export const STATUS_BAR_COLOR = isDark ? '#121212' : '#F8FAFC';
/** Once the page is scrolled, the top bar and the status bar turn this colour together (one band). */
export const BAR_SCROLLED_COLOR = isDark ? '#1A1C1B' : '#FFFFFF';
/** The opening splash's blue: the status bar matches it until the splash has gone. */
export const SPLASH_BAR_COLOR = '#16307A';

// While the splash shows, the bar stays blue; the colour pages ask for is applied when it goes
let splashUp = true;
let wanted = STATUS_BAR_COLOR;
/** The opening splash has gone: paint the status bar for the page underneath. */
export function splashDone() {
  splashUp = false;
  setThemeColor(wanted);
}

/** Sets (or replaces) the page's theme-color, which Android paints into the status bar. */
export function setThemeColor(color: string) {
  if (!isWeb || typeof document === 'undefined') return;
  wanted = color;
  if (splashUp) color = SPLASH_BAR_COLOR;
  const tags = document.head.querySelectorAll('meta[name="theme-color"]');
  tags.forEach((t, i) => (i === 0 ? t.setAttribute('content', color) : t.remove()));
  if (!tags.length) {
    const el = document.createElement('meta');
    el.setAttribute('name', 'theme-color');
    el.setAttribute('content', color);
    document.head.appendChild(el);
  }
}

/** Adds the manifest, icons and service worker to the web console (no-op on native). */
export function setupPwa() {
  if (!isWeb || typeof document === 'undefined') return;
  const head = document.head;
  const add = (tag: string, attrs: Record<string, string>) => {
    const sel = `${tag}[${Object.entries(attrs)
      .slice(0, 1)
      .map(([k, v]) => `${k}="${v}"`)
      .join('')}]`;
    if (head.querySelector(sel)) return;
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    head.appendChild(el);
  };
  add('link', { rel: 'manifest', href: '/manifest.json' });
  add('link', { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' });
  setThemeColor(STATUS_BAR_COLOR);
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Optimas MS' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    // For installing the app and push notifications only: it caches nothing (online only)
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}
