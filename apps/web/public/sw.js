/* Service Worker — Odalyan FashionSphere PWA */
const CACHE = 'odalyan-v1';
const PRECACHE = ['/offline.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Ne pas intercepter les appels API ni les autres origines
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // Navigations : réseau d'abord, repli sur le cache puis page offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline.html'))),
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau (et on met en cache)
  if (/\.(?:js|css|png|jpg|jpeg|webp|svg|gif|woff2?|glb|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});
