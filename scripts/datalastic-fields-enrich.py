#!/usr/bin/env python3
"""Second pass: fill secondary REAL fields from Datalastic vessel_info.

Fills mmsi, flag, call_sign, teu, gross_tonnage, draft, length, beam,
year_built, home_port, speed_knots — but ONLY where our value is empty.
Never overwrites existing data. Leaves dwt to the first pass.

Targets all valid-IMO ships, skipping ones already known to 404 in
datalastic_log (found=0) to save calls. Resumable via datalastic_fields_log.
"""
import sqlite3, urllib.request, json, time, sys, signal

DB = "/opt/bulkwatch/db/ships.db"
KEY = open("/opt/bulkwatch/config/datalastic-key.txt").read().strip()
DELAY = 0.3
URL = "https://api.datalastic.com/api/v0/vessel_info?api-key=%s&imo=%s"

# Datalastic field -> (our column, is_numeric)
FIELDS = [
    ("mmsi",          "mmsi",          False),
    ("country_name",  "flag",          False),
    ("callsign",      "call_sign",     False),
    ("teu",           "teu",           True),
    ("gross_tonnage", "gross_tonnage", True),
    ("year_built",    "year_built",    True),
    ("length",        "length",        True),
    ("breadth",       "beam",          True),
    ("home_port",     "home_port",     False),
    ("speed_avg",     "speed_knots",   True),
]

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
    print("\nStop-Signal — beende nach aktuellem Schiff...", flush=True)
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

db = sqlite3.connect(DB)
db.execute("""CREATE TABLE IF NOT EXISTS datalastic_fields_log(
    imo TEXT PRIMARY KEY, filled INTEGER, ts TEXT)""")
db.commit()

known_404 = {r[0] for r in db.execute("SELECT imo FROM datalastic_log WHERE found=0")}
done = {r[0] for r in db.execute("SELECT imo FROM datalastic_fields_log")}
rows = db.execute("SELECT imo FROM ships WHERE imo GLOB '[0-9]*'").fetchall()
targets = [r[0] for r in rows if imo_valid(r[0]) and r[0] not in known_404 and r[0] not in done]
print("Ziel: %d Schiffe (gültige IMO, nicht 404, noch offen)" % len(targets), flush=True)

# per-field fill counters
fill_count = {c: 0 for _, c, _ in FIELDS}
processed = miss = err = 0
for i, imo in enumerate(targets):
    if not running:
        break
    try:
        d = json.load(urllib.request.urlopen(URL % (KEY, imo), timeout=25)).get("data") or {}
        if not d:
            miss += 1
        else:
            # draft: prefer max, fallback avg
            draft = num(d.get("draught_max")) or num(d.get("draught_avg"))
            sets, params = [], []
            for src, col, isnum in FIELDS:
                v = num(d.get(src)) if isnum else (str(d.get(src)).strip() if d.get(src) else None)
                if not v:
                    continue
                if isnum:
                    sets.append("%s = CASE WHEN %s IS NULL OR %s=0 THEN ? ELSE %s END" % (col, col, col, col))
                    params.append(int(v) if col in ("teu","gross_tonnage","year_built") else v)
                else:
                    sets.append("%s = CASE WHEN %s IS NULL OR %s='' THEN ? ELSE %s END" % (col, col, col, col))
                    params.append(v)
                fill_count[col] += 1  # attempted (may be no-op if already set)
            if draft:
                sets.append("draft = CASE WHEN draft IS NULL OR draft=0 THEN ? ELSE draft END")
                params.append(draft)
            if sets:
                params.append(imo)
                db.execute("UPDATE ships SET %s WHERE imo=?" % ", ".join(sets), params)
        db.execute("INSERT OR REPLACE INTO datalastic_fields_log VALUES (?,?,datetime('now'))",
                   (imo, 1 if d else 0))
        db.commit()
        processed += 1
    except urllib.error.HTTPError as e:
        if e.code == 404:
            miss += 1
            db.execute("INSERT OR REPLACE INTO datalastic_fields_log VALUES (?,0,datetime('now'))", (imo,))
            db.commit()
        else:
            err += 1
            if e.code in (401, 403, 429):
                print("  Auth/Rate %s — Abbruch" % e.code, flush=True); break
    except Exception as e:
        err += 1
        print("  Fehler IMO %s: %s" % (imo, e), flush=True)

    if (i + 1) % 500 == 0:
        print("  [%d/%d] verarbeitet=%d miss=%d err=%d" % (i+1, len(targets), processed, miss, err), flush=True)
    time.sleep(DELAY)

print("\nFERTIG. verarbeitet=%d | miss=%d | err=%d" % (processed, miss, err), flush=True)
