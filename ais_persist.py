#!/usr/bin/env python3
"""
AIS-Stream Persistenz fuer BulkWatch — FIXED VERSION
Liest vom echten /api/ais Endpoint (gibt ships[] zurueck).
"""

import json, os, time, urllib.request

AIS_API = "http://localhost:3099/api/ais"
OUT = "/opt/bulkwatch/src/data/ais-ships.json"
BULK_TYPES = set(range(70, 80))

def main():
    existing = {}
    if os.path.exists(OUT):
        try:
            existing = json.load(open(OUT))
        except:
            existing = {}

    try:
        req = urllib.request.Request(AIS_API, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"AIS API error: {e}")
        return

    ships = data.get("ships", [])
    print(f"AIS cache: {len(ships)} ships total")

    added = 0
    for ship in ships:
        stype = ship.get("shipType", 0)
        if stype not in BULK_TYPES:
            continue
        imo = (ship.get("imo") or "").strip()
        name = (ship.get("name") or "").strip()

        if not imo or len(imo) != 7 or not imo.isdigit():
            continue
        if not name or name.upper() in ("", "UNKNOWN", "N/A", "0"):
            continue

        now = int(time.time())
        if imo not in existing:
            existing[imo] = {
                "imo": imo,
                "name": name,
                "mmsi": ship.get("mmsi", ""),
                "lastSeen": now,
                "lat": ship.get("lat"),
                "lon": ship.get("lon"),
            }
            added += 1
        else:
            existing[imo]["lastSeen"] = now

    print(f"New AIS bulk carriers added: {added}, total: {len(existing)}")
    with open(OUT, "w") as f:
        json.dump(existing, f, ensure_ascii=False)
    print(f"Saved {OUT}")

if __name__ == "__main__":
    main()
