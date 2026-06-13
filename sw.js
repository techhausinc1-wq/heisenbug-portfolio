// Heisenbug Service Worker — cache-first for app shell, network-first for HTML pages
const VERSION = 'hb-v9-20260613-0545';
const SHELL = [
  '/',
  '/built/',
  '/about/',
  '/contact/',
  '/home-health/',
  '/vetsource/',
  '/demos/',
  '/manifest.json',
  '/heisenbug-square-small.png',
  '/heisenbug-icon-192.png',
  '/favicon.png',
  '/heisenbug-og-1200x630.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try { await cache.addAll(SHELL); } catch (_) { /* tolerate partial */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't intercept cross-origin

  // Network-first for HTML (latest content wins, cache as fallback)
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const hit = await caches.match(req);
        return hit || caches.match('/404.html') || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for static assets
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return caches.match(req) || new Response('Offline', { status: 503 });
    }
  })());
});
