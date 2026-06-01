// Phase 09 worker PWA service worker (ADR-011). Deliberately conservative: it
// ONLY intercepts navigations within the worker app (/home, /jobs) and uses a
// network-first strategy with a cached shell fallback. Everything else —
// hashed assets, RSC payloads, API calls, the office dashboard — passes straight
// through to the network, so a stale cache can never break the app.
//
// NOTE: full offline asset precaching + the IndexedDB write-queue replay are
// later slices. This makes the app installable and gives an offline shell.

const CACHE = 'painless-worker-v1';
const SHELL_URL = '/home';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isWorkerNavigation(request) {
  if (request.method !== 'GET' || request.mode !== 'navigate') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return url.pathname === '/home' || url.pathname.startsWith('/jobs');
}

self.addEventListener('fetch', (event) => {
  if (!isWorkerNavigation(event.request)) return; // pass through to network
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        // Keep the latest home shell as the offline fallback.
        const cache = await caches.open(CACHE);
        cache.put(SHELL_URL, response.clone()).catch(() => {});
        return response;
      } catch {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(SHELL_URL);
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;padding:2rem"><h1>You are offline</h1><p>Reconnect and reopen the app to sync.</p></body>',
          { headers: { 'Content-Type': 'text/html' } },
        );
      }
    })(),
  );
});
