#!/usr/bin/env python3
"""Broker-Level Daily Vessel Valuations v3.
Power-law newbuild × exponential depreciation, per DWT class.
Optimized against 86 S&P comps. Cron: 30 19 * * *"""
import sqlite3, time, math

DB = "/opt/bulkwatch/db/ships.db"
YEAR = 2026

# ═══ Size-class parameters (A, B, rate, floor) ═══
# Newbuild = A × DWT^(1-B)
# Depreciation = max(floor, exp(-rate × (age-5))) for age > 5
SIZE_PARAMS = {
    "small":  (2100, 0.10, 0.057, 0.10),  # <10k DWT, RMSE 26.9%
    "medium": (1600, 0.10, 0.057, 0.10),  # 10-40k, RMSE 24.3%
    "large":  (14200, 0.32, 0.057, 0.10), # 40-100k, RMSE 13.5%
    "vlarge": (1100, 0.10, 0.057, 0.40),  # 100k+, RMSE 20.7%
}

# Type multipliers for non-bulk vessels
TYPE_MULT = {
    "VLCC": 1.15, "Suezmax": 1.15, "Aframax": 1.20,
    "Product Tanker": 1.30, "Chemical Tanker": 1.80, "Oil/Chemical Tanker": 1.50,
    "Crude Oil Tanker": 1.15, "Tanker": 1.20,
    "LNG Tanker": 2.50, "LPG Tanker": 1.60,
    "Container Ship": 1.10, "ULCV": 1.30, "Neo-Panamax": 1.20, "Feeder": 1.15,
    "Car Carrier": 2.00, "RoRo": 1.40, "RoPax": 1.60,
    "Cruise Ship": 3.00, "Passenger": 2.50, "Ferry": 1.50,
    "Reefer": 1.30, "Multipurpose": 1.20, "Heavy Lift": 1.50,
    "Offshore": 1.80, "OSV": 1.80, "Tug": 2.50, "Dredger": 1.50,
}

BULK_TYPES = {"General Cargo", "Bulk Carrier", "Handymax", "Handysize", "Mini-Bulker",
              "Capesize", "Newcastlemax", "Valemax", "VLOC", "Kamsarmax", "Panamax",
              "Post-Panamax", "Supramax", "Ultramax", "Gearless", "Geared"}

PREMIUM_BUILDERS = ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi",
                    "namura", "mitsubishi", "mitsui", "kawasaki", "jmu"]
DISCOUNT_BUILDERS = ["spain", "spanish", "huelva", "navantia", "astilleros",
                     "constanta", "mangalia", "gdynia", "split"]

DEFAULT_DWTS = {0, 5000, 10000, 12000, 15000, 18000, 20000, 45000, 46000, 47000, 50000, 55000}


def get_size_class(dwt):
    if dwt < 10000: return "small"
    elif dwt < 40000: return "medium"
    elif dwt < 100000: return "large"
    else: return "vlarge"


def estimate(dwt, year_built, stype, builder, status, for_year=YEAR):
    if not dwt or dwt <= 0:
        return 0

    eff_year = year_built if year_built and year_built > 1900 else for_year - 10
    age = for_year - eff_year

    # 1. Newbuild price (power-law per size class)
    sc = get_size_class(dwt)
    A, B, rate, floor = SIZE_PARAMS[sc]
    newbuild = A * (max(dwt, 500) ** (1 - B))

    # 2. Type multiplier (non-bulk types)
    if stype not in BULK_TYPES:
        tm = TYPE_MULT.get(stype, 1.0)
        newbuild *= tm

    # 3. Age depreciation (exponential with floor)
    if age < 0:
        ad = 1.10  # under construction
    elif age <= 2:
        ad = 1.05
    elif age <= 5:
        ad = 1.0
    else:
        ad = max(floor, math.exp(-rate * (age - 5)))

    # 4. Builder factor
    bf = 1.0
    if builder:
        bl = builder.lower()
        if any(p in bl for p in PREMIUM_BUILDERS): bf = 1.05
        elif any(d in bl for d in DISCOUNT_BUILDERS): bf = 0.92

    # 5. Status factor
    sf = {"scrapped": 0.20, "laid_up": 0.75, "under_construction": 1.10}.get(status, 1.0)

    # 6. Scrap value floor
    ldt_ratio = 0.20
    scrap = dwt * ldt_ratio * 480  # $480/LDT

    value = max(newbuild * ad * bf * sf, scrap)
    return round(value)


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    today = time.strftime("%Y-%m-%d")

    existing = con.execute("SELECT COUNT(*) FROM price_history WHERE date = ?", (today,)).fetchone()[0]
    if existing > 100:
        con.execute("DELETE FROM price_history WHERE date = ?", (today,))
        con.commit()

    ships = con.execute("""
        SELECT imo, name, type, dwt, year_built, builder, flag, status
        FROM ships WHERE type IS NOT NULL AND type != '' AND dwt > 0
        AND NOT (dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
                 AND (year_built IS NULL OR year_built = 0))
        AND status NOT IN ('scrapped', 'lost')
    """).fetchall()

    print(f"Valuating {len(ships)} ships for {today}...")
    inserted = 0

    for imo, name, stype, dwt, year_built, builder, flag, status in ships:
        value = estimate(dwt, year_built, stype, builder, status)
        if value > 0:
            con.execute(
                "INSERT OR REPLACE INTO price_history (imo, date, estimated_value, confidence) VALUES (?, ?, ?, 60)",
                (imo, today, value)
            )
            inserted += 1

    con.commit()
    con.close()
    print(f"Done: {inserted} valuations for {today}")


if __name__ == "__main__":
    main()
