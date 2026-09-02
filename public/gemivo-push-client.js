/**
 * Gemivo Push-Client — wiederverwendbarer Baustein fuer alle Apps.
 * Nutzung:
 *   <script src="https://gemivo.de/push/push-client.js"></script>
 *   GemivoPush.init({ app: "famwork", sw: "/sw.js" });      // einmal beim Laden
 *   GemivoPush.toggle()       -> abonnieren/abbestellen (Glocken-Button)
 *   GemivoPush.isSubscribed() -> Promise<boolean>
 * Der Service Worker der App braucht den push/notificationclick-Handler
 * (Vorlage: https://gemivo.de/push/sw-snippet.js).
 */
(function () {
  const HUB = "/api/push";
  let cfg = null;

  async function reg() {
    if (!("serviceWorker" in navigator)) throw new Error("Kein Service-Worker-Support");
    return cfg.swReg || (cfg.swReg = await navigator.serviceWorker.register(cfg.sw));
  }

  async function getSub() {
    const r = await reg();
    await navigator.serviceWorker.ready;
    return r.pushManager.getSubscription();
  }

  function b64ToU8(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  window.GemivoPush = {
    init(options) { cfg = Object.assign({ sw: "/sw.js" }, options); },

    async isSubscribed() {
      try { return !!(await getSub()); } catch { return false; }
    },

    async subscribe() {
      if (!cfg || !cfg.app) throw new Error("GemivoPush.init fehlt");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
      const { publicKey } = await fetch(HUB + "/vapid").then((r) => r.json());
      const r = await reg();
      await navigator.serviceWorker.ready;
      const sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToU8(publicKey),
      });
      const res = await fetch(HUB + "/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: cfg.app, subscription: sub }),
      });
      return res.ok;
    },

    async unsubscribe() {
      const sub = await getSub();
      if (!sub) return true;
      await fetch(HUB + "/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: cfg.app, endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
      return true;
    },

    async toggle() {
      return (await this.isSubscribed()) ? (await this.unsubscribe(), false) : this.subscribe();
    },
  };
})();
