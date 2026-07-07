// Kill switch — unregister this service worker and clear all caches
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Take control of any already-open clients immediately, so this
    // kill-switch worker (not a stale one) is the one that unregisters.
    await self.clients.claim();
    // Delete ALL caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Unregister self
    const reg = await self.registration;
    await reg.unregister();
    // Force reload all open tabs
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.navigate(c.url));
  })());
});
