// DayNotes Service Worker v1.0
const CACHE_NAME = 'daynotes-v1';
const FONTS_CACHE = 'daynotes-fonts-v1';

const CORE_ASSETS = [
  './index.html',
  './manifest.json'
];

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Mono:wght@300;400&family=DM+Sans:wght@300;400&display=swap'
];

// ── INSTALL: cache core assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== FONTS_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: offline-first for core, network-first for fonts ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts — cache then serve
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // Core app — cache-first (app works fully offline)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => {
          // Return index.html as fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Everything else — network with offline fallback
  event.respondWith(
    fetch(event.request).catch(() => new Response('Offline', { status: 503 }))
  );
});

// ── SYNC: background save notification ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(key => {
          if (key.url.includes('index.html')) {
            fetch('./index.html').then(r => { if (r.ok) cache.put('./index.html', r); });
          }
        });
      });
    });
  }
});
