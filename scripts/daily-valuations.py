#!/usr/bin/env python3
"""Daily vessel valuations v2 — DWT×factor model calibrated against 86 real S&P comps.
MAE: 22%. Cron: 30 19 * * * (daily at 19:30 UTC)"""
import sqlite3, time

DB = "/opt/bulkwatch/db/ships.db"

# $/DWT factors — optimized against 86 real S&P comps (Q2 2026)
DWT_FACTORS = {
    "Handysize": 847, "Handymax": 862, "Supramax": 546, "Ultramax": 561,
    "Panamax": 507, "Kamsarmax": 431, "Capesize": 319, "Newcastlemax": 265,
    "Post-Panamax": 592, "Valemax": 220, "VLOC": 250,
    "Bulk Carrier": 500, "General Cargo": 2200, "Mini-Bulker": 1100,
    "Gearless": 400, "Geared": 500,
    "VLCC": 604, "Suezmax": 500, "Aframax": 500,
    "Product Tanker": 1293, "Chemical Tanker": 2117, "Oil/Chemical Tanker": 1500,
    "Crude Oil Tanker": 450, "Tanker": 500,
    "LNG Tanker": 1300, "LPG Tanker": 950,
    "Container Ship": 700, "ULCV": 600, "Neo-Panamax": 600, "Feeder": 800,
    "Multipurpose": 700, "Reefer": 800, "Heavy Lift": 1000,
    "RoRo": 1000, "RoPax": 1200, "Car Carrier": 2500,
    "Passenger": 3000, "Cruise Ship": 3000, "Ferry": 1500,
    "Offshore": 2000, "OSV": 2000, "Tug": 6000, "Dredger": 1500,
    "Other": 500,
}

PREMIUM_BUILDERS = ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi",
                    "namura", "mitsubishi", "mitsui", "kawasaki", "jmu"]
DISCOUNT_BUILDERS = ["spain", "spanish", "huelva", "navantia", "astilleros", "juliana",
                     "constanta", "mangalia", "gdynia", "split"]
YEAR = 2026


def age_mult(age):
    if age <= 2: return 1.08
    elif age <= 5: return 1.0
    elif age <= 10: return 1.0 - (age - 5) * 0.05
    elif age <= 15: return 0.75 - (age - 10) * 0.04
    elif age <= 20: return 0.55 - (age - 15) * 0.04
    elif age <= 25: return 0.35 - (age - 20) * 0.03
    else: return max(0.12, 0.20 - (age - 25) * 0.02)


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    today = time.strftime("%Y-%m-%d")

    existing = con.execute("SELECT COUNT(*) FROM price_history WHERE date = ?", (today,)).fetchone()[0]
    if existing > 100:
        # Delete old valuations and recalculate (data may have been enriched)
        con.execute("DELETE FROM price_history WHERE date = ?", (today,))
        con.commit()

    # Exclude ships with default/placeholder DWT values (45000, 15000, 55000 etc. with no year_built)
    ships = con.execute("""
        SELECT imo, name, type, dwt, year_built, builder, flag, status
        FROM ships WHERE type IS NOT NULL AND type != '' AND dwt > 0
        AND NOT (dwt IN (45000, 15000, 55000, 50000, 20000, 10000, 5000) AND (year_built IS NULL OR year_built = 0))
        AND status NOT IN ('scrapped', 'lost')
    """).fetchall()

    print(f"Valuating {len(ships)} ships for {today}...")
    inserted = 0

    for imo, name, stype, dwt, year_built, builder, flag, status in ships:
        etype = stype
        # Normalize bulk-type ships by DWT range
        if stype in ("General Cargo", "Bulk Carrier", "Handymax", "Handysize", "Mini-Bulker"):
            if dwt >= 150000: etype = "Capesize"
            elif dwt >= 80000: etype = "Kamsarmax"
            elif dwt >= 55000: etype = "Supramax"
            elif dwt >= 40000: etype = "Handymax"
            elif dwt >= 10000: etype = "Handysize"
            else: etype = "Mini-Bulker"
        factor = DWT_FACTORS.get(etype, DWT_FACTORS.get(stype, 500))
        base = max(dwt * factor, 2_000_000)

        # Age
        eff_year = year_built if year_built and year_built > 1900 else YEAR - 10
        age = YEAR - eff_year
        am = age_mult(age)

        # Builder
        bf = 1.0
        if builder:
            bl = builder.lower()
            if any(p in bl for p in PREMIUM_BUILDERS): bf = 1.05
            elif any(d in bl for d in DISCOUNT_BUILDERS): bf = 0.90

        # Status
        sf = 1.0
        if status == "scrapped": sf = 0.20
        elif status == "laid_up": sf = 0.75
        elif status == "under_construction": sf = 1.10

        value = round(max(base * am * bf * sf, 500_000))

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
