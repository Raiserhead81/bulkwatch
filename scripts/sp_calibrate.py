#!/usr/bin/env python3
"""Recalibrate segment_bias_correction from real S&P deals — safe, verified.
Monkeypatches the live model (daily-valuations.py) in-memory, measures per-segment
est/actual ratio, refits bias factors (with shrinkage for small samples), and
re-measures. Writes model_params.json ONLY if overall median error improves.
"""
import sqlite3, importlib.util, statistics, json, copy, sys

PARAMS_FILE = "/opt/bulkwatch/db/model_params.json"
spec = importlib.util.spec_from_file_location("dv", "/opt/bulkwatch/scripts/daily-valuations.py")
dv = importlib.util.module_from_spec(spec); spec.loader.exec_module(dv)
market = dv.load_market_data()

# Haiku-Kürzel -> kanonische Segmente (fehlten in type_aliases)
NEW_ALIASES = {
    "SUPRA": "Supramax", "UMAX": "Ultramax", "KMAX": "Kamsarmax", "HANDY": "Handysize",
    "PMAX": "Panamax", "CAPE": "Capesize", "MR2": "Product Tanker", "MR1": "Product Tanker",
    "LR1": "Product Tanker", "LR2": "Aframax", "MR": "Product Tanker",
    "Tanker": "Crude Oil Tanker", "Bulker": "Bulk Carrier",
}

db = sqlite3.connect("/opt/bulkwatch/db/ships.db")
deals = db.execute("""SELECT ship_name, ship_type, dwt, year_built, sale_price_usd
    FROM sp_transactions WHERE sale_date LIKE '2026%' AND dwt>0 AND year_built>1900
    AND sale_price_usd>1e6 AND ship_type IS NOT NULL""").fetchall()

def measure():
    """Return (median_abs_err, within10, per_segment_ratios) using current dv globals."""
    errs, seg = [], {}
    for name, stype, dwt, year, price in deals:
        row = (None, name, stype, dwt, year, None, None, "active", None, None, None, None, None, 0)
        est, _ = dv.estimate(row, market)
        if est <= 0: continue
        errs.append(abs(est - price) / price)
        cs = dv.resolve_type(stype or "")
        seg.setdefault(cs, []).append(est / price)  # ratio: >1 = überschätzt
    within10 = sum(1 for e in errs if e <= .10) / len(errs)
    return statistics.median(errs), within10, seg, len(errs)

# --- Baseline (aktueller Stand) ---
base_med, base_w10, seg_ratios, n = measure()
print("VORHER:  Median-Fehler %.1f%% | ±10%% %.0f%% | n=%d" % (100*base_med, 100*base_w10, n))

# --- Aliase fixen, neu segmentieren ---
dv.TYPE_ALIASES = {**dv.TYPE_ALIASES, **NEW_ALIASES}
_, _, seg_ratios, _ = measure()  # Ratios mit korrigierten Segmenten

# --- Neue Bias-Faktoren: corr_neu = corr_alt / (median_ratio ** shrink) ---
old_bias = dict(dv.BIAS_CORRECTION)
new_bias = dict(old_bias)
print("\nSegment-Refit (n>=4):")
for s, ratios in sorted(seg_ratios.items(), key=lambda x: -len(x[1])):
    if len(ratios) < 4: continue
    R = statistics.median(ratios)              # >1 = Modell zu hoch
    shrink = min(1.0, len(ratios) / 10.0)      # kleine Samples nur teilweise korrigieren
    cur = old_bias.get(s, 1.0)
    nb = round(cur / (R ** shrink), 3)
    nb = max(0.5, min(1.8, nb))                # Sicherheitsgrenzen
    new_bias[s] = nb
    print("  %-16s n=%3d  ratio %.2f  %.3f -> %.3f" % (s, len(ratios), R, cur, nb))

# --- Mit neuen Faktoren gegentesten ---
dv.BIAS_CORRECTION = new_bias
new_med, new_w10, _, _ = measure()
print("\nNACHHER: Median-Fehler %.1f%% | ±10%% %.0f%%" % (100*new_med, 100*new_w10))
print("Delta:   Median %+.1f pp | ±10%% %+.0f pp" % (100*(new_med-base_med), 100*(new_w10-base_w10)))

# --- Nur schreiben wenn besser ---
apply = "--apply" in sys.argv
if new_med < base_med and apply:
    p = json.load(open(PARAMS_FILE))
    p["type_aliases"] = {**p.get("type_aliases", {}), **NEW_ALIASES}
    p["segment_bias_correction"] = new_bias
    json.dump(p, open(PARAMS_FILE, "w"), indent=1)
    print("\n✓ ANGEWENDET (besser). model_params.json aktualisiert.")
elif new_med < base_med:
    print("\n(besser — mit --apply schreiben)")
else:
    print("\n✗ NICHT besser — nichts geändert.")
