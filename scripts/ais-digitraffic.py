#!/usr/bin/env python3
"""AIS Regional-Feed: digitraffic.fi (Fintraffic) — KOSTENLOS, kein API-Key.
Ergaenzt aisstream (globaler Firehose) um frische Positionen in finnischen/
Ostsee-Gewaessern. Aktualisiert NUR bereits getrackte Schiffe (Match per MMSI
bzw. per IMO ueber die Vessel-Metadaten), legt KEINE neuen an (kein Fluten der
DB mit Faehren). Als Fallback gedacht, waehrend aisstream ausfaellt (seit 05.08.2026).

Attribution (CC BY 4.0, ToS-Pflicht): "Source: Fintraffic / digitraffic.fi,
license CC 4.0 BY". Muss auf der Karte/Live-Seite sichtbar sein.

Cron-tauglich (idempotent). Laeuft z.B. alle 5 Min.
"""
import json, sqlite3, time, urllib.request, gzip, io

DB_PATH = "/opt/bulkwatch/db/ships.db"
LOC_URL = "https://meri.digitraffic.fi/api/ais/v1/locations"
VES_URL = "https://meri.digitraffic.fi/api/ais/v1/vessels"
HEADERS = {"Digitraffic-User": "gemivo-bulkwatch", "Accept-Encoding": "gzip"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def valid_coord(lat, lon):
    return (lat is not None and lon is not None
            and -90 <= lat <= 90 and -180 <= lon <= 180
            and not (abs(lat) < 0.01 and abs(lon) < 0.01))


def main():
    try:
        ves = fetch_json(VES_URL)
        loc = fetch_json(LOC_URL)
    except Exception as e:  # noqa: BLE001
        print(f"digitraffic: Abruf fehlgeschlagen: {e}")
        return

    ves_list = ves if isinstance(ves, list) else ves.get("features", [])
    mmsi2imo = {str(v["mmsi"]): str(v["imo"])
                for v in ves_list if v.get("imo") and v.get("mmsi")}

    feats = loc.get("features", []) if isinstance(loc, dict) else loc

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout=10000")
    cur = conn.cursor()

    by_mmsi = by_imo = skipped = 0
    for f in feats:
        props = f.get("properties", {})
        mmsi = str(f.get("mmsi") or props.get("mmsi") or "")
        geom = f.get("geometry", {})
        coords = geom.get("coordinates") or [None, None]
        lon, lat = coords[0], coords[1]
        ts_ms = props.get("timestampExternal") or 0
        if not mmsi or not valid_coord(lat, lon) or not ts_ms:
            skipped += 1
            continue
        last_seen = int(ts_ms) // 1000

        # 1) Match per MMSI (nur aktualisieren, wenn neuer)
        cur.execute(
            "UPDATE ships SET lat=?, lon=?, last_seen=? "
            "WHERE mmsi=? AND (last_seen IS NULL OR last_seen < ?)",
            (lat, lon, last_seen, mmsi, last_seen))
        if cur.rowcount:
            by_mmsi += 1
            continue

        # 2) Match per IMO (aus Metadaten), MMSI nachtragen falls leer
        imo = mmsi2imo.get(mmsi)
        if imo:
            cur.execute(
                "UPDATE ships SET lat=?, lon=?, last_seen=?, "
                "mmsi=COALESCE(NULLIF(mmsi,''),?) "
                "WHERE imo=? AND (last_seen IS NULL OR last_seen < ?)",
                (lat, lon, last_seen, mmsi, imo, last_seen))
            if cur.rowcount:
                by_imo += 1

    conn.commit()
    conn.close()
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} digitraffic: {by_mmsi} per MMSI, {by_imo} per IMO aktualisiert, "
          f"{skipped} uebersprungen (von {len(feats)} Positionen)")


if __name__ == "__main__":
    main()
