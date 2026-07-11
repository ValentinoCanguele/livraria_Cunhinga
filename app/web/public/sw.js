const CACHE_NAME = 'livraria-v2';
const PRECACHE = [
  '/',
  '/shop',
  '/manifest.webmanifest',
  '/icons/icon-192.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude Firebase Auth and Firestore API requests to prevent cache collisions and auth issues
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.pathname.includes('/__/auth')
  ) {
    return;
  }

  // 1. Caching Strategy for Images (both same-origin and external like Unsplash or PocketBase)
  const isImage = event.request.destination === 'image' || 
                  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname) ||
                  url.pathname.includes('/api/files/'); // PocketBase file uploads path

  if (isImage) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          // Return cached image immediately, or fallback to fetching
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 2. Caching Strategy for Essential App Data / PocketBase API (Network-First)
  const isPocketBaseApi = url.pathname.includes('/api/collections/') || url.pathname.includes('/api/records/');
  if (isPocketBaseApi) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Fallback to cached API responses if offline
            return cache.match(event.request);
          });
      })
    );
    return;
  }

  // 3. Stale-While-Revalidate for other static assets (HTML, JS, CSS, fonts, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok && (url.origin === self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
