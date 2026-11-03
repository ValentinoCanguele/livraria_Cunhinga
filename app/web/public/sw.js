const CACHE_NAME = 'livraria-v6';
const PRECACHE = ['/', '/shop', '/manifest.webmanifest', '/icons/icon-192.svg'];

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

self.addEventListener('push', (event) => {
  let data = { title: 'Livraria Adventista', body: 'Tem uma nova actualização.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (err) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      data: { url: data.url || '/' },
      tag: 'livraria-notification',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api')) return;
  // API do Supabase (login, dados, Edge Functions, tempo real): sempre pela rede, nunca da cache,
  // para não mostrar dados antigos nem misturar sessões. As imagens do Storage continuam em cache.
  if (/\/(auth|rest|functions|realtime)\/v1\//.test(url.pathname)) return;
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@') || url.pathname.includes('/node_modules/')) return;

  // Exclude Firebase Auth and Firestore API requests to prevent cache collisions and auth issues
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.pathname.includes('/__/auth')
  ) {
    return;
  }

  // 1. Imagens (do site, do Supabase Storage ou externas): cache primeiro, actualizada em segundo plano.
  const isImage = event.request.destination === 'image' ||
                  /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname) ||
                  url.pathname.includes('/storage/v1/object/public/');

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

  // 2. Navegação (o HTML): rede primeiro, cache só se a rede falhar.
  //
  // Com stale-while-revalidate, depois de cada publicação o browser recebia o index.html
  // antigo, que aponta para ficheiros /assets/<hash> já substituídos — página em branco até
  // um segundo recarregamento. O HTML é pequeno e tem de ser sempre o actual; o que é grande
  // (os assets com hash no nome) é que vale a pena servir da cache.
  const isNavigation = event.request.mode === 'navigate' ||
                       event.request.destination === 'document' ||
                       (event.request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        // Sem rede: a última versão vista desta página, ou a raiz (a aplicação trata a rota).
        caches.match(event.request).then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }

  // 3. Ficheiros com hash no nome (/assets/index-ab12cd34.js): o conteúdo nunca muda para o
  // mesmo nome, por isso a cache serve primeiro e não há nada a revalidar.
  if (url.origin === self.location.origin && /^\/assets\/.+-[A-Za-z0-9_-]{8}\./.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // 4. O resto (manifest, ícones, tipos de letra): stale-while-revalidate.
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
