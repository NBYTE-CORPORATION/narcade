/* 나케이드 서비스 워커 — 셸 캐시 우선, 나머지는 네트워크 우선 */
const VERSION = 'narcade-v3';
const SHELL = [
  './',
  'index.html',
  'assets/css/main.css',
  'assets/css/game-base.css',
  'assets/js/arcade.js',
  'assets/js/main.js',
  'assets/js/games.json',
  'favicon.ico'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const SHELL_URLS = SHELL.map((p) => new URL(p, self.registration.scope).href);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  if (SHELL_URLS.includes(e.request.url)) {
    // 셸: 캐시 우선
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request))
    );
    return;
  }

  // 그 외(게임 페이지/에셋): 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
