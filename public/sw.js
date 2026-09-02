/**
 * Vorlage sw.js fuer Apps OHNE eigenen Service Worker (Klasse B: PHP/statisch).
 * Deploy-Skript MUSS __VERSION__ stempeln, z.B.:
 *   sed -i "s/__VERSION__/$(date +%s)/" sw.js   (oder Build-/Git-Hash)
 * Enthaelt: Update-Mechanik + Push-Handler. Kein Offline-Caching (bewusst schlank).
 */
const SW_VERSION = "1788359583";

self.addEventListener("install", () => { /* kein skipWaiting: Update-Leiste entscheidet */ });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("push", (event) => {
  let data = { title: "Neuigkeit", body: "", url: "/" };
  try { data = Object.assign(data, event.data.json()); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "gemivo",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
