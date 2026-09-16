// 个人智能学习系统 · Service Worker
// 策略：导航 network-first（保证永远最新版本），静态资源 stale-while-revalidate，/api 不缓存（登录态/数据绝不进缓存）。
// 发版自动更新：改上方 VERSION 即可，浏览器检测到新 SW 后 skipWaiting + claim，下次访问即新版本。

const VERSION = "1";
const SHELL_CACHE = `smart-study-shell-v${VERSION}`;
const STATIC_CACHE = `smart-study-static-v${VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.endsWith(`-v${VERSION}`)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 不缓存 API 与跨域请求
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // 页面导航：network-first，失败回退缓存壳（保证永远最新版）
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // 静态资源（Next 构建产物 / 图标）：stale-while-revalidate
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
