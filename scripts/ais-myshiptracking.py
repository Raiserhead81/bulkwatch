#!/usr/bin/env python3
"""AIS Global-Feed: MyShipTracking offener Karten-Endpoint (kein Key).
Globaler Fallback waehrend aisstream tot ist. Adaptive Kachelung: die Welt wird
in Bounding-Boxes zerlegt; jede Kachel, die am ~5000-Cap anschlaegt, wird
geviertelt (bis MAX_DEPTH). Nur UPDATE bestehender Schiffe per MMSI (kein IMO im
Feed), keine Neuanlage. Gedrosselt + Browser-UA.

⚠️ ToS-GRAU: undokumentierter interner Endpoint (offizielle API = paid). Respektvoll
gedrosselt, kann jederzeit gesperrt werden -> dann faellt der Feed einfach aus
(defensiv: alle Fehler abgefangen, kein Crash).

Feld (TSV): typ|flag|MMSI|Name|lat|lon|sog|cog|?|UnixTS|  (Timestamp = letztes
Epoch-Feld, Trailing-Tab leer). Datenquelle: myshiptracking.com (AIS public).
"""
import sqlite3, time, urllib.request, urllib.parse, json

DB_PATH = "/opt/bulkwatch/db/ships.db"
BASE    = "https://www.myshiptracking.com/requests/vesselsonmaptempTTT.php"
UA      = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
FILTERS = '{"vtypes":",0,3,4,6,7,8,9,10,11,12","ports":"0"}'

SEED_DEG   = 40      # Kantenlaenge Start-Kacheln (Grad)
CAP_SPLIT  = 4500    # ab so vielen Schiffen -> Kachel vierteln (Cap ~5000)
MAX_DEPTH  = 3       # 40 -> 20 -> 10 -> 5 Grad
SLEEP      = 1.3     # Sekunden zwischen HTTP-Calls (respektvoll)
MAX_CALLS  = 400     # Sicherheits-Obergrenze pro Lauf


def fetch_tile(minlat, minlon, maxlat, maxlon):
    q = (f"{BASE}?type=json&zoom=7&selid=-1&seltype=0&timecode=-1"
         f"&minlat={minlat}&minlon={minlon}&maxlat={maxlat}&maxlon={maxlon}"
         f"&filters={urllib.parse.quote(FILTERS)}")
    req = urllib.request.Request(q, headers={"accept": "text/plain", "user-agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    ships = []
    for ln in text.splitlines()[2:]:          # Z1=servertime, Z2=count
        col = ln.split("\t")
        if len(col) < 8 or not col[2].isdigit():
            continue
        try:
            lat = float(col[4]); lon = float(col[5])
        except ValueError:
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        ts = 0
        for f in reversed(col):               # Timestamp = letztes Epoch-Feld
            if f.isdigit() and int(f) > 1_000_000_000:
                ts = int(f); break
        if ts:
            ships.append((col[2], lat, lon, ts))
    return ships


def main():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout=10000")
    cur = conn.cursor()
    our = {str(r[0]) for r in cur.execute(
        "SELECT mmsi FROM ships WHERE mmsi IS NOT NULL AND mmsi<>''")}

    # Start-Kacheln (Welt), BFS mit adaptivem Split
    work = []
    lat = -80
    while lat < 80:
        lon = -180
        while lon < 180:
            work.append((lat, lon, min(lat + SEED_DEG, 80), min(lon + SEED_DEG, 180), 0))
            lon += SEED_DEG
        lat += SEED_DEG

    calls = 0; seen_total = 0; capped = 0
    updated = set()
    while work and calls < MAX_CALLS:
        minlat, minlon, maxlat, maxlon, depth = work.pop(0)
        try:
            ships = fetch_tile(minlat, minlon, maxlat, maxlon)
        except Exception as e:  # noqa: BLE001
            print(f"  Kachel {minlat},{minlon} Fehler: {e}")
            calls += 1; time.sleep(SLEEP); continue
        calls += 1
        seen_total += len(ships)
        if len(ships) >= CAP_SPLIT and depth < MAX_DEPTH:
            capped += 1
            hlat = (minlat + maxlat) / 2; hlon = (minlon + maxlon) / 2
            work += [(minlat, minlon, hlat, hlon, depth + 1),
                     (hlat, minlon, maxlat, hlon, depth + 1),
                     (minlat, hlon, hlat, maxlon, depth + 1),
                     (hlat, hlon, maxlat, maxlon, depth + 1)]
            # trotzdem die Treffer dieser (gekappten) Kachel mitnehmen
        for mmsi, lat_, lon_, ts in ships:
            if mmsi in our:
                cur.execute(
                    "UPDATE ships SET lat=?, lon=?, last_seen=? "
                    "WHERE mmsi=? AND (last_seen IS NULL OR last_seen < ?)",
                    (lat_, lon_, ts, mmsi, ts))
                if cur.rowcount:
                    updated.add(mmsi)
        time.sleep(SLEEP)

    conn.commit(); conn.close()
    print(f"{time.strftime('%F %T')} myshiptracking: {calls} Calls, "
          f"{seen_total} Schiffe gesehen, {len(updated)} Flotte aktualisiert, "
          f"{capped} Kacheln gesplittet"
          + (" | MAX_CALLS erreicht" if calls >= MAX_CALLS else ""))


if __name__ == "__main__":
    main()
