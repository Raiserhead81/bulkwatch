#!/usr/bin/env python3
"""AIS Persist v2 — matches by IMO AND by name, accumulates positions over time.
Calls the protected /api/ais endpoint with the internal service token (the API requires
auth since the 2026-07 security hardening)."""
import sqlite3, requests, time, os, re

DB_PATH = "/opt/bulkwatch/db/ships.db"
API_URL = "http://localhost:3099/api/ais"
ENV_PATH = "/opt/bulkwatch/.env"

def load_token():
    tok = os.environ.get("INTERNAL_API_TOKEN")
    if tok:
        return tok
    try:
        m = re.search(r'^INTERNAL_API_TOKEN=(.+)$', open(ENV_PATH).read(), re.M)
        return m.group(1).strip() if m else ""
    except Exception:
        return ""

try:
    token = load_token()
    resp = requests.get(API_URL, headers={"x-internal-token": token}, timeout=10)
    if resp.status_code != 200:
        raise SystemExit(f"Error: /api/ais returned HTTP {resp.status_code}: {resp.text[:120]}")
    data = resp.json()
    ships = data.get("ships") if isinstance(data, dict) else data
    if not isinstance(ships, list):
        raise SystemExit(f"Error: unexpected /api/ais response shape: {str(data)[:120]}")
    ships = [s for s in ships if isinstance(s, dict)]

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    cur = conn.cursor()

    # Build name->imo index for name-based matching (only unique names!)
    name_counts = {}
    name_index = {}
    for row in cur.execute("SELECT imo, UPPER(name) FROM ships WHERE name IS NOT NULL"):
        uname = row[1]
        name_counts[uname] = name_counts.get(uname, 0) + 1
        name_index[uname] = row[0]
    # Remove ambiguous names (multiple ships with same name)
    for uname, cnt in name_counts.items():
        if cnt > 1:
            del name_index[uname]

    updated_imo = 0
    updated_name = 0
    added = 0
    now = int(time.time())

    for ship in ships:
        imo = str(ship.get("imo", "")).strip()
        name = str(ship.get("name", "")).strip()
        mmsi = str(ship.get("mmsi", "")) or None
        lat = ship.get("lat")
        lon = ship.get("lon")
        if not lat or not lon or (lat == 0 and lon == 0):
            continue
        last_seen = ship.get("lastSeen") or now

        matched_imo = None

        # Match 1: by IMO
        if imo and len(imo) >= 5 and imo.isdigit():
            cur.execute("SELECT imo FROM ships WHERE imo = ?", (imo,))
            if cur.fetchone():
                matched_imo = imo

        # Match 2: by name (if no IMO match)
        if not matched_imo and name:
            matched_imo = name_index.get(name.upper())

        if matched_imo:
            cur.execute(
                "UPDATE ships SET lat=?, lon=?, last_seen=?, mmsi=COALESCE(mmsi,?) WHERE imo=?",
                (lat, lon, last_seen, mmsi, matched_imo)
            )
            if imo and len(imo) >= 5:
                updated_imo += 1
            else:
                updated_name += 1
        else:
            # New ship not in DB — add if has valid IMO
            if imo and len(imo) >= 5 and imo.isdigit() and name:
                cur.execute(
                    "INSERT OR IGNORE INTO ships (imo, name, mmsi, type, flag, lat, lon, last_seen, source) "
                    "VALUES (?, ?, ?, 'Bulk Carrier', 'Unknown', ?, ?, ?, 'ais')",
                    (imo, name, mmsi, lat, lon, last_seen)
                )
                added += 1

    conn.commit()
    conn.close()
    print(f"AIS persist: {updated_imo} by IMO, {updated_name} by name, {added} new")

except Exception as e:
    print(f"Error: {e}")
