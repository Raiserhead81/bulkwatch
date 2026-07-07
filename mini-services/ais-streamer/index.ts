/**
 * AIS Streamer Mini-Service
 *
 * Verbindet sich mit AISStream.io WebSocket, empfängt echte AIS-Daten
 * und cached sie in Memory. Bietet REST-API für die App.
 *
 * Port: 3099
 * Endpoints:
 *   GET /api/ships        - Alle Bulk Carrier im Cache
 *   GET /api/ships/:imo   - Einzelnes Schiff
 *   GET /api/stats        - Cache-Statistiken
 *   GET /health           - Health Check
 */

import { createServer } from "node:http";
import { WebSocket } from "ws";
import { readFile, writeFile as writeFileAsync } from "node:fs/promises";
import { existsSync, mkdir } from "node:fs";
import path from "node:path";

// ─── Config ────────────────────────────────────────────────────────────────
const PORT = 3099;
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY || "";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — older entries expire
const SAVE_INTERVAL_MS = 5 * 60 * 1000; // Save cache every 5 min
const CACHE_FILE = "/tmp/ais-cache.json";

// ─── In-Memory Cache ──────────────────────────────────────────────────────
// Key: MMSI (string), Value: AIS position data
interface CachedShip {
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
  timestamp: number;
  shipType?: number;
  destination?: string;
  eta?: string;
}

const shipCache = new Map<string, CachedShip>();

// ─── HTTP Server ──────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        ships: shipCache.size,
        uptime: process.uptime(),
        lastMessage: lastMessageTimestamp,
        wsConnected: wsReadyState,
      }));
      return;
    }

    if (pathname === "/api/stats") {
      const now = Date.now();
      const recent = Array.from(shipCache.values()).filter(
        (s) => now - s.timestamp < CACHE_TTL_MS,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        totalShips: shipCache.size,
        activeShips: recent.length,
        lastMessage: lastMessageTimestamp,
        uptime: process.uptime(),
        wsConnected: wsReadyState,
        cacheTtlMs: CACHE_TTL_MS,
      }));
      return;
    }

    if (pathname === "/api/ships") {
      const now = Date.now();
      const ships = Array.from(shipCache.values())
        .filter((s) => now - s.timestamp < CACHE_TTL_MS)
        .sort((a, b) => b.timestamp - a.timestamp);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ships, count: ships.length, timestamp: now }));
      return;
    }

    // /api/ships/:imo
    const shipMatch = pathname.match(/^\/api\/ships\/(\d+)$/);
    if (shipMatch) {
      const imo = shipMatch[1];
      const ships = Array.from(shipCache.values()).filter((s) => s.imo === imo);
      if (ships.length === 0) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Schiff nicht im AIS-Cache" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ship: ships[0] }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    console.error("HTTP error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal error" }));
  }
});

// ─── AIS Stream Connection ────────────────────────────────────────────────
let wsReadyState = false;
let lastMessageTimestamp = 0;
let reconnectAttempts = 0;
let wsClient: WebSocket | null = null;

function connectAISStream() {
  console.log(`[${new Date().toISOString()}] Verbinde mit AISStream.io...`);

  wsClient = new WebSocket("wss://stream.aisstream.io/v0/stream");

  wsClient.on("open", () => {
    console.log(`[${new Date().toISOString()}] ✓ WebSocket verbunden`);
    wsReadyState = true;
    reconnectAttempts = 0;

    // Subscribe — globale Bounding Box (ganze Welt)
    const subscription = {
      APIKey: AISSTREAM_API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [],
      FilterMessageTypes: ["PositionReport", "ShipStaticData", "StandardSearch"],
    };

    wsClient?.send(JSON.stringify(subscription));
    console.log("Subscription gesendet (ganze Welt, alle Schiffstypen)");
  });

  wsClient.on("message", (data: Buffer | string) => {
    try {
      const msg = JSON.parse(data.toString());
      lastMessageTimestamp = Date.now();

      const messageType = msg.MessageType;
      const payload = msg.Message || {};
      const metaData = msg.MetaData || {};

      // PositionReport — enthält Lat/Lon/Speed/Course
      if (messageType === "PositionReport") {
        const mmsi = String(metaData.MMSI || payload.UserID || "");
        if (!mmsi) return;

        const existing = shipCache.get(mmsi) || {
          mmsi,
          lat: 0,
          lon: 0,
          timestamp: 0,
        };

        shipCache.set(mmsi, {
          ...existing,
          mmsi,
          lat: payload.Latitude ?? existing.lat,
          lon: payload.Longitude ?? existing.lon,
          sog: payload.Sog ?? existing.sog,
          cog: payload.Cog ?? existing.cog,
          heading: payload.TrueHeading ?? existing.heading,
          navStatus: payload.NavStatus ?? existing.navStatus,
          name: metaData.ShipName?.trim() || existing.name,
          shipName: metaData.ShipName?.trim() || existing.shipName,
          timestamp: Date.now(),
        });
      }

      // ShipStaticData — enthält IMO, Schiffstyp, Name
      else if (messageType === "ShipStaticData") {
        const mmsi = String(metaData.MMSI || payload.UserID || "");
        if (!mmsi) return;

        const existing = shipCache.get(mmsi) || {
          mmsi,
          lat: 0,
          lon: 0,
          timestamp: 0,
        };

        shipCache.set(mmsi, {
          ...existing,
          mmsi,
          imo: payload.ImoNumber ? String(payload.ImoNumber) : existing.imo,
          name: payload.Name?.trim() || existing.name,
          shipName: payload.Name?.trim() || existing.shipName,
          shipType: payload.Type ?? existing.shipType,
          destination: payload.Destination?.trim() || existing.destination,
          eta: payload.Eta ? String(payload.Eta) : existing.eta,
          timestamp: existing.timestamp || Date.now(),
        });
      }
    } catch (err) {
      // Ignore parse errors
    }
  });

  wsClient.on("error", (err: Error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, err.message);
  });

  wsClient.on("close", () => {
    console.log(`[${new Date().toISOString()}] WebSocket geschlossen`);
    wsReadyState = false;

    // Reconnect with backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    reconnectAttempts++;
    console.log(`Reconnect in ${delay / 1000}s...`);
    setTimeout(connectAISStream, delay);
  });
}

// ─── Cache Persistence ────────────────────────────────────────────────────
async function saveCache() {
  try {
    const data = Array.from(shipCache.values());
    await writeFileAsync(CACHE_FILE, JSON.stringify(data));
    console.log(`[${new Date().toISOString()}] Cache gespeichert: ${data.length} Schiffe`);
  } catch (err) {
    console.error("Cache save error:", err);
  }
}

async function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const data = await readFile(CACHE_FILE, "utf-8");
    const ships = JSON.parse(data) as CachedShip[];
    for (const ship of ships) {
      if (ship.mmsi) shipCache.set(ship.mmsi, ship);
    }
    console.log(`Cache geladen: ${shipCache.size} Schiffe`);
  } catch (err) {
    console.error("Cache load error:", err);
  }
}

// ─── Cleanup: Remove old entries every 5 min ──────────────────────────────
function cleanupOldEntries() {
  const now = Date.now();
  let removed = 0;
  for (const [mmsi, ship] of shipCache) {
    if (now - ship.timestamp > CACHE_TTL_MS) {
      shipCache.delete(mmsi);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[${new Date().toISOString()}] Cleanup: ${removed} alte Einträge entfernt (${shipCache.size} aktiv)`);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────
async function main() {
  if (!AISSTREAM_API_KEY) {
    console.error("FEHLER: AISSTREAM_API_KEY nicht gesetzt!");
    process.exit(1);
  }

  await loadCache();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP API auf http://0.0.0.0:${PORT}`);
    console.log(`  GET /api/ships       - Alle AIS-Schiffe`);
    console.log(`  GET /api/ships/:imo  - Schiff nach IMO`);
    console.log(`  GET /api/stats       - Statistiken`);
    console.log(`  GET /health          - Health Check`);
  });

  connectAISStream();

  // Periodic tasks
  setInterval(saveCache, SAVE_INTERVAL_MS);
  setInterval(cleanupOldEntries, 5 * 60 * 1000);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("SIGTERM empfangen, speichere Cache...");
    await saveCache();
    wsClient?.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
