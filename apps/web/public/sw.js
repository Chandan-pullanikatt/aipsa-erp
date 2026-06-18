// Minimal service worker — exists to make the app installable (PWA) and to give a
// clean offline fallback. It deliberately does NOT cache API/auth responses or
// dynamic pages: this is a live multi-tenant ERP and stale cached data (fees,
// attendance, another tenant's content) would be worse than an offline banner.
// Offline UX itself is handled in-app via the navigator.onLine listener.

const OFFLINE_URL = '/offline.html';
const CACHE = 'aipsa-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first for navigations; fall back to the offline page only when the
// network is unreachable. Everything else passes straight through to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
