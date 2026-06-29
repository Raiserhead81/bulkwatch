#!/usr/bin/env python3
"""Daily vessel valuations — runs the estimator for all ships and stores in price_history.
Cron: 0 19 * * * (daily at 19:00 UTC, after commodity/BDI updates)"""
import sqlite3, json, subprocess, time

DB = "/opt/bulkwatch/db/ships.db"

def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    today = time.strftime("%Y-%m-%d")

    # Check if already run today
    existing = con.execute("SELECT COUNT(*) FROM price_history WHERE date = ?", (today,)).fetchone()[0]
    if existing > 100:
        print(f"Already {existing} valuations for {today}, skipping.")
        return

    # Get current BDI for market factor
    try:
        bdi_row = con.execute("SELECT value FROM commodities WHERE name = 'BDI' ORDER BY date DESC LIMIT 1").fetchone()
        bdi = bdi_row[0] if bdi_row else 2490
    except:
        bdi = 2490

    # Get all ships with enough data for valuation
    ships = con.execute("""
        SELECT imo, name, type, dwt, year_built, builder, flag, status, length, beam
        FROM ships
        WHERE type IS NOT NULL AND type != '' AND dwt > 0
    """).fetchall()

    print(f"Valuating {len(ships)} ships for {today} (BDI: {bdi})...")

    # Use the Node.js estimator via a batch API call
    # Build a simple estimation in Python mirroring the TS logic
    BASE_PRICES = {
        "Valemax": 95e6, "VLOC": 85e6, "Newcastlemax": 72e6, "Capesize": 52e6,
        "Post-Panamax": 35e6, "Kamsarmax": 32e6, "Panamax": 25e6, "Ultramax": 28e6,
        "Supramax": 22e6, "Handymax": 18e6, "Handysize": 15e6, "Mini-Bulker": 5e6,
        "Bulk Carrier": 20e6, "Gearless": 28e6, "Geared": 22e6,
        "Crude Oil Tanker": 70e6, "Tanker": 45e6, "Oil/Chemical Tanker": 35e6,
        "Product Tanker": 42e6, "Chemical Tanker": 32e6, "LNG Tanker": 220e6,
        "LPG Tanker": 80e6, "VLCC": 110e6, "Suezmax": 70e6, "Aframax": 55e6,
        "Container Ship": 40e6, "ULCV": 160e6, "Neo-Panamax": 90e6, "Feeder": 18e6,
        "General Cargo": 8e6, "Multipurpose": 16e6, "Reefer": 12e6, "Heavy Lift": 40e6,
        "RoRo": 30e6, "RoPax": 45e6, "Car Carrier": 65e6,
        "Passenger": 25e6, "Cruise Ship": 180e6, "Ferry": 18e6,
        "Offshore": 18e6, "OSV": 12e6, "Tug": 3e6, "Dredger": 22e6,
        "Other": 8e6,
    }
    DWT_PER_1000 = 85
    YEAR = 2026

    # Premium/discount builder keywords
    PREMIUM_BUILDERS = ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi", "namura", "mitsubishi", "mitsui", "kawasaki", "jmu"]
    DISCOUNT_BUILDERS = ["spain", "spanish", "huelva", "navantia", "astilleros", "juliana", "constanta", "mangalia", "gdynia", "split"]

    inserted = 0
    for imo, name, stype, dwt, year_built, builder, flag, status, length, beam in ships:
        base = BASE_PRICES.get(stype, BASE_PRICES.get("Other", 8e6))

        # DWT-adjusted base price (same as TS estimator)
        if dwt and dwt > 0:
            dwt_base = dwt * 350
            dwt_estimate = max(dwt_base, base)
            base = base * 0.4 + dwt_estimate * 0.6

        # Age multiplier
        effective_year = year_built if year_built and year_built > 1900 else YEAR - 10
        age = YEAR - effective_year
        if age <= 2: am = 1.08
        elif age <= 5: am = 1.0
        elif age <= 10: am = 1.0 - (age - 5) * 0.05
        elif age <= 15: am = 0.75 - (age - 10) * 0.04
        elif age <= 20: am = 0.55 - (age - 15) * 0.04
        elif age <= 25: am = 0.35 - (age - 20) * 0.03
        else: am = max(0.12, 0.20 - (age - 25) * 0.02)

        # DWT bonus (already in base)
        dwt_bonus = 0

        # Builder factor
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

        value = (base * am + dwt_bonus) * bf * sf
        value = max(value, 500_000)  # minimum scrap value
        value = round(value)

        con.execute(
            "INSERT OR REPLACE INTO price_history (imo, date, estimated_value, confidence) VALUES (?, ?, ?, 60)",
            (imo, today, value)
        )
        inserted += 1

    con.commit()
    con.close()
    print(f"Done: {inserted} valuations saved for {today}")

if __name__ == "__main__":
    main()
