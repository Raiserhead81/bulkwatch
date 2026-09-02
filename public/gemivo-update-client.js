/**
 * Gemivo Update-Leiste — "Neue Version verfuegbar / Jetzt laden" fuer jede App mit Service Worker.
 * Muster aus AiMail (dort bewaehrt), generisch gemacht.
 *
 * Nutzung:
 *   <script src="https://gemivo.de/push/update-client.js"></script>
 *   GemivoUpdate.init({ sw: "/sw.js" });
 *
 * Voraussetzungen im sw.js der App:
 *   - eine VERSION-Konstante, die das Deploy-Skript stempelt (sonst erkennt der Browser nie ein Update)
 *   - KEIN skipWaiting() beim Install
 *   - self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting() })
 */
(function () {
  function showBar(onClick) {
    if (document.getElementById("gemivo-update-bar")) return;
    var bar = document.createElement("div");
    bar.id = "gemivo-update-bar";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 16px;background:#065f46;color:#fff;font:14px system-ui,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.35)";
    var txt = document.createElement("span");
    txt.textContent = "Neue Version verfügbar";
    var btn = document.createElement("button");
    btn.textContent = "Jetzt laden";
    btn.style.cssText = "background:#fff;color:#065f46;border:0;border-radius:8px;padding:7px 16px;font-weight:700;cursor:pointer";
    btn.onclick = onClick;
    bar.appendChild(txt); bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  window.GemivoUpdate = {
    init: function (opts) {
      if (!("serviceWorker" in navigator)) return;
      var sw = (opts && opts.sw) || "/sw.js";
      navigator.serviceWorker.register(sw).then(function (reg) {
        function onWaiting(worker) {
          showBar(function () {
            worker.postMessage("SKIP_WAITING");
            // Falle aus AiMail: controllerchange feuert bei schnellen Mehrfach-Deploys
            // nicht immer -> nach 1,8s hart neu laden
            var done = false;
            navigator.serviceWorker.addEventListener("controllerchange", function () {
              if (!done) { done = true; location.reload(); }
            });
            setTimeout(function () { if (!done) { done = true; location.reload(); } }, 1800);
          });
        }
        if (reg.waiting) onWaiting(reg.waiting);
        reg.addEventListener("updatefound", function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener("statechange", function () {
            if (w.state === "installed" && navigator.serviceWorker.controller) onWaiting(w);
          });
        });
        // Update-Checks: beim Sichtbarwerden + stuendlich
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") reg.update().catch(function () {});
        });
        setInterval(function () { reg.update().catch(function () {}); }, 3600000);
      }).catch(function () {});
    },
  };
})();
