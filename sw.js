// ShowTracker Service Worker — Cache-first offline strategy
// Dynamic base path: works at root (/), subpath (/showtracker/), or any deployment URL

const CACHE = 'showtracker-v20';
const SW_PATH = self.location.pathname;
const BASE = SW_PATH.substring(0, SW_PATH.lastIndexOf('/') + 1);

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.svg',
  BASE + 'icons/icon-512.svg'
];

// Install: pre-cache core assets — each individually so one missing file
// can't fail the whole install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(
        ASSETS.map(url =>
          fetch(url).then(res => { if (res.ok) cache.put(url, res); }).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
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

  // SPA navigation: network-first with cache fallback so new deploys
  // (updated index.html) show up. cache:'no-store' bypasses the browser's
  // HTTP cache (GitHub Pages sends max-age=600) so we always fetch fresh.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(BASE + 'index.html', clone));
          return res;
        })
        .catch(() =>
          caches.match(BASE + 'index.html').then(cached => cached || caches.match('./'))
        )
    );
    return;
  }

  // TMDB API (via Cloudflare Worker proxy): network-first with cache fallback
  if (url.hostname === 'tmdb-proxy.lfkhoboko.workers.dev') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Read body as text so we can inspect and re-use it
          return res.text().then(body => {
            // Create a fresh, re-readable Response from the text
            const fresh = new Response(body, {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
            // Don't cache TMDB error responses (success:false with status 200)
            try {
              const json = JSON.parse(body);
              if (json.success === false) return fresh;
            } catch(e) {}
            // Valid response — cache it
            caches.open(CACHE).then(cache => cache.put(event.request, fresh.clone()));
            return fresh;
          });
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
