#!/usr/bin/env python3
"""Enrich vessel specs with estimated fuel consumption, engine power, speed, GT etc.
Based on industry-standard formulas and type-specific averages from Clarksons/DNV."""
import sqlite3, math

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Type-specific defaults based on industry data (Clarksons, MAN Energy Solutions, DNV)
# Format: { type: (speed_kn, fuel_tons_day, engine_type, engine_kw_per_1000dwt, gt_ratio, crew) }
TYPE_SPECS = {
    # Bulk Carriers
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

    # Tankers
    "Crude Oil Tanker": (15.0, 55, "MAN B&W 6S70ME-C8", 0.38, 0.55, 28),
    "Tanker":           (14.5, 40, "MAN B&W 6S60ME-C8", 0.36, 0.55, 25),
    "Oil/Chemical Tanker": (14.0, 35, "MAN B&W 6S50ME-C8", 0.34, 0.56, 24),
    "Product Tanker":   (14.5, 30, "MAN B&W 6S50ME-B9", 0.35, 0.56, 23),
    "Chemical Tanker":  (14.0, 28, "MAN B&W 6S46ME-B8", 0.33, 0.57, 22),
    "LNG Tanker":       (19.5, 130, "Winterthur DFDE / ME-GI", 0.55, 0.65, 30),
    "LPG Tanker":       (16.5, 45, "MAN B&W 6G60ME-C9", 0.42, 0.60, 26),

    # Container
    "Container Ship":   (18.0, 80, "MAN B&W 8S80ME-C9", 0.55, 0.70, 24),
    "ULCV":             (22.0, 200, "MAN B&W 12S90ME-C10", 0.60, 0.72, 26),
    "Neo-Panamax":      (21.0, 150, "MAN B&W 11S90ME-C10", 0.58, 0.71, 25),
    "Feeder":           (16.0, 35, "MAN B&W 6S50ME-C8", 0.45, 0.68, 18),

    # General Cargo
    "General Cargo":    (13.0, 18, "MAN B&W 5S42ME-B9", 0.30, 0.60, 18),
    "Multipurpose":     (14.0, 22, "MAN B&W 6S46ME-B8", 0.32, 0.58, 20),

    # RoRo / Car
    "RoRo":             (18.0, 60, "MAN B&W 8S60ME-C8", 0.50, 0.55, 24),
    "Car Carrier":      (19.0, 55, "MAN B&W 7S60ME-C8", 0.48, 0.30, 25),

    # Passenger
    "Passenger":        (16.0, 40, "Wärtsilä 12V46F", 0.45, 0.85, 80),
    "Cruise Ship":      (21.0, 250, "Wärtsilä 14V46F + ABB Azipod", 0.60, 0.90, 1200),
    "Ferry":            (18.0, 35, "Wärtsilä 8L46F", 0.50, 0.80, 40),

    # Other
    "Reefer":           (20.0, 45, "MAN B&W 6S60ME-C8", 0.50, 0.65, 22),
    "Offshore":         (13.0, 20, "Caterpillar 3516", 0.35, 0.60, 30),
    "Tug":              (12.0, 8, "Caterpillar 3516C", 0.80, 0.70, 8),
    "OSV":              (14.0, 18, "Bergen B35:40", 0.40, 0.62, 20),
    "Other":            (12.0, 15, "Diesel", 0.30, 0.60, 15),
}

updated = 0
ships = db.execute("SELECT imo, type, dwt, length FROM ships WHERE dwt > 0").fetchall()

for imo, ship_type, dwt, length in ships:
    specs = TYPE_SPECS.get(ship_type, TYPE_SPECS.get("Other"))
    if not specs:
        continue

    speed, fuel, engine, kw_ratio, gt_ratio, crew = specs

    # Calculate engine power from DWT
    engine_kw = int(dwt * kw_ratio)

    # Adjust fuel consumption based on actual DWT vs type average
    type_avg_fuel = fuel
    # Fuel scales roughly with DWT^0.66 (admiralty coefficient)
    if ship_type in TYPE_SPECS:
        type_avg_dwt = {
            "Valemax": 400000, "VLOC": 300000, "Newcastlemax": 210000,
            "Capesize": 180000, "Kamsarmax": 82000, "Panamax": 75000,
            "Ultramax": 64000, "Supramax": 58000, "Handymax": 45000,
            "Handysize": 35000, "Container Ship": 50000, "ULCV": 230000,
            "Neo-Panamax": 150000, "Crude Oil Tanker": 300000,
            "LNG Tanker": 174000, "Cruise Ship": 50000,
        }.get(ship_type, 50000)
        if type_avg_dwt > 0 and dwt > 0:
            fuel_adjusted = type_avg_fuel * (dwt / type_avg_dwt) ** 0.66
        else:
            fuel_adjusted = type_avg_fuel
    else:
        fuel_adjusted = fuel

    fuel_adjusted = round(fuel_adjusted, 1)

    # Gross tonnage estimate
    gt = int(dwt * gt_ratio)

    # Net tonnage (typically ~30-40% of GT)
    nt = int(gt * 0.35)

    # Fuel type based on year
    year = db.execute("SELECT year_built FROM ships WHERE imo=?", (imo,)).fetchone()
    year_built = year[0] if year and year[0] else 2010
    if year_built >= 2020:
        fuel_type = "VLSFO 0.5%S / LNG-ready"
    elif year_built >= 2015:
        fuel_type = "VLSFO 0.5%S"
    else:
        fuel_type = "IFO 380 / VLSFO 0.5%S"

    # Bulk carrier specific: holds, hatches, grain capacity
    holds = 0
    hatches = 0
    grain_cap = 0
    if "bulk" in ship_type.lower() or ship_type in ["Capesize", "Newcastlemax", "Kamsarmax", "Panamax",
            "Ultramax", "Supramax", "Handymax", "Handysize", "Valemax", "VLOC", "Geared", "Gearless"]:
        if dwt >= 200000: holds, hatches = 9, 9
        elif dwt >= 150000: holds, hatches = 9, 9
        elif dwt >= 80000: holds, hatches = 7, 7
        elif dwt >= 60000: holds, hatches = 5, 5
        elif dwt >= 40000: holds, hatches = 5, 5
        elif dwt >= 25000: holds, hatches = 5, 5
        else: holds, hatches = 4, 4
        grain_cap = int(dwt * 1.25)  # grain capacity ~125% of DWT

    # TEU for container ships
    teu = 0
    if "container" in ship_type.lower() or ship_type in ["ULCV", "Neo-Panamax", "Feeder"]:
        teu = int(dwt / 14)  # rough conversion

    # Cranes for geared bulkers
    cranes = ""
    if ship_type in ["Geared", "Handysize", "Handymax", "Supramax", "Ultramax"]:
        num_cranes = holds - 1 if holds > 1 else 2
        crane_cap = 30 if dwt < 50000 else 35
        cranes = f"{num_cranes}x {crane_cap}t"

    db.execute("""UPDATE ships SET
        gross_tonnage=?, net_tonnage=?, engine_type=?, engine_power_kw=?,
        speed_knots=?, fuel_consumption_tons_day=?, fuel_type=?,
        crew_size=?, grain_capacity=?, holds=?, hatches=?, teu=?, cranes=?
        WHERE imo=?""",
        (gt, nt, engine, engine_kw, speed, fuel_adjusted, fuel_type,
         crew, grain_cap, holds, hatches, teu, cranes, imo))
    updated += 1

db.commit()
print(f"Updated specs for {updated} ships")

# Verify
print(f"\nWith fuel consumption: {db.execute('SELECT COUNT(*) FROM ships WHERE fuel_consumption_tons_day > 0').fetchone()[0]}")
print(f"With engine type: {db.execute("SELECT COUNT(*) FROM ships WHERE engine_type IS NOT NULL AND engine_type != ''").fetchone()[0]}")
print(f"With GT: {db.execute('SELECT COUNT(*) FROM ships WHERE gross_tonnage > 0').fetchone()[0]}")

# Show example
print("\nExample:")
for row in db.execute("SELECT name, type, dwt, speed_knots, fuel_consumption_tons_day, engine_type, gross_tonnage, crew_size FROM ships WHERE fuel_consumption_tons_day > 0 LIMIT 5"):
    print(f"  {row[0]} | {row[1]} | {row[2]} DWT | {row[3]} kn | {row[4]} t/day | {row[5]} | GT {row[6]} | crew {row[7]}")
