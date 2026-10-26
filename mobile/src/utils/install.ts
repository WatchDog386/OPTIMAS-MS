import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

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

if (isWeb) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
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
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === 'accepted';
  };
  const ios = isIosSafari();
  return {
    /** The browser has offered a one-tap install. */
    canInstall: !!deferred,
    /** iPhone Safari: install only via Share → Add to Home Screen. */
    needsIosSteps: ios && !deferred,
    available: isWeb && !runningAsApp() && (!!deferred || ios),
    install,
  };
}

/** Phone status bar / browser toolbar colour: the same light grey as the top of every screen. */
export const STATUS_BAR_COLOR = '#F3F3F3';

/** Sets (or replaces) the page's theme-color, which Android paints into the status bar. */
export function setThemeColor(color: string) {
  if (!isWeb || typeof document === 'undefined') return;
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  } else if ('serviceWorker' in navigator && location.hostname === 'localhost') {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}
