const CACHE_NAME = 'sgt-pwa-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './offline.html',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
  'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js',
];

// Install: cache all shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/Firebase, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;

  // Firebase & external: network only (with cache fallback)
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com')) {
    return; // Let Firebase handle its own caching
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match('./offline.html'));

      return cached || networkFetch;
    })
  );
});
