"use client";

import { useState, useEffect } from "react";

export interface LiveAISShip {
  mmsi: string;
  imo?: string;
  name?: string;
  shipName?: string;
  lat: number;
  lon: number;
  sog?: number;
  cog?: number;
  heading?: number;
  navStatus?: number;
  destination?: string;
  eta?: string;
  timestamp: number;
}

export interface AISStats {
  totalShips: number;
  activeShips: number;
  lastMessage: number;
  uptime: number;
  wsConnected: boolean;
}

// Lädt ein einzelnes Schiff anhand IMO aus dem Live-AIS-Cache
export function useLiveShip(imo: string | undefined) {
  const [ship, setShip] = useState<LiveAISShip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!imo) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchShip() {
      try {
        const res = await fetch(`/api/ais/${imo}`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
          if (!cancelled) setShip(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setShip(data.ship || null);
      } catch {
        if (!cancelled) setShip(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchShip();
    const interval = setInterval(fetchShip, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [imo]);

  return { ship, loading };
}

// Lädt alle Live-Schiffe
export function useAllLiveShips(refreshMs = 30000) {
  const [ships, setShips] = useState<LiveAISShip[]>([]);
  const [stats, setStats] = useState<AISStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      try {
        const [shipsRes, statsRes] = await Promise.all([
          fetch("/api/ais", { signal: AbortSignal.timeout(10000) }),
          fetch("/api/ais/stats", { signal: AbortSignal.timeout(5000) }),
        ]);
        if (shipsRes.ok) {
          const data = await shipsRes.json();
          if (!cancelled) setShips(data.ships || []);
        }
        if (statsRes.ok) {
          if (!cancelled) setStats(await statsRes.json());
        }
      } catch (err) {
        console.error("Live AIS fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    const interval = setInterval(fetchAll, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshMs]);

  return { ships, stats, loading };
}
