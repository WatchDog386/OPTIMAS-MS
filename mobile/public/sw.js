/* Optimas MS service worker. The app works online only (the server is the one database), so nothing
   is cached here: every page, file and API call comes straight from the server. The worker is kept for
   installing the app on phones and for push notifications. */

self.addEventListener('install', () => self.skipWaiting());

// Remove what older versions cached for offline use
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Phones on older Chrome only offer to install an app whose worker answers page requests. Pages always
// come straight from the server (nothing is cached), so installing works on those phones too.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request));
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
