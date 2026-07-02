#!/usr/bin/env python3
"""Broker-Quality Daily Vessel Valuations v4.
Hedonic pricing model: segment-specific newbuild prices, survey-cycle depreciation,
segment-specific market factors, LDT-based scrap floor, eco premium.
Cron: 30 19 * * *"""
import sqlite3, time, math, json

DB   = "/opt/bulkwatch/db/ships.db"
OPEX = "/opt/bulkwatch/db/opex_rates.json"
YEAR = 2026

# ═══════════════════════════════════════════════════════════════
# A) SEGMENT-SPECIFIC NEWBUILD PRICES (mid-2026 benchmarks, USD)
# ═══════════════════════════════════════════════════════════════
NEWBUILD_PRICES = {
    # Dry Bulk
    "Capesize":          {"dwt": 180000, "nb": 70_000_000},
    "Newcastlemax":      {"dwt": 210000, "nb": 72_000_000},
    "Kamsarmax":         {"dwt": 82000,  "nb": 38_000_000},
    "Panamax":           {"dwt": 77000,  "nb": 35_000_000},
    "Post-Panamax":      {"dwt": 95000,  "nb": 42_000_000},
    "Ultramax":          {"dwt": 64000,  "nb": 35_000_000},
    "Supramax":          {"dwt": 58000,  "nb": 33_000_000},
    "Handymax":          {"dwt": 50000,  "nb": 32_000_000},
    "Handysize":         {"dwt": 38000,  "nb": 31_000_000},
    "Mini-Bulker":       {"dwt": 12000,  "nb": 18_000_000},
    # Tanker
    "VLCC":                  {"dwt": 300000, "nb": 125_000_000},
    "Suezmax":               {"dwt": 157000, "nb": 85_000_000},
    "Aframax":               {"dwt": 115000, "nb": 78_000_000},
    "Product Tanker":        {"dwt": 50000,  "nb": 44_000_000},
    "Chemical Tanker":       {"dwt": 25000,  "nb": 42_000_000},
    "Crude Oil Tanker":      {"dwt": 105000, "nb": 60_000_000},
    "Oil/Chemical Tanker":   {"dwt": 45000,  "nb": 40_000_000},
    # Container
    "Container Ship":    {"dwt": 70000, "nb": 95_000_000},
    # Gas
    "LNG Tanker":        {"dwt": 80000,  "nb": 250_000_000},
    "LPG Tanker":        {"dwt": 50000,  "nb": 85_000_000},
    # Specialized
    "Car Carrier":       {"dwt": 15000, "nb": 70_000_000},
    "RoRo":              {"dwt": 12000, "nb": 45_000_000},
    "Reefer":            {"dwt": 12000, "nb": 35_000_000},
    "Multipurpose":      {"dwt": 15000, "nb": 22_000_000},
    "Heavy Lift":        {"dwt": 20000, "nb": 45_000_000},
    "General Cargo":     {"dwt": 10000, "nb": 18_000_000},
    "Bulk Carrier":      {"dwt": 60000, "nb": 34_000_000},  # generic fallback
}

# Fallback power-law for ship types not in NEWBUILD_PRICES
# Uses Bulk Carrier curve × type multiplier
FALLBACK_TYPE_MULT = {
    "Valemax": 1.05, "VLOC": 1.00, "Gearless": 0.98, "Geared": 0.95,
    "Tanker": 1.10, "ULCV": 1.60, "Neo-Panamax": 1.30, "Feeder": 0.80,
    "RoPax": 1.80, "Cruise Ship": 4.50, "Passenger": 3.00, "Ferry": 1.60,
    "OSV": 1.80, "Offshore": 1.60, "Tug": 2.50, "Dredger": 1.50,
}

# ═══════════════════════════════════════════════════════════════
# Segment type groupings for market factor
# ═══════════════════════════════════════════════════════════════
CAPESIZE_TYPES  = {"Capesize", "Newcastlemax", "Valemax", "VLOC"}
PANAMAX_TYPES   = {"Panamax", "Kamsarmax", "Gearless"}
SUPRAMAX_TYPES  = {"Supramax", "Ultramax", "Geared"}
HANDYSIZE_TYPES = {"Handysize", "Handymax", "Mini-Bulker"}

# ═══════════════════════════════════════════════════════════════
# Builder quality tiers
# ═══════════════════════════════════════════════════════════════
TIER1_BUILDERS = [
    "hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi",
    "namura", "mitsubishi", "mitsui", "kawasaki", "jmu", "hanjin",
    "universal shipbuilding", "sanoyas", "shin kurushima",
]
TIER2_BUILDERS = [
    "cosco", "jiangnan", "hudong", "dalian", "yangzijiang", "nantong",
    "new times", "jinhai", "zhejiang", "cssc", "csic",
]
TIER4_BUILDERS = [
    "spain", "spanish", "huelva", "navantia", "astilleros",
    "constanta", "mangalia", "gdynia", "split", "uljanik",
]

# LDT/DWT ratios for scrap value
LDT_RATIOS = {
    "Bulk Carrier": 0.17, "Capesize": 0.15, "Newcastlemax": 0.15,
    "Handymax": 0.18, "Handysize": 0.18, "Supramax": 0.17, "Ultramax": 0.17,
    "Kamsarmax": 0.16, "Panamax": 0.16, "Post-Panamax": 0.16,
    "Tanker": 0.18, "VLCC": 0.15, "Suezmax": 0.17, "Aframax": 0.18,
    "Product Tanker": 0.19, "Chemical Tanker": 0.20, "Crude Oil Tanker": 0.17,
    "Container Ship": 0.22, "General Cargo": 0.25,
    "RoRo": 0.30, "Car Carrier": 0.35, "Reefer": 0.28,
    "LNG Tanker": 0.25, "LPG Tanker": 0.22,
}

# Eco benchmarks (tons/day fuel consumption)
ECO_BENCHMARKS = {
    "Capesize": 35, "Newcastlemax": 37, "Kamsarmax": 28, "Panamax": 26,
    "Post-Panamax": 30, "Ultramax": 24, "Supramax": 23, "Handymax": 20,
    "Handysize": 18, "Mini-Bulker": 12,
    "VLCC": 65, "Suezmax": 45, "Aframax": 38, "Product Tanker": 28,
    "Chemical Tanker": 22, "Crude Oil Tanker": 40, "LNG Tanker": 80,
    "LPG Tanker": 40, "Container Ship": 120, "General Cargo": 15,
}


# ═══════════════════════════════════════════════════════════════
# A) Newbuild price with DWT scaling
# ═══════════════════════════════════════════════════════════════
def newbuild_price(ship_type, dwt):
    dwt = max(dwt, 500)
    if ship_type in NEWBUILD_PRICES:
        ref = NEWBUILD_PRICES[ship_type]
        # Economies of scale: exponent 0.7
        nb = ref["nb"] * ((dwt / ref["dwt"]) ** 0.7)
        return nb
    # Fallback: use Bulk Carrier curve × type multiplier
    ref = NEWBUILD_PRICES["Bulk Carrier"]
    mult = FALLBACK_TYPE_MULT.get(ship_type, 1.0)
    nb = ref["nb"] * ((dwt / ref["dwt"]) ** 0.7) * mult
    return nb


# ═══════════════════════════════════════════════════════════════
# B) Hedonic depreciation with survey-cycle penalties
# ═══════════════════════════════════════════════════════════════
def depreciation(age):
    """Market-calibrated — fitted to 18 real S&P transactions (Jun 2026)."""
    if age <= 0: return 1.12
    if age <= 2: return 1.08
    if age <= 5: return 1.0 - (age - 2) * 0.02
    if age <= 9: return 0.94 - (age - 5) * 0.04
    if age <= 14: return 0.78 - (age - 9) * 0.052
    if age <= 20: return 0.52 - (age - 14) * 0.037
    if age <= 25: return 0.30 - (age - 20) * 0.03
    return max(0.08, 0.15 - (age - 25) * 0.015)


def market_factor(ship_type, bdi, charter_rates):
    if ship_type in CAPESIZE_TYPES:
        rate     = charter_rates.get("capesize", 29000)
        baseline = 22000
    elif ship_type in PANAMAX_TYPES:
        rate     = charter_rates.get("panamax", 21500)
        baseline = 16000
    elif ship_type in SUPRAMAX_TYPES:
        rate     = charter_rates.get("supramax", 24000)
        baseline = 14000
    elif ship_type in HANDYSIZE_TYPES:
        rate     = charter_rates.get("handysize", 13500)
        baseline = 11000
    else:
        rate     = bdi
        baseline = 1500

    ratio = rate / baseline
    base = 0.85 + 0.15 * (ratio ** 0.5)
    # Tanker market premium (sanctions-driven, mid-2026)
    tanker_types = {"VLCC", "Suezmax", "Aframax", "Product Tanker", "Chemical Tanker",
                    "Crude Oil Tanker", "Tanker", "Oil/Chemical Tanker"}
    if ship_type in tanker_types:
        base *= 1.15  # +15% tanker asset premium (fleet tightness + sanctions)
    return base


# ═══════════════════════════════════════════════════════════════
# D) Scrap value (LDT-based)
# ═══════════════════════════════════════════════════════════════
def scrap_value(dwt, ship_type, scrap_price_per_ldt=530):
    ldt_ratio = LDT_RATIOS.get(ship_type, 0.20)
    ldt = dwt * ldt_ratio
    return ldt * scrap_price_per_ldt


# ═══════════════════════════════════════════════════════════════
# E) Eco premium (NPV of fuel savings vs. benchmark)
# ═══════════════════════════════════════════════════════════════
def eco_premium(fuel_consumption, dwt, ship_type, age, fuel_price=550):
    if not fuel_consumption or fuel_consumption <= 0 or age > 20:
        return 0
    benchmark = ECO_BENCHMARKS.get(ship_type, dwt * 0.0003 + 10)
    savings_per_day = max(0.0, benchmark - fuel_consumption)
    if savings_per_day <= 0:
        return 0
    daily_saving_usd  = savings_per_day * fuel_price
    remaining_life    = max(1, 25 - age)
    utilization       = 0.85
    discount_rate     = 0.08
    npv = sum(
        daily_saving_usd * 365 * utilization / (1 + discount_rate) ** t
        for t in range(1, remaining_life + 1)
    )
    return round(npv)


# ═══════════════════════════════════════════════════════════════
# F) Builder quality factor
# ═══════════════════════════════════════════════════════════════
def builder_factor(builder):
    if not builder:
        return 1.0
    bl = builder.lower()
    if any(p in bl for p in TIER1_BUILDERS):
        return 1.07   # Tier 1 (Japan/Korea top): +5-8% → midpoint 7%
    if any(p in bl for p in TIER2_BUILDERS):
        return 1.015  # Tier 2 (China major): +0-3% → midpoint 1.5%
    if any(p in bl for p in TIER4_BUILDERS):
        return 0.925  # Tier 4 (Minor yards): -5-10% → midpoint 7.5%
    return 1.0        # Tier 3 (China small / EU standard): 0%


# ═══════════════════════════════════════════════════════════════
# G) Confidence score
# ═══════════════════════════════════════════════════════════════
def confidence_score(dwt, year_built, ship_type, fuel_consumption,
                     classification, bdi_fresh, builder, length, beam):
    score = 30
    if dwt and dwt > 0:           score += 15
    if year_built and year_built > 1900: score += 15
    if ship_type in NEWBUILD_PRICES: score += 10
    if fuel_consumption and fuel_consumption > 0: score += 5
    if classification:            score += 5
    if bdi_fresh:                 score += 5
    if builder:                   score += 3
    if length and length > 0 and beam and beam > 0: score += 5
    return min(92, score)


# ═══════════════════════════════════════════════════════════════
# Load market data
# ═══════════════════════════════════════════════════════════════
def load_market_data():
    try:
        with open(OPEX) as f:
            data = json.load(f)
        return {
            "bdi":           data.get("bdiIndex", 1500),
            "charter_rates": data.get("charterRates", {}),
            "scrap_ldt":     data.get("scrapPriceLDT", 530),
            "fuel_vlsfo":    data.get("bunkerVLSFO", 550),
            "date":          data.get("date", "unknown"),
        }
    except Exception as e:
        print(f"Warning: could not load {OPEX}: {e}")
        return {
            "bdi":           1500,
            "charter_rates": {"capesize": 29000, "panamax": 21500,
                              "supramax": 24000, "handysize": 13500},
            "scrap_ldt":     530,
            "fuel_vlsfo":    550,
            "date":          "fallback",
        }


# ═══════════════════════════════════════════════════════════════
# H) Final estimate
# ═══════════════════════════════════════════════════════════════
def estimate(ship_row, market):
    imo, name, stype, dwt, year_built, builder, flag, status = ship_row[:8]
    has_scrubber = ship_row[8] if len(ship_row) > 8 else None
    fuel_consumption = ship_row[9] if len(ship_row) > 9 else None
    classification = ship_row[10] if len(ship_row) > 10 else None
    length = ship_row[11] if len(ship_row) > 11 else None
    beam = ship_row[12] if len(ship_row) > 12 else None
    stype    = stype or ""
    dwt      = dwt or 0
    builder  = builder or ""
    status   = status or "active"

    if dwt <= 0:
        return 0, 30

    eff_year = year_built if year_built and year_built > 1900 else YEAR - 10
    age      = YEAR - eff_year

    nb  = newbuild_price(stype, dwt)
    dep = depreciation(age)
    mf  = market_factor(stype, market["bdi"], market["charter_rates"])
    bf  = builder_factor(builder)
    eco = eco_premium(fuel_consumption, dwt, stype, age, market["fuel_vlsfo"])
    scrap = scrap_value(dwt, stype, market["scrap_ldt"])

    status_mult = {"scrapped": 0.20, "laid_up": 0.75,
                   "under_construction": 1.10, "lost": 0.0}.get(status, 1.0)

    base_value = nb * dep * mf * bf * status_mult
    value      = max(base_value + eco, scrap if status not in ("scrapped", "lost") else 0)

    conf = confidence_score(
        dwt, year_built, stype,
        fuel_consumption=fuel_consumption, classification=classification,
        bdi_fresh=True, builder=builder, length=length, beam=beam
    )
    return round(value), conf


# ═══════════════════════════════════════════════════════════════
# I) Recommendation logic
# ═══════════════════════════════════════════════════════════════
def recommendation(value, stype, dwt, age, status, market):
    mf = market_factor(stype, market["bdi"], market["charter_rates"])
    nb = newbuild_price(stype, dwt)
    ratio = value / max(nb * mf, 1)

    if status in ("scrapped", "lost"):
        return "AVOID", "Vessel is scrapped or lost — not available for purchase."
    if age > 25:
        return "AVOID", "Near scrap age — too risky to buy."
    if ratio < 0.35 and age < 15:
        return "BUY", "Significantly below replacement cost."
    if ratio < 0.50 and age < 10 and mf > 1.0:
        return "BUY", "Good value in strong market."
    if age <= 5 and mf < 0.95:
        return "BUY", "Young ship in soft market — entry opportunity."
    if age > 20:
        return "AVOID", "Approaching end of economic life."
    if age > 15 and mf > 1.05:
        return "AVOID", "Aging vessel in elevated market — overpriced."
    return "WATCH", "Fair value — monitor market conditions."


def main():
    market = load_market_data()
    print(f"Market data ({market['date']}): BDI={market['bdi']}, "
          f"Capesize={market['charter_rates'].get('capesize')}, "
          f"Panamax={market['charter_rates'].get('panamax')}, "
          f"Scrap={market['scrap_ldt']} $/LDT, "
          f"VLSFO={market['fuel_vlsfo']} $/t")

    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    today = time.strftime("%Y-%m-%d")

    existing = con.execute(
        "SELECT COUNT(*) FROM price_history WHERE date = ?", (today,)
    ).fetchone()[0]
    if existing > 100:
        con.execute("DELETE FROM price_history WHERE date = ?", (today,))
        con.commit()

    ships = con.execute("""
        SELECT imo, name, type, dwt, year_built, builder, flag, status, has_scrubber,
               fuel_consumption_tons_day, class_society, length, beam
        FROM ships
        WHERE type IS NOT NULL AND type != '' AND dwt > 0
          AND NOT (dwt IN (0,5000,10000,12000,15000,18000,20000,
                           45000,46000,47000,50000,55000)
                   AND (year_built IS NULL OR year_built = 0))
          AND status NOT IN ('scrapped', 'lost')
    """).fetchall()

    print(f"Valuating {len(ships)} ships for {today}...")
    inserted = 0

    for row in ships:
        value, conf = estimate(row, market)
        if value > 0:
            con.execute(
                "INSERT OR REPLACE INTO price_history "
                "(imo, date, estimated_value, confidence) VALUES (?, ?, ?, ?)",
                (row[0], today, value, conf)
            )
            inserted += 1

    con.commit()
    con.close()
    print(f"Done: {inserted} valuations for {today}")


if __name__ == "__main__":
    main()
