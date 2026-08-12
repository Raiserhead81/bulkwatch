#!/usr/bin/env python3
"""AIS Global-Fallback: ShipFinder (open.shipfinder.com / Elane Global).
Waehrend aisstream tot ist (seit 05.08.2026), holt dies WELTWEIT Positionen ueber
den VesselsNearby-Endpoint. Jeder Call gibt ~27 Schiffe um eine Referenz-MMSI
zurueck (Ø ~7 unserer Flotte pro Call). KONSERVATIV: striktes Tagesbudget +
Rate-Limit-Spreizung, damit das Gratis-Kontingent nicht verbrannt wird.

Nur UPDATE bestehender Schiffe (per MMSI, sonst IMO), legt KEINE neuen an.
Rotierender Cursor sweept die Flotte ueber viele Laeufe. Usage-Log macht den
Kontingent-Verbrauch sichtbar.

Endpoint (Gratis-Key): GET /v1/AIS/VesselsNearby?key=..&mmsi=<9-stellig>
Zonen-Abfrage (VesselsInZone) ist im Gratis-Tier "Unauthorized" (paid).
Status: 0=ok, 29=rate-limit, sonst (14/21/...) = Fehler/Quota -> Lauf stoppen.
"""
import json, sqlite3, time, urllib.request, os

DB_PATH   = "/opt/bulkwatch/db/ships.db"
STATE     = "/opt/bulkwatch/db/shipfinder_cursor.json"
KEY       = os.environ.get("SHIPFINDER_KEY", "516c162bf9b6444f95be1bee5d8d46e6")
BASE      = "https://open.shipfinder.com/v1/AIS/VesselsNearby"

CALLS_PER_RUN = 20      # Calls je Lauf
DAILY_BUDGET  = 400     # harte Obergrenze Calls/Tag (konservativ; leicht anhebbar)
SPACING_SEC   = 4.5     # Abstand zwischen Calls (4s war im Test rate-limit-frei)


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {"cursor": 0, "calls_total": 0, "calls_today": 0, "day": ""}


def save_state(s):
    with open(STATE, "w") as f:
        json.dump(s, f)


def fetch_nearby(mmsi):
    url = f"{BASE}?key={KEY}&mmsi={mmsi}"
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def valid_coord(lat, lon):
    return (isinstance(lat, (int, float)) and isinstance(lon, (int, float))
            and -90 <= lat <= 90 and -180 <= lon <= 180
            and not (abs(lat) < 0.01 and abs(lon) < 0.01))


def main():
    today = time.strftime("%Y-%m-%d")
    st = load_state()
    if st.get("day") != today:
        st["day"] = today
        st["calls_today"] = 0

    remaining = DAILY_BUDGET - st["calls_today"]
    if remaining <= 0:
        print(f"{time.strftime('%F %T')} shipfinder: Tagesbudget {DAILY_BUDGET} erreicht, uebersprungen")
        return

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout=10000")
    cur = conn.cursor()

    # Abfrage-Reihenfolge: stabile Liste aller MMSI-Schiffe, per Cursor rotiert.
    mmsis = [str(r[0]) for r in cur.execute(
        "SELECT mmsi FROM ships WHERE mmsi IS NOT NULL AND mmsi<>'' ORDER BY imo")]
    if not mmsis:
        print("shipfinder: keine MMSI-Schiffe"); return
    n = len(mmsis)
    cursor = st["cursor"] % n

    budget = min(CALLS_PER_RUN, remaining)
    calls = 0; fleet_updated = set(); returned = 0; stop_reason = ""
    for i in range(budget):
        mmsi = mmsis[(cursor + i) % n]
        try:
            d = fetch_nearby(mmsi)
        except Exception as e:  # noqa: BLE001
            print(f"  {mmsi}: HTTP-Fehler {e}")
            time.sleep(SPACING_SEC); calls += 1; continue
        stt = d.get("status")
        calls += 1
        if stt == 29:                       # Rate-Limit -> kurz warten, weiter
            time.sleep(SPACING_SEC * 2); continue
        if stt != 0:                        # 14/21/Quota o.ae. -> Lauf stoppen
            stop_reason = f"status={stt} msg={d.get('msg')}"
            break
        for v in d.get("data", []) or []:
            lat, lon = v.get("lat"), v.get("lng")
            last = v.get("last_time") or 0
            if not valid_coord(lat, lon) or not last:
                continue
            returned += 1
            vm = str(v.get("mmsi") or "")
            vi = str(v.get("imo") or "")
            # 1) per MMSI (nur wenn neuer)
            if vm:
                cur.execute(
                    "UPDATE ships SET lat=?, lon=?, last_seen=? "
                    "WHERE mmsi=? AND (last_seen IS NULL OR last_seen < ?)",
                    (lat, lon, last, vm, last))
                if cur.rowcount:
                    fleet_updated.add(vm); continue
            # 2) per IMO (MMSI nachtragen)
            if vi and vi != "0":
                cur.execute(
                    "UPDATE ships SET lat=?, lon=?, last_seen=?, "
                    "mmsi=COALESCE(NULLIF(mmsi,''),?) "
                    "WHERE imo=? AND (last_seen IS NULL OR last_seen < ?)",
                    (lat, lon, last, vm, vi, last))
                if cur.rowcount:
                    fleet_updated.add(vi)
        time.sleep(SPACING_SEC)

    conn.commit()
    conn.close()

    st["cursor"] = (cursor + budget) % n
    st["calls_total"] = st.get("calls_total", 0) + calls
    st["calls_today"] = st.get("calls_today", 0) + calls
    save_state(st)

    msg = (f"{time.strftime('%F %T')} shipfinder: {calls} Calls, "
           f"{returned} Schiffe erhalten, {len(fleet_updated)} Flotte aktualisiert | "
           f"heute {st['calls_today']}/{DAILY_BUDGET}, gesamt {st['calls_total']}, "
           f"cursor {st['cursor']}/{n}")
    if stop_reason:
        msg += f" | GESTOPPT: {stop_reason}"
    print(msg)


if __name__ == "__main__":
    main()
