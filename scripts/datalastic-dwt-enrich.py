#!/usr/bin/env python3
"""Fill REAL deadweight (DWT) from Datalastic vessel_info API.

Targets ships whose DWT is a placeholder (industry type-average from
enrich-all.py, or a known DEFAULT_DWTS value) or missing entirely.
Writes only real values returned by Datalastic — never estimates.
Resumable via datalastic_log; skips ships already queried (incl. 404 misses).

Also opportunistically fills gross_tonnage/year_built/length/beam from
Datalastic when ours is empty (all real values from the same source).
"""
import sqlite3, urllib.request, json, time, sys, signal

DB = "/opt/bulkwatch/db/ships.db"
KEY = open("/opt/bulkwatch/config/datalastic-key.txt").read().strip()
DELAY = 0.3           # seconds between API calls
ENDPOINT = "https://api.datalastic.com/api/v0/vessel_info?api-key=%s&imo=%s"

# Placeholder DWT signatures (must match real data only when replaced)
TYPE_DWT = {"Valemax":400000,"VLOC":300000,"Newcastlemax":210000,"Capesize":180000,
"Post-Panamax":100000,"Kamsarmax":82000,"Panamax":75000,"Ultramax":64000,"Supramax":58000,
"Handymax":45000,"Handysize":35000,"Mini-Bulker":12000,"Gearless":75000,"Geared":55000,
"Bulk Carrier":55000,"Crude Oil Tanker":150000,"Tanker":80000,"Oil/Chemical Tanker":40000,
"Product Tanker":50000,"Chemical Tanker":25000,"LNG Tanker":174000,"LPG Tanker":84000,
"Container Ship":50000,"ULCV":230000,"Neo-Panamax":150000,"Feeder":15000,"General Cargo":15000,
"Multipurpose":20000,"RoRo":20000,"Car Carrier":18000,"Passenger":5000,"Cruise Ship":50000,
"Ferry":3000,"Reefer":12000,"Offshore":5000,"Tug":500,"OSV":4000,"Other":10000}
DEFAULT_DWTS = {5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000}

running = True
def stop(*a):
    global running; running = False
    print("\nStop-Signal — beende nach aktuellem Schiff...", flush=True)
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)

db = sqlite3.connect(DB)
db.execute("""CREATE TABLE IF NOT EXISTS datalastic_log(
    imo TEXT PRIMARY KEY, dwt INTEGER, found INTEGER, ts TEXT)""")
db.commit()

def is_placeholder(dwt, typ):
    if dwt is None or dwt == 0:
        return True
    if dwt in DEFAULT_DWTS:
        return True
    return typ in TYPE_DWT and dwt == TYPE_DWT[typ]

def imo_valid(s):
    """IMO check-digit validation — corrupt Wikidata IMOs would 404 forever."""
    if not (s and s.isdigit() and len(s) == 7):
        return False
    return sum(int(s[i]) * (7 - i) for i in range(6)) % 10 == int(s[6])

# Build target list: placeholder/missing DWT, VALID real IMO, not yet queried
rows = db.execute("""SELECT imo, type, dwt FROM ships
    WHERE imo GLOB '[0-9]*'
    AND imo NOT IN (SELECT imo FROM datalastic_log)""").fetchall()
targets = [(imo, typ) for imo, typ, dwt in rows
           if is_placeholder(dwt, typ) and imo_valid(imo)]
skipped_invalid = sum(1 for imo, typ, dwt in rows
                      if is_placeholder(dwt, typ) and not imo_valid(imo))
print("Ziel: %d Schiffe (Platzhalter/fehlend, gültige IMO, noch offen)" % len(targets), flush=True)
print("Übersprungen wg. ungültiger IMO: %d" % skipped_invalid, flush=True)

def num(v):
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None

filled_dwt = miss = notfound = err = 0
for i, (imo, typ) in enumerate(targets):
    if not running:
        break
    try:
        req = urllib.request.Request(ENDPOINT % (KEY, imo),
            headers={"User-Agent": "BulkWatch/1.0"})
        r = json.load(urllib.request.urlopen(req, timeout=30))
        d = r.get("data") or {}
        dwt = num(d.get("deadweight"))
        found = 1 if d else 0
        if dwt:
            sets, params = ["dwt = ?"], [int(dwt)]
            # opportunistisch echte Nebenfelder, nur wo unsere leer sind
            for col, key in (("gross_tonnage","gross_tonnage"),("year_built","year_built"),
                             ("length","length"),("beam","breadth")):
                val = num(d.get(key))
                if val:
                    sets.append("%s = CASE WHEN %s IS NULL OR %s=0 THEN ? ELSE %s END"
                                % (col, col, col, col))
                    params.append(int(val) if col in ("gross_tonnage","year_built") else val)
            params.append(imo)
            db.execute("UPDATE ships SET %s WHERE imo=?" % ", ".join(sets), params)
            filled_dwt += 1
        else:
            miss += 1  # in Datalastic, aber ohne DWT
        db.execute("INSERT OR REPLACE INTO datalastic_log VALUES (?,?,?,datetime('now'))",
                   (imo, int(dwt) if dwt else 0, found))
        db.commit()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            notfound += 1
            db.execute("INSERT OR REPLACE INTO datalastic_log VALUES (?,0,0,datetime('now'))", (imo,))
            db.commit()
        else:
            err += 1
            print("  HTTP %s bei IMO %s" % (e.code, imo), flush=True)
            if e.code in (401, 403, 429):
                print("  -> Auth/Rate-Problem, Abbruch", flush=True); break
    except Exception as e:
        err += 1
        print("  Fehler IMO %s: %s" % (imo, e), flush=True)

    if (i + 1) % 50 == 0:
        print("  [%d/%d] DWT gefüllt=%d | ohne DWT=%d | nicht gefunden=%d | Fehler=%d"
              % (i+1, len(targets), filled_dwt, miss, notfound, err), flush=True)
    time.sleep(DELAY)

print("\nFERTIG. Echtes DWT gefüllt: %d | in DB ohne DWT: %d | nicht in Datalastic: %d | Fehler: %d"
      % (filled_dwt, miss, notfound, err), flush=True)
