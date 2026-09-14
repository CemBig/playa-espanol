// Offline support: once the app has been opened, it keeps working without a data connection —
// useful when roaming abroad. Bump CACHE whenever the shipped files change.
const CACHE = "playa-es-v2";

const PRECACHE = [
  "./",
  "index.html",
  "manifest.json",
  "css/styles.css",
  "js/app.js",
  "js/core/content.js",
  "js/core/storage.js",
  "js/core/srs.js",
  "js/core/text.js",
  "js/core/pronunciation.js",
  "js/content/lessons.js",
  "js/ui/dashboard.js",
  "js/ui/lessons.js",
  "js/ui/lesson-detail.js",
  "js/ui/review.js",
  "js/ui/pronounce.js",
  "js/ui/settings.js",
  "js/ui/toast.js",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png",
  "assets/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll fails atomically; add individually so one bad entry can't break the install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: prefer the network so updates land, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  if (!sameOrigin) return; // let fonts and other cross-origin requests go straight to the network

  // Assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
