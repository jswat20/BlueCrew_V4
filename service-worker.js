const SLATE_CACHE = "the-slate-shell-v1";
const SLATE_SHELL = ["/", "/manifest.webmanifest", "/styles.css"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SLATE_CACHE).then(cache => cache.addAll(SLATE_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SLATE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(response => {
      if (response) return response;
      return event.request.mode === "navigate" ? caches.match("/") : Response.error();
    }))
  );
});
