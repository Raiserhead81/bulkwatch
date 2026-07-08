#!/usr/bin/env python3
"""Measure current valuation model accuracy against real S&P deal prices.
Non-destructive — only reads. Uses the RECENT deals (2026) so today's market
factor roughly applies. Reports median abs error, hit rates, and per-segment bias."""
import sqlite3, importlib.util, statistics

# echte Modell-Logik aus daily-valuations.py laden
spec = importlib.util.spec_from_file_location("dv", "/opt/bulkwatch/scripts/daily-valuations.py")
dv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dv)
market = dv.load_market_data()

db = sqlite3.connect("/opt/bulkwatch/db/ships.db")
# nur aktuelle Deals (2026) mit brauchbaren Feldern
rows = db.execute("""SELECT ship_name, ship_type, dwt, year_built, sale_price_usd, sale_date
    FROM sp_transactions
    WHERE sale_date LIKE '2026%' AND dwt>0 AND year_built>1900 AND sale_price_usd>1e6
    AND ship_type IS NOT NULL""").fetchall()

results = []
for name, stype, dwt, year, price, date in rows:
    ship_row = (None, name, stype, dwt, year, None, None, "active", None, None, None, None, None, 0)
    est, conf = dv.estimate(ship_row, market)
    if est <= 0:
        continue
    err = (est - price) / price          # +überschätzt / -unterschätzt
    results.append((stype, dwt, year, price, est, err))

n = len(results)
abserr = [abs(e[5]) for e in results]
bias = [e[5] for e in results]
print("=== Modell-Genauigkeit gegen %d echte Deals (2026) ===" % n)
print("  Median abs. Fehler: %.1f%%" % (100 * statistics.median(abserr)))
print("  Mittlerer Bias:     %+.1f%% (>0 = Modell überschätzt)" % (100 * statistics.mean(bias)))
print("  innerhalb ±10%%:     %.0f%%" % (100 * sum(1 for e in abserr if e <= .10) / n))
print("  innerhalb ±20%%:     %.0f%%" % (100 * sum(1 for e in abserr if e <= .20) / n))
print()
# Bias pro Segment (wo systematisch daneben?)
from collections import defaultdict
seg = defaultdict(list)
for stype, dwt, year, price, est, err in results:
    seg[dv.resolve_type(stype or "")].append(err)
print("=== Bias pro Segment (n>=4) ===")
for s, errs in sorted(seg.items(), key=lambda x: -len(x[1])):
    if len(errs) >= 4:
        print("  %-16s n=%3d  Bias %+6.1f%%  Median|err| %5.1f%%" % (
            s, len(errs), 100*statistics.mean(errs), 100*statistics.median([abs(x) for x in errs])))
