// Offline support: cache the app shell, serve it cache-first.
// Bump CACHE_VERSION (and js/version.js) whenever any file below changes.
const CACHE_VERSION = 'wr-v1.0.0';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/router.js',
  './js/ui.js',
  './js/db.js',
  './js/model.js',
  './js/backup.js',
  './js/images.js',
  './js/version.js',
  './js/views/list.js',
  './js/views/form.js',
  './js/views/detail.js',
  './js/views/settings.js',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Network-first so updates show up right away; the cache covers offline use
// and slow connections (after a short timeout).
const TIMEOUT_MS = 3000;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const fromCache = () => cache.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
    // 'no-cache' revalidates with the server (cheap 304s) instead of trusting the HTTP cache.
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    try {
      return await Promise.race([
        network,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
      ]);
    } catch {
      const hit = await fromCache();
      if (hit) return hit;
      return network.catch(() => Response.error()); // nothing cached: keep waiting on the network
    }
  })());
});
