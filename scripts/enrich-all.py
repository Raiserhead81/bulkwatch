#!/usr/bin/env python3
"""Enrich ALL ships with estimated specs based on type."""
import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Average DWT by type (industry averages)
TYPE_DWT = {
    "Valemax": 400000, "VLOC": 300000, "Newcastlemax": 210000,
    "Capesize": 180000, "Post-Panamax": 100000,
    "Kamsarmax": 82000, "Panamax": 75000,
    "Ultramax": 64000, "Supramax": 58000,
    "Handymax": 45000, "Handysize": 35000, "Mini-Bulker": 12000,
    "Gearless": 75000, "Geared": 55000, "Bulk Carrier": 55000,
    "Crude Oil Tanker": 150000, "Tanker": 80000,
    "Oil/Chemical Tanker": 40000, "Product Tanker": 50000,
    "Chemical Tanker": 25000, "LNG Tanker": 174000, "LPG Tanker": 84000,
    "Container Ship": 50000, "ULCV": 230000, "Neo-Panamax": 150000, "Feeder": 15000,
    "General Cargo": 15000, "Multipurpose": 20000,
    "RoRo": 20000, "Car Carrier": 18000,
    "Passenger": 5000, "Cruise Ship": 50000, "Ferry": 3000,
    "Reefer": 12000, "Offshore": 5000, "Tug": 500, "OSV": 4000,
    "Other": 10000,
}

# Type-specific specs
TYPE_SPECS = {
    "Valemax":       (14.5, 65, "MAN B&W 7S80ME-C9", 0.45, 0.50, 25),
    "VLOC":          (14.5, 60, "MAN B&W 7S80ME-C9", 0.45, 0.50, 25),
    "Newcastlemax":  (14.5, 55, "MAN B&W 6S80ME-C9", 0.42, 0.50, 24),
    "Capesize":      (14.0, 45, "MAN B&W 6S70ME-C8", 0.40, 0.52, 23),
    "Post-Panamax":  (14.0, 38, "MAN B&W 6S60ME-C8", 0.38, 0.52, 22),
    "Kamsarmax":     (14.0, 32, "MAN B&W 6S50ME-C8", 0.36, 0.53, 22),
    "Panamax":       (14.0, 30, "MAN B&W 6S50ME-C8", 0.35, 0.53, 22),
    "Ultramax":      (14.0, 28, "MAN B&W 6S50ME-B9", 0.34, 0.54, 21),
    "Supramax":      (14.0, 27, "MAN B&W 6S50ME-B9", 0.33, 0.55, 21),
    "Handymax":      (13.5, 25, "MAN B&W 6S46ME-B8", 0.32, 0.55, 20),
    "Handysize":     (13.0, 20, "MAN B&W 5S46ME-B8", 0.30, 0.56, 19),
    "Mini-Bulker":   (12.0, 12, "MAN B&W 5S35ME-B9", 0.28, 0.58, 15),
    "Gearless":      (14.0, 32, "MAN B&W 6S50ME-C8", 0.36, 0.53, 22),
    "Geared":        (13.5, 28, "MAN B&W 6S46ME-B8", 0.34, 0.54, 21),
    "Bulk Carrier":  (13.5, 28, "MAN B&W 6S50ME", 0.34, 0.54, 21),
    "Crude Oil Tanker": (15.0, 55, "MAN B&W 6S70ME-C8", 0.38, 0.55, 28),
    "Tanker":           (14.5, 40, "MAN B&W 6S60ME-C8", 0.36, 0.55, 25),
    "Oil/Chemical Tanker": (14.0, 35, "MAN B&W 6S50ME-C8", 0.34, 0.56, 24),
    "Product Tanker":   (14.5, 30, "MAN B&W 6S50ME-B9", 0.35, 0.56, 23),
    "Chemical Tanker":  (14.0, 28, "MAN B&W 6S46ME-B8", 0.33, 0.57, 22),
    "LNG Tanker":       (19.5, 130, "Winterthur DFDE / ME-GI", 0.55, 0.65, 30),
    "LPG Tanker":       (16.5, 45, "MAN B&W 6G60ME-C9", 0.42, 0.60, 26),
    "Container Ship":   (18.0, 80, "MAN B&W 8S80ME-C9", 0.55, 0.70, 24),
    "ULCV":             (22.0, 200, "MAN B&W 12S90ME-C10", 0.60, 0.72, 26),
    "Neo-Panamax":      (21.0, 150, "MAN B&W 11S90ME-C10", 0.58, 0.71, 25),
    "Feeder":           (16.0, 35, "MAN B&W 6S50ME-C8", 0.45, 0.68, 18),
    "General Cargo":    (13.0, 18, "MAN B&W 5S42ME-B9", 0.30, 0.60, 18),
    "Multipurpose":     (14.0, 22, "MAN B&W 6S46ME-B8", 0.32, 0.58, 20),
    "RoRo":             (18.0, 60, "MAN B&W 8S60ME-C8", 0.50, 0.55, 24),
    "Car Carrier":      (19.0, 55, "MAN B&W 7S60ME-C8", 0.48, 0.30, 25),
    "Passenger":        (16.0, 40, "Waertsila 12V46F", 0.45, 0.85, 80),
    "Cruise Ship":      (21.0, 250, "Waertsila 14V46F + ABB Azipod", 0.60, 0.90, 1200),
    "Ferry":            (18.0, 35, "Waertsila 8L46F", 0.50, 0.80, 40),
    "Reefer":           (20.0, 45, "MAN B&W 6S60ME-C8", 0.50, 0.65, 22),
    "Offshore":         (13.0, 20, "Caterpillar 3516", 0.35, 0.60, 30),
    "Tug":              (12.0, 8, "Caterpillar 3516C", 0.80, 0.70, 8),
    "OSV":              (14.0, 18, "Bergen B35:40", 0.40, 0.62, 20),
    "Other":            (12.0, 15, "Diesel", 0.30, 0.60, 15),
}

# Get ALL ships without specs
ships = db.execute("""SELECT imo, type, dwt, year_built FROM ships
    WHERE fuel_consumption_tons_day = 0 OR fuel_consumption_tons_day IS NULL""").fetchall()

print(f"Enriching {len(ships)} ships...")
updated = 0

for imo, ship_type, dwt, year_built in ships:
    specs = TYPE_SPECS.get(ship_type, TYPE_SPECS.get("Other"))
    if not specs:
        continue

    speed, fuel, engine, kw_ratio, gt_ratio, crew = specs

    # If no DWT, estimate from type
    if not dwt or dwt == 0:
        dwt = TYPE_DWT.get(ship_type, 10000)

    engine_kw = int(dwt * kw_ratio)
    gt = int(dwt * gt_ratio)
    nt = int(gt * 0.35)

    if not year_built or year_built == 0:
        year_built = 2010
    if year_built >= 2020:
        fuel_type = "VLSFO 0.5%S / LNG-ready"
    elif year_built >= 2015:
        fuel_type = "VLSFO 0.5%S"
    else:
        fuel_type = "IFO 380 / VLSFO 0.5%S"

    holds = hatches = grain_cap = teu = 0
    cranes = ""

    bulk_types = {"Capesize", "Newcastlemax", "Kamsarmax", "Panamax", "Ultramax",
                  "Supramax", "Handymax", "Handysize", "Valemax", "VLOC",
                  "Geared", "Gearless", "Bulk Carrier", "Post-Panamax", "Mini-Bulker"}
    if ship_type in bulk_types:
        if dwt >= 200000: holds = hatches = 9
        elif dwt >= 150000: holds = hatches = 9
        elif dwt >= 80000: holds = hatches = 7
        elif dwt >= 60000: holds = hatches = 5
        elif dwt >= 40000: holds = hatches = 5
        elif dwt >= 25000: holds = hatches = 5
        else: holds = hatches = 4
        grain_cap = int(dwt * 1.25)

    container_types = {"Container Ship", "ULCV", "Neo-Panamax", "Feeder"}
    if ship_type in container_types:
        teu = int(dwt / 14)

    if ship_type in {"Geared", "Handysize", "Handymax", "Supramax", "Ultramax"}:
        num_cranes = max(holds - 1, 2)
        crane_cap = 30 if dwt < 50000 else 35
        cranes = f"{num_cranes}x {crane_cap}t"

    # Update: also set DWT if missing
    db.execute("""UPDATE ships SET
        dwt = CASE WHEN dwt = 0 OR dwt IS NULL THEN ? ELSE dwt END,
        gross_tonnage=?, net_tonnage=?, engine_type=?, engine_power_kw=?,
        speed_knots=?, fuel_consumption_tons_day=?, fuel_type=?,
        crew_size=?, grain_capacity=?, holds=?, hatches=?, teu=?, cranes=?
        WHERE imo=?""",
        (dwt, gt, nt, engine, engine_kw, speed, fuel, fuel_type,
         crew, grain_cap, holds, hatches, teu, cranes, imo))
    updated += 1

    if updated % 10000 == 0:
        db.commit()
        print(f"  {updated}...")

db.commit()
print(f"\nDone! Updated {updated} ships")
print(f"Total with specs: {db.execute('SELECT COUNT(*) FROM ships WHERE fuel_consumption_tons_day > 0').fetchone()[0]}")
print(f"Total with DWT: {db.execute('SELECT COUNT(*) FROM ships WHERE dwt > 0').fetchone()[0]}")
