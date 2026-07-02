#!/usr/bin/env python3
"""Scrubber Tagger — marks known scrubber-fitted vessels.
Sources: operator fleet data, fuel type hints, known scrubber orders.
Run periodically to update has_scrubber field."""

import sqlite3

DB = "/opt/bulkwatch/db/ships.db"

# Operators known to have fleet-wide or majority scrubber installations
# Source: company reports, fleet specifications, maritime press
SCRUBBER_OPERATORS = {
    # Major scrubber adopters (>50% of fleet)
    "Star Bulk": "open",
    "Scorpio Bulkers": "open", "Scorpio Tankers": "open",
    "Golden Ocean": "open",
    "Diana Shipping": "open",
    "Genco Shipping": "open",
    "Eagle Bulk": "open",
    "Oldendorff": "open",
    "Frontline": "open",
    "DHT Holdings": "open",
    "Euronav": "open",
    "International Seaways": "open",
    "Teekay Tankers": "open",
    "Hafnia": "open",
    "BW Group": "hybrid",
    "MSC": "hybrid",
    "CMA CGM": "hybrid",
    "Evergreen": "open",
    "Pan Ocean": "open",
    "K Line": "hybrid",
    "NYK": "hybrid",
    "MOL": "hybrid",
    "Torm": "open",
    "Norden": "open",
    "Pacific Basin": "open",
    "Safe Bulkers": "open",
    "Navios": "open",
    "Stena Bulk": "closed",
    "Berge Bulk": "open",
}

# Ships built after 2019 with high fuel consumption likely have scrubbers
# (cheaper to install during newbuild)
# Ships with fuel_type containing "HSFO" or "IFO 380" AND built after 2018 = scrubber
# Ships with fuel_type = "VLSFO 0.5%S" only = no scrubber

def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    
    tagged = 0
    
    # 1. Tag by operator
    for operator, scrub_type in SCRUBBER_OPERATORS.items():
        result = con.execute(
            "UPDATE ships SET has_scrubber = 1, scrubber_type = ? "
            "WHERE (operator LIKE ? OR ism_manager LIKE ? OR owner LIKE ?) "
            "AND has_scrubber IS NULL AND year_built >= 2015 AND dwt > 10000",
            (scrub_type, f"%{operator}%", f"%{operator}%", f"%{operator}%")
        )
        if result.rowcount > 0:
            tagged += result.rowcount
            print(f"  {operator}: {result.rowcount} ships tagged ({scrub_type})")
    
    # 2. Large ships (>50k DWT) built 2019-2022 = high probability of scrubber
    # This was the peak scrubber installation period
    result = con.execute(
        "UPDATE ships SET has_scrubber = 1, scrubber_type = 'open' "
        "WHERE has_scrubber IS NULL AND dwt > 50000 "
        "AND year_built BETWEEN 2019 AND 2022 "
        "AND type IN ('Capesize','Newcastlemax','VLCC','Suezmax','Aframax')"
    )
    if result.rowcount > 0:
        tagged += result.rowcount
        print(f"  Large 2019-2022 newbuilds: {result.rowcount} tagged")
    
    # 3. Ships with LNG/dual fuel = no scrubber needed
    result = con.execute(
        "UPDATE ships SET has_scrubber = 0 "
        "WHERE has_scrubber IS NULL "
        "AND (fuel_type LIKE '%LNG%' OR fuel_type LIKE '%dual%' OR fuel_type LIKE '%methanol%')"
    )
    if result.rowcount > 0:
        tagged += result.rowcount
        print(f"  LNG/dual fuel (no scrubber): {result.rowcount} tagged")
    
    # 4. Small ships (<10k DWT) = rarely have scrubbers (not economical)
    result = con.execute(
        "UPDATE ships SET has_scrubber = 0 "
        "WHERE has_scrubber IS NULL AND dwt > 0 AND dwt < 10000 AND year_built > 0"
    )
    if result.rowcount > 0:
        tagged += result.rowcount
        print(f"  Small ships <10k (no scrubber): {result.rowcount} tagged")
    
    con.commit()
    
    # Stats
    total = con.execute("SELECT COUNT(*) FROM ships WHERE dwt > 0").fetchone()[0]
    has = con.execute("SELECT COUNT(*) FROM ships WHERE has_scrubber = 1").fetchone()[0]
    no = con.execute("SELECT COUNT(*) FROM ships WHERE has_scrubber = 0").fetchone()[0]
    unknown = con.execute("SELECT COUNT(*) FROM ships WHERE has_scrubber IS NULL AND dwt > 0").fetchone()[0]
    
    print(f"\nScrubber status: {has} yes, {no} no, {unknown} unknown (of {total} ships)")
    print(f"Tagged this run: {tagged}")
    
    con.close()

if __name__ == "__main__":
    main()
