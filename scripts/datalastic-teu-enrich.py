#!/usr/bin/env python3
"""Fill REAL TEU (+ GT) for container ships from Datalastic vessel_info.

TEU drives container newbuild price in the valuation (containerNewbuildPrice),
so real TEU replaces the dwt/14 estimate. Credit-bounded: only container-type
ships that lack TEU, have a valid IMO, aren't known-404, and weren't already
queried in datalastic_fields_log. One call fills teu + gross_tonnage.
"""
import sqlite3, urllib.request, json, time, signal

DB = "/opt/bulkwatch/db/ships.db"
KEY = open("/opt/bulkwatch/config/datalastic-key.txt").read().strip()
DELAY = 0.3
URL = "https://api.datalastic.com/api/v0/vessel_info?api-key=%s&imo=%s"
CONTAINER_TYPES = ("Container Ship", "Feeder", "ULCV", "Neo-Panamax", "Post-Panamax")

def imo_valid(s):
    return bool(s and str(s).isdigit() and len(str(s)) == 7
                and sum(int(str(s)[i]) * (7 - i) for i in range(6)) % 10 == int(str(s)[6]))

def num(v):
    try:
        f = float(v); return f if f > 0 else None
    except (TypeError, ValueError):
        return None

running = True
def stop(*a):
    global running; running = False
    print("\nStop — beende nach aktuellem Schiff...", flush=True)
signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)

db = sqlite3.connect(DB)
db.execute("""CREATE TABLE IF NOT EXISTS datalastic_fields_log(
    imo TEXT PRIMARY KEY, filled INTEGER, ts TEXT)""")
db.commit()
known_404 = {r[0] for r in db.execute("SELECT imo FROM datalastic_log WHERE found=0")}
done = {r[0] for r in db.execute("SELECT imo FROM datalastic_fields_log")}

ph = ",".join("?" * len(CONTAINER_TYPES))
rows = db.execute(
    "SELECT imo FROM ships WHERE type IN (%s) AND (teu IS NULL OR teu=0) AND imo GLOB '[0-9]*'" % ph,
    CONTAINER_TYPES).fetchall()
targets = [r[0] for r in rows if imo_valid(r[0]) and r[0] not in known_404 and r[0] not in done]
print("Ziel: %d Container-Schiffe ohne TEU (gültige IMO, noch offen)" % len(targets), flush=True)

teu_filled = gt_filled = miss = err = 0
for i, imo in enumerate(targets):
    if not running: break
    try:
        d = json.load(urllib.request.urlopen(URL % (KEY, imo), timeout=25)).get("data") or {}
        teu, gt = num(d.get("teu")), num(d.get("gross_tonnage"))
        if teu or gt:
            sets, params = [], []
            if teu:
                sets.append("teu = CASE WHEN teu IS NULL OR teu=0 THEN ? ELSE teu END"); params.append(int(teu)); teu_filled += 1
            if gt:
                sets.append("gross_tonnage = CASE WHEN gross_tonnage IS NULL OR gross_tonnage=0 THEN ? ELSE gross_tonnage END"); params.append(int(gt)); gt_filled += 1
            params.append(imo)
            db.execute("UPDATE ships SET %s WHERE imo=?" % ", ".join(sets), params)
        else:
            miss += 1
        db.execute("INSERT OR REPLACE INTO datalastic_fields_log VALUES (?,?,datetime('now'))", (imo, 1 if d else 0))
        db.commit()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            miss += 1
            db.execute("INSERT OR REPLACE INTO datalastic_fields_log VALUES (?,0,datetime('now'))", (imo,)); db.commit()
        else:
            err += 1
            if e.code in (401, 402, 403, 429):
                print("  Kein Zugriff/Credits (%s) — Abbruch" % e.code, flush=True); break
    except Exception as e:
        err += 1; print("  Fehler %s: %s" % (imo, e), flush=True)
    if (i + 1) % 200 == 0:
        print("  [%d/%d] TEU=%d GT=%d miss=%d err=%d" % (i+1, len(targets), teu_filled, gt_filled, miss, err), flush=True)
    time.sleep(DELAY)

print("\nFERTIG. TEU gefüllt=%d | GT gefüllt=%d | ohne Daten=%d | Fehler=%d"
      % (teu_filled, gt_filled, miss, err), flush=True)
