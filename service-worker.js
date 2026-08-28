const SLATE_RELEASE = "__SLATE_RELEASE__";
const SLATE_CACHE_PREFIX = "the-slate-shell-v3-";
const SLATE_CACHE = `${SLATE_CACHE_PREFIX}${SLATE_RELEASE}`;
const SLATE_SHELL = ["/", "/manifest.webmanifest", "/styles.css"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SLATE_CACHE).then(cache => cache.addAll(SLATE_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("the-slate-shell-") && key !== SLATE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        event.waitUntil(caches.open(SLATE_CACHE).then(cache => cache.put("/", copy)));
        return response;
      }).catch(() => caches.open(SLATE_CACHE).then(cache => cache.match("/")))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(response => {
      if (response) return response;
      return Response.error();
    }))
  );
});
