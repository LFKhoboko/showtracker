// ShowTracker Service Worker — Cache-first offline strategy
// Dynamic base path: works at root (/), subpath (/showtracker/), or any deployment URL

const CACHE = 'showtracker-v2';
const SW_PATH = self.location.pathname;
const BASE = SW_PATH.substring(0, SW_PATH.lastIndexOf('/') + 1);

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.svg',
  BASE + 'icons/icon-512.svg'
];

// Install: pre-cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static assets, network-first for API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // SPA navigation: always serve index.html for any navigation request
  // This ensures deep links work in PWA standalone mode
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE + 'index.html').then(cached => cached || fetch(event.request))
    );
    return;
  }

  // TMDB API: network-first with cache fallback
  if (url.hostname === 'api.themoviedb.org') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // TMDB images: network-first, cache on success
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(res => {
        // Only cache same-origin successful responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
