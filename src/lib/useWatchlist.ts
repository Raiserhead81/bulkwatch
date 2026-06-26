"use client";

import { useSyncExternalStore } from "react";

// Module-level state for watchlist (singleton)
let watchlistCache: string[] = [];
let subscribers: Array<() => void> = [];
let initialized = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const stored = localStorage.getItem("bulkwatch-watchlist");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) watchlistCache = parsed;
    } catch {
      // ignore
    }
  }
  window.addEventListener("storage", () => {
    const s = localStorage.getItem("bulkwatch-watchlist");
    if (s) {
      try {
        watchlistCache = JSON.parse(s);
        subscribers.forEach((fn) => fn());
      } catch {
        // ignore
      }
    }
  });
}

export function useWatchlist(): string[] {
  init();
  return useSyncExternalStore(
    (cb) => {
      subscribers.push(cb);
      return () => {
        subscribers = subscribers.filter((fn) => fn !== cb);
      };
    },
    () => watchlistCache,
    () => [],
  );
}

export function setWatchlist(list: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("bulkwatch-watchlist", JSON.stringify(list));
  watchlistCache = list;
  subscribers.forEach((fn) => fn());
  window.dispatchEvent(new Event("storage"));
}

export function toggleWatch(imo: string) {
  const current = watchlistCache;
  const next = current.includes(imo)
    ? current.filter((i) => i !== imo)
    : [...current, imo];
  setWatchlist(next);
}
