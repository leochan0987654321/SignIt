/* sw.js —— Service Worker，離線快取 + 支援自動更新 */
const CACHE = 'qian-dao-v4';   /* ← 每次更新代碼都要把版本號 +1 */
const ASSETS = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())   /* 安裝完立刻等待接管 */
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  /* 立即接管所有頁面 */
  );
});

/* 收到 SKIP_WAITING → 立刻啟用新 SW */
self.addEventListener('message', (e) => {
  if(e.data && e.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  if(e.request.method !== 'GET') return;

  /* index.html 與導覽請求走「網路優先」，確保能拿到最新版本 */
  const url = new URL(e.request.url);
  const isDoc = e.request.mode === 'navigate'
             || url.pathname.endsWith('/')
             || url.pathname.endsWith('index.html');

  if(isDoc){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* 其他資源：快取優先 */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if(res && res.status === 200){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
