import sqlite3
import requests
import time

DB_PATH = "/opt/bulkwatch/db/ships.db"
API_URL = "http://localhost:3099/api/ais"

try:
    resp = requests.get(API_URL, timeout=10)
    data = resp.json()
    ships = data.get("ships", []) if isinstance(data, dict) else data
    if not ships and isinstance(data, dict):
        ships = list(data.values())

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    added = 0
    updated = 0
    for ship in ships:
        imo = str(ship.get("imo", "")).strip()
        if not imo or len(imo) < 5 or not imo.isdigit():
            continue
        name = str(ship.get("name", "")).strip()
        mmsi = str(ship.get("mmsi", "")) or None
        lat = ship.get("lat")
        lon = ship.get("lon")
        last_seen = ship.get("lastSeen") or int(time.time())

        cur.execute("SELECT imo FROM ships WHERE imo = ?", (imo,))
        exists = cur.fetchone()

        if exists:
            cur.execute(
                "UPDATE ships SET lat=?, lon=?, last_seen=?, mmsi=COALESCE(mmsi,?) WHERE imo=?",
                (lat, lon, last_seen, mmsi, imo)
            )
            updated += 1
        else:
            if name:
                cur.execute(
                    "INSERT OR IGNORE INTO ships (imo, name, mmsi, type, flag, lat, lon, last_seen, source) VALUES (?, ?, ?, 'Bulk Carrier', 'Unknown', ?, ?, ?, 'ais')",
                    (imo, name, mmsi, lat, lon, last_seen)
                )
                added += 1

    conn.commit()
    conn.close()
    print(f"AIS update: {added} added, {updated} positions updated")

except Exception as e:
    print(f"Error: {e}")