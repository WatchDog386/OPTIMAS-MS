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
    const e = deferred;
    await e.prompt();
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
     * Shown when tapping it can install: one tap where the browser allows (Chrome, Samsung Internet,
     * Edge), or the only way there is (iPhone: Share → Add to Home Screen; WhatsApp/Facebook's own
     * browser: open in Chrome first).
     */
    available: isWeb && !runningAsApp() && (!!deferred || ['ios-safari', 'ios-other', 'in-app'].includes(browserKind())),
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

/** Step-by-step install instructions for browsers that do not offer a one-tap install. */
export function installSteps(kind: BrowserKind = browserKind()): string[] {
  switch (kind) {
    case 'in-app':
      return ['This page is open inside another app (WhatsApp, Facebook…), which cannot install apps.', 'Tap ⋮ (or ⋯) at the top and choose "Open in Chrome" (iPhone: "Open in Safari").', 'Then tap Install app again.'];
    case 'ios-safari':
      return ['Tap the Share button at the bottom of Safari.', 'Scroll down and choose "Add to Home Screen".', 'Tap "Add". Optimas MS appears on your home screen.'];
    case 'ios-other':
      return ['Tap the Share button (in the address bar or menu).', 'Choose "Add to Home Screen" (if it is not there, open this page in Safari).', 'Tap "Add".'];
    case 'samsung':
      return ['Tap the menu ☰ at the bottom right.', 'Choose "Add page to", then "Home screen".', 'Tap "Add".'];
    case 'firefox':
      return ['Tap the menu ⋮.', 'Choose "Install" (or "Add to Home screen").', 'Tap "Add".'];
    case 'chrome':
      return ['Tap the menu ⋮ at the top right of Chrome.', 'Choose "Install app" (or "Add to Home screen").', 'Tap "Install".'];
    default:
      return ['Click the install icon at the right of the address bar (a screen with a down arrow).', 'Or open the browser menu and choose "Install Optimas MS".'];
  }
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
