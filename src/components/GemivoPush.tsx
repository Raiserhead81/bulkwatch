"use client";

// Gemivo Web-Push + Update-Leiste (zentrale Bausteine von gemivo.de/push).
// GemivoPushInit: einmal im Root-Layout einbinden, laedt die beiden Client-Skripte
// und initialisiert Update-Leiste ("Neue Version verfuegbar") + Push.
// PushBell: Glocken-Button fuer Header oder Einstellungen, Zustand = abonniert ja/nein.

import { useCallback, useEffect, useState } from "react";

const HUB = ""; // CSP: Bausteine self-hosted, API via Same-Origin-Proxy /api/push

type GemivoPushApi = {
  init: (o: { app: string; sw: string }) => void;
  toggle: () => Promise<boolean>;
  isSubscribed: () => Promise<boolean>;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
};

declare global {
  interface Window {
    GemivoPush?: GemivoPushApi;
    GemivoUpdate?: { init: (o: { sw: string }) => void };
    __gemivoPushReady?: Promise<void>;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Skript nicht ladbar: " + src));
    document.head.appendChild(s);
  });
}

export function GemivoPushInit({ app }: { app: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || window.__gemivoPushReady) return;
    if (!("serviceWorker" in navigator)) return;
    window.__gemivoPushReady = Promise.all([
      loadScript("/gemivo-update-client.js"),
      loadScript("/gemivo-push-client.js"),
    ])
      .then(() => {
        window.GemivoUpdate?.init({ sw: "/sw.js" });
        window.GemivoPush?.init({ app, sw: "/sw.js" });
      })
      .catch(() => {
        delete window.__gemivoPushReady;
      });
  }, [app]);
  return null;
}

export function PushBell({ className = "" }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      const p = window.__gemivoPushReady;
      if (!p) {
        setTimeout(check, 500);
        return;
      }
      p.then(async () => {
        if (!alive || !window.GemivoPush) return;
        if (!("Notification" in window) || !("PushManager" in window)) return;
        setReady(true);
        try {
          setActive(await window.GemivoPush.isSubscribed());
        } catch {}
      });
    };
    check();
    return () => {
      alive = false;
    };
  }, []);

  const onClick = useCallback(async () => {
    if (!window.GemivoPush || busy) return;
    setBusy(true);
    try {
      setActive(!!(await window.GemivoPush.toggle()));
    } catch {}
    setBusy(false);
  }, [busy]);

  if (!ready) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title="Benachrichtigungen"
      aria-label="Benachrichtigungen"
      aria-pressed={active}
      data-push-active={active ? "1" : "0"}
      className={className}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </button>
  );
}
