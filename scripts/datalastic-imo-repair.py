#!/usr/bin/env python3
"""Repair corrupt IMO numbers (bad check digit) from the Wikidata import.

For each ship whose IMO fails the check-digit test, search Datalastic by
NAME, and if a confident match is found (name matches, valid IMO), record
the correct IMO + real DWT/GT/year/dims.

SAFETY:
  - Default is DRY-RUN (prints proposals, writes nothing). Pass --apply to write.
  - IMO is a primary key referenced by price_history/datalastic_log. On apply,
    a collision (correct IMO already exists as another ship) is SKIPPED and
    reported — never auto-merged/deleted.
  - On apply, price_history rows are migrated old-IMO -> new-IMO.
  - Requires a name match (normalized) to avoid wrong-ship corrections.
"""
import sqlite3, urllib.request, urllib.parse, json, time, sys, re

DB = "/opt/bulkwatch/db/ships.db"
KEY = open("/opt/bulkwatch/config/datalastic-key.txt").read().strip()
APPLY = "--apply" in sys.argv
DELAY = 0.3
FIND = "https://api.datalastic.com/api/v0/vessel_find?api-key=%s&name=%s"

def imo_valid(s):
    return bool(s and str(s).isdigit() and len(str(s)) == 7
                and sum(int(str(s)[i]) * (7 - i) for i in range(6)) % 10 == int(str(s)[6]))

def norm(n):
    return re.sub(r"[^a-z0-9]", "", (n or "").lower())

def num(v):
    try:
        f = float(v); return f if f > 0 else None
    except (TypeError, ValueError):
        return None

db = sqlite3.connect(DB)
rows = db.execute("SELECT imo, name, type, dwt, mmsi FROM ships WHERE imo GLOB '[0-9]*'").fetchall()
corrupt = [r for r in rows if not imo_valid(r[0]) and r[1]]
print("Korrupte IMOs mit Namen:", len(corrupt), "| Modus:", "APPLY" if APPLY else "DRY-RUN")

existing_imos = {r[0] for r in rows}
fixed = collision = nomatch = err = 0
for old_imo, name, typ, dwt, mmsi in corrupt:
    try:
        r = json.load(urllib.request.urlopen(
            FIND % (KEY, urllib.parse.quote(name)),
            timeout=25))
        cands = r.get("data") or []
        if isinstance(cands, dict):
            cands = cands.get("vessels", [])
        # bester Treffer: Name normalisiert gleich, gültige IMO; MMSI-Bonus
        match = None
        for c in cands:
            if norm(c.get("name")) == norm(name) and imo_valid(str(c.get("imo") or "")):
                if mmsi and str(c.get("mmsi") or "") == str(mmsi):
                    match = c; break        # starker Treffer (Name+MMSI)
                if match is None:
                    match = c               # Name-Treffer als Fallback
        if not match:
            nomatch += 1
            print("  KEIN Treffer: %-18s (alt %s)" % (name[:18], old_imo))
        else:
            new_imo = str(match["imo"])
            new_dwt = num(match.get("deadweight"))
            tag = "Name+MMSI" if (mmsi and str(match.get("mmsi") or "")==str(mmsi)) else "Name"
            if new_imo in existing_imos:
                collision += 1
                print("  KOLLISION: %-18s %s -> %s (existiert schon) [%s]"
                      % (name[:18], old_imo, new_imo, tag))
            elif tag != "Name+MMSI":
                # Name-only match is risky (could be a different ship with same
                # name) — never auto-apply; report for manual review.
                nomatch += 1
                print("  UNSICHER (nur Name, kein MMSI): %-18s %s -> %s  DWT=%s — übersprungen"
                      % (name[:18], old_imo, new_imo, new_dwt))
            else:
                print("  FIX: %-18s %s -> %s  DWT=%s  [%s]"
                      % (name[:18], old_imo, new_imo, new_dwt, tag))
                if APPLY:
                    sets, params = ["imo = ?"], [new_imo]
                    if new_dwt: sets.append("dwt = ?"); params.append(int(new_dwt))
                    for col, k in (("gross_tonnage","gross_tonnage"),("year_built","year_built"),
                                   ("length","length"),("beam","breadth")):
                        v = num(match.get(k))
                        if v:
                            sets.append("%s = CASE WHEN %s IS NULL OR %s=0 THEN ? ELSE %s END" % (col,col,col,col))
                            params.append(int(v) if col in ("gross_tonnage","year_built") else v)
                    params.append(old_imo)
                    db.execute("UPDATE ships SET %s WHERE imo=?" % ", ".join(sets), params)
                    db.execute("UPDATE price_history SET imo=? WHERE imo=?", (new_imo, old_imo))
                    db.commit()
                    existing_imos.discard(old_imo); existing_imos.add(new_imo)
                fixed += 1
    except urllib.error.HTTPError as e:
        err += 1; print("  HTTP %s bei %s" % (e.code, name[:18]))
    except Exception as e:
        err += 1; print("  Fehler %s: %s" % (name[:18], e))
    time.sleep(DELAY)

print("\n%s: fixbar=%d | Kollision=%d | kein Treffer=%d | Fehler=%d"
      % ("ANGEWENDET" if APPLY else "VORSCHLAG", fixed, collision, nomatch, err))
if not APPLY and fixed:
    print("-> Zum Anwenden: python3 scripts/datalastic-imo-repair.py --apply")
