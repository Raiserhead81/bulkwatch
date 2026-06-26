#!/usr/bin/env python3
"""
AIS Streamer Service (Python) — läuft stable statt TypeScript-Version
Verbindet mit AISStream.io WebSocket, cached Positionen, bietet REST-API.

Port: 3099
Endpoints:
  GET /health       - Health Check
  GET /api/stats    - Statistiken
  GET /api/ships    - Alle Schiffe im Cache (alle Schiffstypen)
  GET /api/ships/<imo> - Schiff nach IMO
"""

import asyncio
import json
import os
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from urllib.parse import urlparse

import websockets

# ─── Config ────────────────────────────────────────────────────────────────
PORT = 3099
API_KEY = os.environ.get("AISSTREAM_API_KEY", "")
CACHE_TTL_SEC = 30 * 60  # 30 minutes
CACHE_FILE = "/tmp/ais-cache.json"

# ─── In-Memory Cache ──────────────────────────────────────────────────────
# Key: MMSI (string), Value: ship data
ship_cache: dict[str, dict] = {}
ws_connected = False
last_message_ts = 0
reconnect_attempts = 0


def save_cache():
    """Periodisch Cache auf Disk speichern."""
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(list(ship_cache.values()), f)
        print(f"[{time.strftime('%H:%M:%S')}] Cache gespeichert: {len(ship_cache)} Schiffe")
    except Exception as e:
        print(f"Cache save error: {e}")


def load_cache():
    """Cache beim Start laden."""
    global ship_cache
    try:
        if not os.path.exists(CACHE_FILE):
            return
        with open(CACHE_FILE) as f:
            ships = json.load(f)
        for s in ships:
            if s.get("mmsi"):
                ship_cache[s["mmsi"]] = s
        print(f"Cache geladen: {len(ship_cache)} Schiffe")
    except Exception as e:
        print(f"Cache load error: {e}")


async def ais_stream():
    """Verbinde mit AISStream.io und empfange Positionen."""
    global ws_connected, last_message_ts, reconnect_attempts

    url = "wss://stream.aisstream.io/v0/stream"
    subscription = {
        "APIKey": API_KEY,
        "BoundingBoxes": [[[-90, -180], [90, 180]]],  # ganze Welt
        "FiltersShipMMSI": [],
        "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
    }

    while True:
        try:
            print(f"[{time.strftime('%H:%M:%S')}] Verbinde mit AISStream.io...")
            async with websockets.connect(
                url,
                open_timeout=15,
                close_timeout=5,
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                print(f"[{time.strftime('%H:%M:%S')}] ✓ WebSocket verbunden")
                ws_connected = True
                reconnect_attempts = 0

                await ws.send(json.dumps(subscription))
                print("Subscription gesendet (ganze Welt, alle Schiffstypen)")

                # Endlos-Loop: Nachrichten empfangen
                async for raw in ws:
                    try:
                        msg = json.loads(raw.decode() if isinstance(raw, bytes) else raw)
                        last_message_ts = int(time.time())

                        msg_type = msg.get("MessageType", "")
                        payload = msg.get("Message", {})
                        metadata = msg.get("MetaData", {})

                        if msg_type == "PositionReport":
                            pr = payload.get("PositionReport", {})
                            mmsi = str(metadata.get("MMSI") or pr.get("UserID") or "")
                            if not mmsi:
                                continue

                            existing = ship_cache.get(mmsi, {
                                "mmsi": mmsi,
                                "lat": 0,
                                "lon": 0,
                                "timestamp": 0,
                            })

                            ship_cache[mmsi] = {
                                **existing,
                                "mmsi": mmsi,
                                "lat": pr.get("Latitude", existing.get("lat", 0)),
                                "lon": pr.get("Longitude", existing.get("lon", 0)),
                                "sog": pr.get("Sog", existing.get("sog")),
                                "cog": pr.get("Cog", existing.get("cog")),
                                "heading": pr.get("TrueHeading", existing.get("heading")),
                                "navStatus": pr.get("NavigationalStatus", existing.get("navStatus")),
                                "name": (metadata.get("ShipName") or existing.get("name") or "").strip(),
                                "shipName": (metadata.get("ShipName") or existing.get("shipName") or "").strip(),
                                "timestamp": int(time.time()),
                            }

                        elif msg_type == "ShipStaticData":
                            sd = payload.get("ShipStaticData", {})
                            mmsi = str(metadata.get("MMSI") or sd.get("UserID") or "")
                            if not mmsi:
                                continue

                            existing = ship_cache.get(mmsi, {
                                "mmsi": mmsi,
                                "lat": 0,
                                "lon": 0,
                                "timestamp": 0,
                            })

                            imo_num = sd.get("ImoNumber")
                            ship_cache[mmsi] = {
                                **existing,
                                "mmsi": mmsi,
                                "imo": str(imo_num) if imo_num else existing.get("imo"),
                                "name": (sd.get("Name") or existing.get("name") or "").strip(),
                                "shipName": (sd.get("Name") or existing.get("shipName") or "").strip(),
                                "shipType": sd.get("Type", existing.get("shipType")),
                                "destination": (sd.get("Destination") or existing.get("destination") or "").strip(),
                                "eta": str(sd.get("Eta")) if sd.get("Eta") else existing.get("eta"),
                                "timestamp": existing.get("timestamp") or int(time.time()),
                            }

                    except Exception:
                        # Ignore parse errors
                        pass

        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] WebSocket error: {type(e).__name__}: {e}")

        ws_connected = False
        reconnect_attempts += 1
        delay = min(2 ** reconnect_attempts, 30)
        print(f"[{time.strftime('%H:%M:%S')}] Reconnect in {delay}s...")
        await asyncio.sleep(delay)


async def cache_saver():
    """Speichert den Cache alle 5 Minuten."""
    while True:
        await asyncio.sleep(300)
        save_cache()


# ─── HTTP Server ──────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({}, 204)

    def do_GET(self):
        path = urlparse(self.path).path
        now = int(time.time())

        if path == "/health":
            self._send_json({
                "status": "ok",
                "ships": len(ship_cache),
                "uptime": int(time.time() - START_TIME),
                "lastMessage": last_message_ts,
                "wsConnected": ws_connected,
            })
            return

        if path == "/api/stats":
            recent = [s for s in ship_cache.values() if now - s.get("timestamp", 0) < CACHE_TTL_SEC]
            self._send_json({
                "totalShips": len(ship_cache),
                "activeShips": len(recent),
                "lastMessage": last_message_ts,
                "uptime": int(time.time() - START_TIME),
                "wsConnected": ws_connected,
                "cacheTtlSec": CACHE_TTL_SEC,
            })
            return

        if path == "/api/ships":
            ships = [
                s for s in ship_cache.values()
                if now - s.get("timestamp", 0) < CACHE_TTL_SEC and s.get("lat") and s.get("lon")
            ]
            ships.sort(key=lambda s: s.get("timestamp", 0), reverse=True)
            self._send_json({"ships": ships, "count": len(ships), "timestamp": now})
            return

        # /api/ships/<imo>
        if path.startswith("/api/ships/"):
            imo = path.split("/")[-1]
            matches = [s for s in ship_cache.values() if s.get("imo") == imo]
            if not matches:
                self._send_json({"error": "Schiff nicht im AIS-Cache"}, 404)
                return
            self._send_json({"ship": matches[0]})
            return

        self._send_json({"error": "Not found"}, 404)

    def log_message(self, format, *args):
        pass  # Suppress default logging


START_TIME = time.time()


def run_http():
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"HTTP API auf http://0.0.0.0:{PORT}")
    print(f"  GET /health       - Health Check")
    print(f"  GET /api/stats    - Statistiken")
    print(f"  GET /api/ships    - Alle Schiffe im Cache")
    print(f"  GET /api/ships/<imo> - Schiff nach IMO")
    server.serve_forever()


def main():
    if not API_KEY:
        print("FEHLER: AISSTREAM_API_KEY nicht gesetzt!")
        print("  export AISSTREAM_API_KEY=dein_key")
        return

    print(f"=== AIS Streamer Service (Python) ===")
    print(f"API-Key: {API_KEY[:8]}...{API_KEY[-4:]}")
    print()

    load_cache()

    # HTTP Server in Thread starten
    http_thread = Thread(target=run_http, daemon=True)
    http_thread.start()

    # AIS WebSocket + Cache-Saver in asyncio Loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.create_task(cache_saver())
    loop.run_until_complete(ais_stream())


if __name__ == "__main__":
    main()
