const VERSION = "v1";
const RUNTIME = `vessel-runtime-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Navigation: always network (auth-dependent)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => new Response("<h1>Offline</h1><p>Vessel Database requires internet.</p>", {
        headers: { "Content-Type": "text/html" }
      }))
    );
    return;
  }

  // Static assets: cache first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const res = await fetch(event.request);
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })());
    return;
  }

  // API: network only
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Everything else: network first, cache fallback
  event.respondWith((async () => {
    try {
      const res = await fetch(event.request);
      if (res.ok && event.request.method === "GET") {
        const cache = await caches.open(RUNTIME);
        cache.put(event.request, res.clone());
      }
      return res;
    } catch {
      const cached = await caches.match(event.request);
      return cached || new Response("Offline", { status: 503 });
    }
  })());
});
