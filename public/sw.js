/* Kokand University — service worker (PWA, oflayn rejim)
   Versiya serverda avtomatik qo'yiladi: __BUILD__ */
const BUILD = '__BUILD__';
const CORE = `ku-core-${BUILD}`;
const PAGES = 'ku-pages-v1';
const ASSETS = 'ku-assets-v1';
const PRECACHE = [
  '/offline', '/ru/offline', '/en/offline',
  '/css/ku.css', '/js/ku.js', '/js/ku-pages.js', '/js/ku-home.js',
  '/img/brand/ku-brand.svg', '/img/icons.svg', '/img/map-dots.svg', '/favicon.svg',
  '/fonts/2027/onest-latin-wght-normal.woff2', '/fonts/2027/unbounded-latin-wght-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('ku-core-') && k !== CORE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

function offlineFor(url) {
  const m = url.pathname.match(/^\/(ru|en)(\/|$)/);
  return m ? `/${m[1]}/offline` : '/offline';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname === '/sw.js') return;

  // Sahifalar: avval tarmoq, bo'lmasa kesh, bo'lmasa oflayn sahifa
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, 40));
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        return (await caches.match(offlineFor(url))) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Statik fayllar: kesh + fonda yangilash (stale-while-revalidate)
  if (/^\/(css|js|fonts|img|favicon)/.test(url.pathname) || /\.(woff2|svg|webp|png|jpg)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const hit = (await cache.match(req)) || (await caches.match(req, { ignoreSearch: true }));
      const net = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).then(() => trim(ASSETS, 160));
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
  }
});
