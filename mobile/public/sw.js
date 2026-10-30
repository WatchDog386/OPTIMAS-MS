/* Optimas MS service worker: makes the web console installable and caches the app shell.
   API calls (/api/*) always go to the network — data is never served stale. */
const SHELL = 'optimas-shell-v7';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.json', '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // The release marker must always come from the server
  if (url.pathname === '/version.json') return;
  // Pages: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // The manifest carries the theme colour and icons: always prefer the latest copy.
  if (url.pathname === '/manifest.json') {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  // Static assets (hashed bundles, fonts, icons): cache first.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// ── Push notifications (the server sends { title, body, type, data }) ──────────────────────────────
self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { title: 'Optimas MS', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    (async () => {
      // If the app is open and in front, it already shows the alert itself
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (open.some((c) => c.visibilityState === 'visible')) return;
      await self.registration.showNotification(msg.title || 'Optimas MS', {
        body: msg.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // Chat messages open their conversation (one alert per conversation); everything else the inbox
        tag: msg.data && msg.data.conversationId ? `chat-${msg.data.conversationId}` : msg.type || 'optimas',
        data: { url: msg.data && msg.data.conversationId ? `/chat/${msg.data.conversationId}` : '/notifications' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/notifications';
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of open) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
