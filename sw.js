const CACHE = "club-energy-v7"; // نسخه جدید ← کش قبلی دور ریخته می‌شود
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.ico",
  "./favicon.svg",
  "./favicon-light.svg",
  "./favicon-dark.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./auto-sync.js",
  "./account-ui.js",
  "./account-ui.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // صفحه اصلی: اول شبکه، بعد کش — تا مشتری همیشه آخرین نسخه را ببیند
  const isDocument =
    e.request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/");

  if (isDocument) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
            caches.open(CACHE).then((c) => c.put("./index.html", clone.clone ? clone : res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match("./index.html"))
        )
    );
    return;
  }

  // بقیه فایل‌ها: کش اول، اگر نبود شبکه
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
    )
  );
});
