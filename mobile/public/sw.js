/* Optimas MS service worker. The app opens with no signal, as WhatsApp does: the app itself (its page,
   code, fonts and pictures) is kept on the phone and refreshed whenever there is a signal. The data
   (tasks, stock, reports) is kept by the app itself, and work done offline waits in its outbox until
   it can be sent (see src/offline). API calls are never cached here. */

const SHELL = 'optimas-shell-v2';

// On install: the app's page, its start-up code and every page's code file, so it opens offline
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      try {
        const page = await fetch('/', { cache: 'no-cache' });
        if (page.ok) {
          const html = await page.clone().text();
          await cache.put('/', page);
          const refs = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|png|webp|ico|json))"/g)].map((m) => m[1]);
          let chunks = [];
          try {
            const r = await fetch('/chunks.json', { cache: 'no-cache' });
            if (r.ok) chunks = await r.json();
          } catch {
            /* the page code is still cached as it is opened */
          }
          await Promise.all([...new Set([...refs, ...chunks])].map((u) => cache.add(u).catch(() => undefined)));
        }
      } catch {
        /* installed with no signal: everything is cached as it is used */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Waits at most `ms` for the network (a weak signal can hang for a minute), then gives up. */
const fetchWithin = (req, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('slow')), ms);
    fetch(req).then(
      (r) => (clearTimeout(t), resolve(r)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: the newest from the server when it answers within 4 s, otherwise the copy on the phone
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        try {
          const res = await fetchWithin(req, 4000);
          if (res.ok) await cache.put('/', res.clone());
          return res;
        } catch {
          return (await cache.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // Code files have a new name for every build, so a kept copy is always right: phone first
  if (url.pathname.startsWith('/_expo/static/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Everything else (icons, manifest, early scripts): the server, else the kept copy
  if (/\.(js|css|png|webp|ico|json|wasm|svg|ttf|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        try {
          const res = await fetchWithin(req, 4000);
          if (res.ok) await cache.put(req, res.clone());
          return res;
        } catch {
          return (await cache.match(req)) || Response.error();
        }
      })(),
    );
  }
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
        // Tapping it opens what it is about: a chat straight away, anything else through the app (which
        // knows each kind's page) via the notifications page
        data: {
          url:
            msg.data && msg.data.conversationId
              ? `/chat/${msg.data.conversationId}`
              : `/notifications?go=${encodeURIComponent(JSON.stringify({ type: msg.type || '', data: msg.data || {} }))}`,
        },
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
