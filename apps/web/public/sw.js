const CACHE = 'seven-shell-v4';
const SHELL = [
  '/',
  '/brand/7even-logo.jpeg',
  '/brand/icon.svg',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-180.png',
];

function canCache(response) {
  return (
    response.ok &&
    !response.redirected &&
    new URL(response.url).origin === self.location.origin
  );
}

async function precacheShell() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(
    SHELL.map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        // Vercel Authentication may redirect protected preview paths to the SSO host.
        // Never cache those HTML responses under a shell or asset URL.
        if (canCache(response)) await cache.put(path, response);
      } catch {
        // A single unavailable shell resource must not prevent the worker installing.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('seven-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  // Keep the manifest out of the service-worker cache. In protected previews,
  // Vercel can redirect it to SSO; caching that redirect result breaks PWA loading.
  if (url.pathname === '/manifest.webmanifest') return;

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (canCache(response)) {
            const cache = await caches.open(CACHE);
            await cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          return (await caches.match(event.request)) ?? Response.error();
        }
      })(),
    );
  }
});
