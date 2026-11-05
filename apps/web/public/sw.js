const SHELL_CACHE = 'seven-shell-v5';
const IMAGE_CACHE = 'seven-images-v1';
const SHELL = [
  '/',
  '/brand/7even-logo.jpeg',
  '/brand/icon.svg',
  '/brand/icon-192.png',
  '/brand/icon-512.png',
  '/brand/icon-180.png',
];
const MAX_CACHED_IMAGES = 80;

function canCacheShell(response) {
  return response.ok && !response.redirected && new URL(response.url).origin === self.location.origin;
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(
    SHELL.map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        // Never cache a Vercel Authentication redirect or an unrelated HTML response.
        if (canCacheShell(response)) await cache.put(path, response);
      } catch {
        // A single unavailable shell resource must not prevent the worker installing.
      }
    }),
  );
}

async function trimImageCache(cache) {
  const requests = await cache.keys();
  if (requests.length <= MAX_CACHED_IMAGES) return;
  const excess = requests.length - MAX_CACHED_IMAGES;
  await Promise.all(requests.slice(0, excess).map((request) => cache.delete(request)));
}

async function imageResponse(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Opaque cross-origin image responses are cacheable, but redirects are not.
    const cacheable = response.ok || response.type === 'opaque';
    if (cacheable && !response.redirected) {
      await cache.put(request, response.clone()).then(() => trimImageCache(cache)).catch(() => {});
    }
    return response;
  } catch {
    return (await cache.match(request)) ?? Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => (key.startsWith('seven-shell-') && key !== SHELL_CACHE) || (key.startsWith('seven-images-') && key !== IMAGE_CACHE))
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }

  // Keep the manifest out of the service-worker cache. In protected previews,
  // Vercel can redirect it to SSO; caching that redirect breaks PWA loading.
  if (url.pathname === '/manifest.webmanifest') return;

  if (event.request.destination === 'image') {
    event.respondWith(imageResponse(event.request));
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (canCacheShell(response)) await cache.put(event.request, response.clone()).catch(() => {});
          return response;
        } catch {
          return (await cache.match(event.request)) ?? Response.error();
        }
      })(),
    );
  }
});
