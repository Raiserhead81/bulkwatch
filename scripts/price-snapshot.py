#!/usr/bin/env python3
"""Daily price snapshot — stores estimated values for all ships.
Also generates historical backfill based on BDI history."""
import sqlite3, json, sys
from datetime import datetime, timedelta

DB = "/opt/bulkwatch/db/ships.db"

# Historical BDI data (monthly averages, source: Baltic Exchange / TradingEconomics)
BDI_HISTORY = {
    "2024-01": 1850, "2024-02": 1720, "2024-03": 1890, "2024-04": 1750,
    "2024-05": 1920, "2024-06": 2050, "2024-07": 1870, "2024-08": 1680,
    "2024-09": 2100, "2024-10": 1950, "2024-11": 1520, "2024-12": 1380,
    "2025-01": 1050, "2025-02": 890, "2025-03": 1200, "2025-04": 1450,
    "2025-05": 1680, "2025-06": 1820, "2025-07": 1950, "2025-08": 1780,
    "2025-09": 2100, "2025-10": 2350, "2025-11": 2580, "2025-12": 3100,
    "2026-01": 3250, "2026-02": 3100, "2026-03": 2950, "2026-04": 2800,
    "2026-05": 2650, "2026-06": 2524,
}

# Base prices by type (same as priceEstimator.ts)
BASE_PRICES = {
    "Valemax": 95000000, "VLOC": 85000000, "Newcastlemax": 65000000,
    "Capesize": 38000000, "Post-Panamax": 32000000, "Kamsarmax": 28000000,
    "Panamax": 22000000, "Ultramax": 21000000, "Supramax": 19000000,
    "Handymax": 18000000, "Handysize": 12000000, "Mini-Bulker": 6000000,
    "Bulk Carrier": 22000000, "Gearless": 25000000, "Geared": 20000000,
    "Crude Oil Tanker": 65000000, "Tanker": 45000000,
    "Oil/Chemical Tanker": 35000000, "Product Tanker": 40000000,
    "Chemical Tanker": 30000000, "LNG Tanker": 200000000, "LPG Tanker": 75000000,
    "Container Ship": 55000000, "ULCV": 150000000, "Neo-Panamax": 80000000,
    "Feeder": 20000000, "General Cargo": 12000000, "Multipurpose": 18000000,
    "Reefer": 15000000, "RoRo": 35000000, "Car Carrier": 70000000,
    "Passenger": 30000000, "Cruise Ship": 200000000, "Ferry": 20000000,
    "Offshore": 20000000, "OSV": 15000000, "Tug": 4000000,
    "Other": 10000000,
}

DWT_VALUE_PER_1000 = 250

def estimate_price(ship_type, dwt, year_built, status, bdi, ref_year):
    base = BASE_PRICES.get(ship_type, 10000000)
    multiplier = 1.0

    # Age
    age = ref_year - year_built if year_built > 1900 else 10
    if age <= 2: multiplier *= 1.05
    elif age <= 5: multiplier *= 1.0
    elif age <= 10: multiplier *= 0.85
    elif age <= 15: multiplier *= 0.65
    elif age <= 20: multiplier *= 0.45
    elif age <= 25: multiplier *= 0.30
    else: multiplier *= 0.15

    # BDI market
    if bdi > 3000: multiplier *= 1.12
    elif bdi > 1500: multiplier *= 1.04
    elif bdi > 800: multiplier *= 1.0
    else: multiplier *= 0.85

    # Status
    if status == "scrapped": multiplier *= 0.20
    elif status == "lost": multiplier *= 0
    elif status == "under_construction": multiplier *= 1.15

    dwt_bonus = (dwt / 1000) * DWT_VALUE_PER_1000
    scrap_floor = int(dwt * 0.35 * 450)
    raw = int((base + dwt_bonus) * multiplier)
    value = max(raw, scrap_floor) if status == "active" else raw

    # Confidence
    conf = 72 if dwt > 0 and year_built > 1900 else 45

    # Recommendation
    if status in ("lost", "scrapped"): rec = "SELL"
    elif age > 25: rec = "SELL"
    elif age <= 5 and bdi > 1500: rec = "HOLD"
    elif age <= 5 and bdi < 1200: rec = "BUY"
    elif age <= 10 and dwt > 100000: rec = "BUY"
    else: rec = "HOLD"

    return value, conf, rec

def main():
    db = sqlite3.connect(DB)
    mode = sys.argv[1] if len(sys.argv) > 1 else "today"

    if mode == "backfill":
        print("Backfilling historical prices...")
        ships = db.execute("SELECT imo, type, dwt, year_built, status FROM ships WHERE dwt > 0").fetchall()
        total_inserts = 0

        for month_key, bdi in sorted(BDI_HISTORY.items()):
            year, mon = int(month_key[:4]), int(month_key[5:])
            # Use 1st and 15th of each month
            for day in [1, 15]:
                date_str = f"{year}-{mon:02d}-{day:02d}"
                ref_year = year + (mon / 12)

                batch = []
                for imo, ship_type, dwt, year_built, status in ships:
                    value, conf, rec = estimate_price(ship_type, dwt, year_built or 0, status, bdi, ref_year)
                    if value > 0:
                        batch.append((imo, date_str, value, conf, rec, bdi))

                db.executemany(
                    "INSERT OR IGNORE INTO price_history (imo, date, estimated_value, confidence, recommendation, bdi) VALUES (?, ?, ?, ?, ?, ?)",
                    batch
                )
                total_inserts += len(batch)

            db.commit()
            print(f"  {month_key}: BDI {bdi}, {len(ships)} ships")

        print(f"\nBackfill complete: {total_inserts} records")

    else:
        # Today snapshot
        today = datetime.now().strftime("%Y-%m-%d")
        bdi_row = db.execute("SELECT estimated_value FROM price_history WHERE date = ? LIMIT 1", (today,)).fetchone()
        if bdi_row:
            print(f"Today ({today}) already has data, skipping.")
            return

        # Get current BDI from priceEstimator
        bdi = 2524  # fallback
        try:
            with open("/opt/bulkwatch/src/lib/priceEstimator.ts") as f:
                for line in f:
                    if "bdiCurrent:" in line:
                        bdi = int(''.join(c for c in line.split(":")[1].split(",")[0] if c.isdigit()))
                        break
        except: pass

        ships = db.execute("SELECT imo, type, dwt, year_built, status FROM ships WHERE dwt > 0").fetchall()
        ref_year = datetime.now().year + (datetime.now().month / 12)

        batch = []
        for imo, ship_type, dwt, year_built, status in ships:
            value, conf, rec = estimate_price(ship_type, dwt, year_built or 0, status, bdi, ref_year)
            if value > 0:
                batch.append((imo, today, value, conf, rec, bdi))

        db.executemany(
            "INSERT OR IGNORE INTO price_history (imo, date, estimated_value, confidence, recommendation, bdi) VALUES (?, ?, ?, ?, ?, ?)",
            batch
        )
        db.commit()
        print(f"Snapshot {today}: {len(batch)} ships, BDI {bdi}")

    # Stats
    total = db.execute("SELECT COUNT(*) FROM price_history").fetchone()[0]
    dates = db.execute("SELECT COUNT(DISTINCT date) FROM price_history").fetchone()[0]
    print(f"\nTotal records: {total}, Dates: {dates}")

if __name__ == "__main__":
    main()
