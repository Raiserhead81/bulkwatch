import { NextResponse } from "next/server";
import WebSocket from "ws";

// ─── In-Memory Cache (singleton in Next.js hot module) ─────────────────────
declare global {
  var __aisCache: Map<string, {
    mmsi: string;
    imo?: string;
    name?: string;
    lat: number;
    lon: number;
    sog?: number;
    cog?: number;
    heading?: number;
    navStatus?: number;
    shipType?: number;
    destination?: string;
    timestamp: number;
  }> | undefined;
  var __aisWs: WebSocket | null | undefined;
  var __aisLastMsg: number | undefined;
  var __aisStarted: number | undefined;
}

const CACHE_TTL_SEC = 30 * 60; // 30 min
const API_KEY = process.env.AISSTREAM_API_KEY || "";

function getCache() {
  if (!globalThis.__aisCache) {
    globalThis.__aisCache = new Map();
  }
  return globalThis.__aisCache;
}

function connectAIS() {
  if (globalThis.__aisWs && globalThis.__aisWs.readyState === WebSocket.OPEN) {
    return; // already connected
  }

  console.log("[AIS] Connecting to AISStream.io...");
  const cache = getCache();

  try {
    const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
    globalThis.__aisWs = ws;
    globalThis.__aisStarted = Date.now();

    ws.on("open", () => {
      console.log("[AIS] ✓ WebSocket connected");
      const subscription = {
        APIKey: API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: [],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      };
      ws.send(JSON.stringify(subscription));
      console.log("[AIS] Subscription sent");
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        globalThis.__aisLastMsg = Date.now();

        const msgType = msg.MessageType;
        const payload = msg.Message?.PositionReport || msg.Message?.ShipStaticData || {};
        const metadata = msg.MetaData || {};

        const mmsi = String(metadata.MMSI || payload.UserID || "");
        if (!mmsi) return;

        const existing = cache.get(mmsi) || { mmsi, lat: 0, lon: 0, timestamp: 0 };

        if (msgType === "PositionReport") {
          cache.set(mmsi, {
            ...existing,
            mmsi,
            lat: payload.Latitude ?? existing.lat,
            lon: payload.Longitude ?? existing.lon,
            sog: payload.Sog ?? existing.sog,
            cog: payload.Cog ?? existing.cog,
            heading: payload.TrueHeading ?? existing.heading,
            navStatus: payload.NavigationalStatus ?? existing.navStatus,
            name: (metadata.ShipName || existing.name || "").trim(),
            timestamp: Date.now(),
          });
        } else if (msgType === "ShipStaticData") {
          cache.set(mmsi, {
            ...existing,
            mmsi,
            imo: payload.ImoNumber ? String(payload.ImoNumber) : existing.imo,
            name: (payload.Name || existing.name || "").trim(),
            shipType: payload.Type ?? existing.shipType,
            destination: (payload.Destination || existing.destination || "").trim(),
            timestamp: existing.timestamp || Date.now(),
          });
        }

        // Cap cache size
        if (cache.size > 50000) {
          // Remove oldest 1000 entries
          const entries = Array.from(cache.entries()).sort(
            (a, b) => a[1].timestamp - b[1].timestamp,
          );
          for (let i = 0; i < 1000; i++) {
            cache.delete(entries[i][0]);
          }
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      console.log("[AIS] WebSocket closed, will retry in 5s");
      globalThis.__aisWs = null;
      setTimeout(connectAIS, 5000);
    });

    ws.on("error", (err: Error) => {
      console.error("[AIS] WebSocket error:", err.message);
    });
  } catch (err) {
    console.error("[AIS] Connection setup error:", err);
    setTimeout(connectAIS, 5000);
  }
}

// Start connection on first request (lazy)
if (API_KEY && !globalThis.__aisWs) {
  connectAIS();
}

export async function GET() {
  const cache = getCache();
  const now = Date.now();
  const recent = Array.from(cache.values())
    .filter((s) => now - s.timestamp < CACHE_TTL_SEC * 1000 && s.lat && s.lon && (s.shipType == null || (s.shipType >= 70 && s.shipType <= 79)))
    .sort((a, b) => b.timestamp - a.timestamp);

  return NextResponse.json({
    ships: recent,
    count: recent.length,
    timestamp: now,
    wsConnected: globalThis.__aisWs?.readyState === WebSocket.OPEN,
    lastMessage: globalThis.__aisLastMsg || 0,
    uptime: globalThis.__aisStarted ? now - globalThis.__aisStarted : 0,
  });
}
