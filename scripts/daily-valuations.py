#!/usr/bin/env python3
"""Broker-Quality Daily Vessel Valuations v4.1.
Hedonic pricing model: segment-specific newbuild prices, survey-cycle depreciation,
segment-specific market factors, LDT-based scrap floor, eco premium.
Model params loaded from shared db/model_params.json (single source of truth).
Cron: 30 19 * * *"""
import sqlite3, time, math, json, os

DB   = "/opt/bulkwatch/db/ships.db"
OPEX = "/opt/bulkwatch/db/opex_rates.json"
MODEL_PARAMS = "/opt/bulkwatch/db/model_params.json"
YEAR = 2026

# ═══════════════════════════════════════════════════════════════
# Load shared model parameters
# ═══════════════════════════════════════════════════════════════
def load_model_params():
    with open(MODEL_PARAMS) as f:
        return json.load(f)

PARAMS = load_model_params()

TYPE_ALIASES       = PARAMS.get("type_aliases", {})

def resolve_type(raw_type):
    """Resolve raw ship type to known segment via aliases."""
    return TYPE_ALIASES.get(raw_type, raw_type)

NEWBUILD_PRICES    = PARAMS["newbuildPrices"]
FALLBACK_TYPE_MULT = PARAMS["fallbackTypeMult"]
LDT_RATIOS         = PARAMS["ldtRatios"]
ECO_BENCHMARKS     = PARAMS["ecoBenchmarks"]
BIAS_CORRECTION    = PARAMS.get("segment_bias_correction", {})

# Segment groupings from shared params
CAPESIZE_TYPES  = set(PARAMS["segmentGroups"]["capesize"])
PANAMAX_TYPES   = set(PARAMS["segmentGroups"]["panamax"])
SUPRAMAX_TYPES  = set(PARAMS["segmentGroups"]["supramax"])
HANDYSIZE_TYPES = set(PARAMS["segmentGroups"]["handysize"])

# Tanker premium
TANKER_PREMIUM_FACTOR = PARAMS["tankerPremium"]["factor"]
TANKER_PREMIUM_TYPES  = set(PARAMS["tankerPremium"]["types"])

# Market factor baselines
MF_BASELINES = PARAMS["marketFactorBaselines"]

# Builder tiers from shared params
TIER1_BUILDERS = PARAMS["builderTiers"]["tier1"]["keywords"]
TIER1_FACTOR   = PARAMS["builderTiers"]["tier1"]["factor"]
TIER2_BUILDERS = PARAMS["builderTiers"]["tier2"]["keywords"]
TIER2_FACTOR   = PARAMS["builderTiers"]["tier2"]["factor"]
TIER4_BUILDERS = PARAMS["builderTiers"]["tier4"]["keywords"]
TIER4_FACTOR   = PARAMS["builderTiers"]["tier4"]["factor"]

# Depreciation brackets from shared params
DEP_BRACKETS = PARAMS["depreciation"]["brackets"]


# ═══════════════════════════════════════════════════════════════
# A) Newbuild price with DWT scaling
# ═══════════════════════════════════════════════════════════════
def newbuild_price(ship_type, dwt):
    dwt = max(dwt, 500)
    if ship_type in NEWBUILD_PRICES:
        ref = NEWBUILD_PRICES[ship_type]
        nb = ref["nb"] * ((dwt / ref["dwt"]) ** 0.7)
        return nb
    ref = NEWBUILD_PRICES["Bulk Carrier"]
    mult = FALLBACK_TYPE_MULT.get(ship_type, 1.0)
    nb = ref["nb"] * ((dwt / ref["dwt"]) ** 0.7) * mult
    return nb


# ═══════════════════════════════════════════════════════════════
# B) Hedonic depreciation with survey-cycle penalties
# ═══════════════════════════════════════════════════════════════
def depreciation(age):
    """Market-calibrated — fitted to 18 real S&P transactions (Jun 2026).
    Parameters loaded from model_params.json."""
    for b in DEP_BRACKETS:
        if age <= b["maxAge"]:
            if "slope" in b:
                val = b["startValue"] - (age - b["fromAge"]) * b["slope"]
                return max(val, b.get("floor", 0))
            return b["value"]
    # Beyond all brackets
    last = DEP_BRACKETS[-1]
    val = last["startValue"] - (age - last["fromAge"]) * last["slope"]
    return max(val, last.get("floor", 0.08))


def market_factor(ship_type, bdi, charter_rates):
    if ship_type in CAPESIZE_TYPES:
        seg = "capesize"
    elif ship_type in PANAMAX_TYPES:
        seg = "panamax"
    elif ship_type in SUPRAMAX_TYPES:
        seg = "supramax"
    elif ship_type in HANDYSIZE_TYPES:
        seg = "handysize"
    else:
        seg = "other"

    bl = MF_BASELINES[seg]
    if seg == "other":
        rate = bdi
    else:
        rate = charter_rates.get(seg, bl["defaultRate"])
    baseline = bl["baseline"]

    ratio = rate / baseline
    base = 0.85 + 0.15 * (ratio ** 0.5)

    if ship_type in TANKER_PREMIUM_TYPES:
        base *= TANKER_PREMIUM_FACTOR
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
        return TIER1_FACTOR
    if any(p in bl for p in TIER2_BUILDERS):
        return TIER2_FACTOR
    if any(p in bl for p in TIER4_BUILDERS):
        return TIER4_FACTOR
    return 1.0


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
    stype    = resolve_type(stype or )""
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

    bias = BIAS_CORRECTION.get(stype, 1.0)
    base_value = nb * dep * mf * bf * status_mult * bias
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
    print(f"Model params v{PARAMS.get('version','?')} loaded from {MODEL_PARAMS}")
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
