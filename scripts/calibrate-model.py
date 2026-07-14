#!/usr/bin/env python3
"""Model Calibrator — validates and tunes valuation model against real S&P transactions.
Outputs error metrics and suggests parameter adjustments.
Run: python3 scripts/calibrate-model.py"""

import sqlite3, math, json, sys
sys.path.insert(0, "/opt/bulkwatch")

DB = "/opt/bulkwatch/db/ships.db"

# Plausibility filter: auto-scraped S&P deals contain parse errors (enbloc/fleet prices,
# swapped columns) and placeholder dwt from enrichment. Drop implausible deals so we don't
# measure the model against garbage. Kept in sync with src/app/api/admin/stats/route.ts.
DUMMY_DWT = {5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000}

def is_plausible_deal(dwt, price, age):
    if not dwt or not price or dwt <= 0 or price <= 0 or dwt in DUMMY_DWT:
        return False
    per_dwt = price / dwt
    if per_dwt > 2500 or per_dwt < 40:        # $/dwt sanity -> kills parse errors
        return False
    if age > 30 and price > 15e6:             # old ship, absurdly expensive
        return False
    if price > 250e6:                          # above any bulker/tanker
        return False
    return True

def load_market():
    try:
        with open("/opt/bulkwatch/db/opex_rates.json") as f:
            data = json.load(f)
        return {
            "bdi": data.get("bdiIndex", 1500),
            "scrap_ldt": data.get("scrapPriceLDT", 480),
            "vlsfo": data.get("bunkerVLSFO", 550),
            "charter_rates": data.get("charterRates", {}),
        }
    except:
        return {"bdi": 1500, "scrap_ldt": 480, "vlsfo": 550, "charter_rates": {}}

def main():
    con = sqlite3.connect(DB)
    market = load_market()
    
    # Load valuation module
    import importlib.util
    spec = importlib.util.spec_from_file_location("val", "/opt/bulkwatch/scripts/daily-valuations.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    
    # Get all transactions with enough data
    txs = con.execute("""
        SELECT ship_name, imo, ship_type, dwt, year_built, sale_price_usd, sale_date
        FROM sp_transactions
        WHERE dwt > 0 AND year_built > 1970 AND sale_price_usd > 0
        AND ship_type IS NOT NULL
    """).fetchall()
    
    print(f"Calibrating against {len(txs)} transactions...\n")
    
    errors_by_type = {}
    all_errors = []
    
    print(f"{'Ship':25} {'Type':15} {'DWT':>8} {'Age':>4} {'Real':>10} {'Model':>10} {'Err':>7}")
    print("-" * 90)
    
    skipped = 0
    for name, imo, stype, dwt, yb, real_price, sale_date in txs:
        if not is_plausible_deal(dwt, real_price, 2026 - (yb or 2016)):
            skipped += 1
            continue
        row = (imo, name, stype, dwt, yb, None, "PA", "active")
        market_data = mod.load_market_data()
        result = mod.estimate(row, market_data)
        model_val = result[0] if isinstance(result, tuple) else result
        
        if model_val <= 0:
            continue
        
        err_pct = ((model_val - real_price) / real_price) * 100
        abs_err = abs(err_pct)
        all_errors.append(abs_err)
        
        if stype not in errors_by_type:
            errors_by_type[stype] = []
        errors_by_type[stype].append(err_pct)
        
        age = 2026 - yb
        marker = "!!" if abs_err > 25 else "!" if abs_err > 15 else ""
        print(f"{name:25} {stype:15} {dwt:>8,} {age:>4} ${real_price/1e6:>8.1f}M ${model_val/1e6:>8.1f}M {err_pct:>+6.0f}% {marker}")
    
    print("\n" + "=" * 90)
    print("OVERALL METRICS")
    print(f"  Transactions: {len(all_errors)}  (skipped as implausible: {skipped})")
    print(f"  Mean abs error:   {sum(all_errors)/len(all_errors):.1f}%")
    print(f"  Median abs error: {sorted(all_errors)[len(all_errors)//2]:.1f}%")
    w10 = sum(1 for e in all_errors if e <= 10)
    w15 = sum(1 for e in all_errors if e <= 15)
    w20 = sum(1 for e in all_errors if e <= 20)
    print(f"  Within ±10%: {w10}/{len(all_errors)} ({w10*100//len(all_errors)}%)")
    print(f"  Within ±15%: {w15}/{len(all_errors)} ({w15*100//len(all_errors)}%)")
    print(f"  Within ±20%: {w20}/{len(all_errors)} ({w20*100//len(all_errors)}%)")
    
    # Bias analysis
    positive = sum(1 for t in errors_by_type.values() for e in t if e > 0)
    negative = len(all_errors) - positive
    avg_signed = sum(e for t in errors_by_type.values() for e in t) / len(all_errors)
    print(f"  Bias: {avg_signed:+.1f}% (positive=overvalues, negative=undervalues)")
    print(f"  Over/Under: {positive} over, {negative} under")
    
    print("\nBY SEGMENT")
    for stype in sorted(errors_by_type, key=lambda t: -len(errors_by_type[t])):
        errs = errors_by_type[stype]
        avg = sum(errs) / len(errs)
        avg_abs = sum(abs(e) for e in errs) / len(errs)
        print(f"  {stype:20} n={len(errs):2}  bias={avg:>+6.1f}%  |err|={avg_abs:>5.1f}%")
    
    con.close()

if __name__ == "__main__":
    main()
