#!/usr/bin/env python3
"""AIS Regional-Feed: Great Lakes / St. Lawrence Seaway (vis.seaway.ca).
Offenes GraphQL der binational-staatlichen Seaway-Karte, KEINE Auth. Deckt Grosse
Seen, St.-Lorenz-Strom, Golf v. St. Lorenz / Atlantik-Kanada. Relevant fuer Bulker
Richtung Montreal. Match per IMO (Feed hat KEIN MMSI). Nur UPDATE bestehender
Schiffe, keine Neuanlage. Query-Payload in scripts/seaway_query.json.
"""
import json, sqlite3, time, calendar, urllib.request, ssl

DB_PATH   = "/opt/bulkwatch/db/ships.db"
QUERY_F   = "/opt/bulkwatch/scripts/seaway_query.json"
CA_BUNDLE = "/opt/bulkwatch/scripts/seaway-ca.pem"  # System-CA + Sectigo-Intermediate (vollstaendige, verifizierende Kette)
URL       = "https://vis.seaway.ca/graphql"


def iso_to_epoch(s):
    try:
        return calendar.timegm(time.strptime(s.replace("Z", "GMT"),
                                             "%Y-%m-%dT%H:%M:%S%Z"))
    except Exception:
        try:
            return calendar.timegm(time.strptime(s[:19], "%Y-%m-%dT%H:%M:%S"))
        except Exception:
            return 0


def main():
    payload = open(QUERY_F, "rb").read()
    req = urllib.request.Request(URL, data=payload,
                                 headers={"Content-Type": "application/json",
                                          "Accept": "application/json",
                                          "User-Agent": "gemivo-bulkwatch"})
    # vis.seaway.ca sendet die Intermediate-CA nicht mit -> eigene, VOLLSTAENDIGE
    # verifizierende Bundle (System-CA + Sectigo R36) statt Verify abzuschalten.
    ctx = ssl.create_default_context(cafile=CA_BUNDLE)
    try:
        with urllib.request.urlopen(req, timeout=40, context=ctx) as r:
            d = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"seaway: Abruf fehlgeschlagen: {e}"); return

    vessels = (d.get("data", {}) or {}).get("aisOnlyVessels") or []
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout=10000")
    cur = conn.cursor()

    updated = 0; skipped = 0
    for v in vessels:
        ais = v.get("aisInformation") or {}
        imo = ais.get("imoNumber")
        lat = ais.get("latitude"); lon = ais.get("longitude")
        if not imo or lat is None or lon is None:
            skipped += 1; continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180) or lat == 91 or lon == 181:
            skipped += 1; continue          # AIS "not available"
        ts = iso_to_epoch(ais.get("age") or "")
        if not ts:
            skipped += 1; continue
        cur.execute(
            "UPDATE ships SET lat=?, lon=?, last_seen=? "
            "WHERE imo=? AND (last_seen IS NULL OR last_seen < ?)",
            (lat, lon, ts, str(imo), ts))
        if cur.rowcount:
            updated += 1

    conn.commit(); conn.close()
    print(f"{time.strftime('%F %T')} seaway: {len(vessels)} Schiffe im Feed, "
          f"{updated} Flotte aktualisiert, {skipped} ohne Pos/IMO")


if __name__ == "__main__":
    main()
