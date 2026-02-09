/* 제철 알리미 - PWA Service Worker (부분 오프라인 전략)
 * - 정적 자원: stale-while-revalidate
 * - 데이터(/data/*): network-first (오프라인 시 캐시 fallback)
 */

const VERSION = 'v2';
const STATIC_CACHE = `static-${VERSION}`;
const DATA_CACHE = `data-${VERSION}`;

// 필수 정적 자원 (필요시 추가)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/recipe.html',
  '/assets/style.css',
  '/assets/script.js',
  '/assets/recipe.css',
  '/assets/recipe.js',
  '/images/_fallback.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, DATA_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isData = url.pathname.startsWith('/data/');

  // 데이터는 network-first
  if (isData) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // 동일 출처 정적 자원은 stale-while-revalidate
  if (isSameOrigin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('오프라인입니다.', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}


