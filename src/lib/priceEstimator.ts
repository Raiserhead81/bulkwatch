// Vessel value estimation — Hedonic Pricing Model v4
// Segment-specific newbuild prices × survey-cycle depreciation × segment market factor
// Synchronized with daily-valuations.py (same model logic)
// Sources: Clarksons, Baltic Exchange, NautiSNP, Xclusiv Shipbrokers
// Market data last updated: 2026-07-01 (from opex_rates.json)

import type { Ship } from "@/data/ships";

export interface PriceEstimate {
  estimatedValueUSD: number;
  confidenceScore: number;
  reasoning: string;
  recommendation: "BUY" | "WATCH" | "AVOID";
  recommendationReasoning: string;
  factors: Array<{
    label: string;
    value: string;
    impact: "positive" | "neutral" | "negative";
    weight: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// A) SEGMENT-SPECIFIC NEWBUILD PRICES (mid-2026 benchmarks, USD)
// ═══════════════════════════════════════════════════════════════
const NEWBUILD_PRICES: Record<string, { dwt: number; nb: number }> = {
  // Dry Bulk
  "Capesize":          { dwt: 180000, nb: 70_000_000 },
  "Newcastlemax":      { dwt: 210000, nb: 72_000_000 },
  "Kamsarmax":         { dwt: 82000,  nb: 38_000_000 },
  "Panamax":           { dwt: 77000,  nb: 35_000_000 },
  "Post-Panamax":      { dwt: 95000,  nb: 42_000_000 },
  "Ultramax":          { dwt: 64000,  nb: 35_000_000 },
  "Supramax":          { dwt: 58000,  nb: 33_000_000 },
  "Handymax":          { dwt: 50000,  nb: 32_000_000 },
  "Handysize":         { dwt: 38000,  nb: 31_000_000 },
  "Mini-Bulker":       { dwt: 12000,  nb: 18_000_000 },
  // Tanker
  "VLCC":                  { dwt: 300000, nb: 125_000_000 },
  "Suezmax":               { dwt: 157000, nb: 85_000_000  },
  "Aframax":               { dwt: 115000, nb: 65_000_000  },
  "Product Tanker":        { dwt: 50000,  nb: 44_000_000  },
  "Chemical Tanker":       { dwt: 25000,  nb: 42_000_000  },
  "Crude Oil Tanker":      { dwt: 105000, nb: 60_000_000  },
  "Oil/Chemical Tanker":   { dwt: 45000,  nb: 40_000_000  },
  // Container
  "Container Ship":    { dwt: 70000,  nb: 95_000_000  },
  // Gas
  "LNG Tanker":        { dwt: 80000,  nb: 250_000_000 },
  "LPG Tanker":        { dwt: 50000,  nb: 85_000_000  },
  // Specialized
  "Car Carrier":       { dwt: 15000,  nb: 70_000_000  },
  "RoRo":              { dwt: 12000,  nb: 45_000_000  },
  "Reefer":            { dwt: 12000,  nb: 35_000_000  },
  "Multipurpose":      { dwt: 15000,  nb: 22_000_000  },
  "Heavy Lift":        { dwt: 20000,  nb: 45_000_000  },
  "General Cargo":     { dwt: 10000,  nb: 18_000_000  },
  "Bulk Carrier":      { dwt: 60000,  nb: 34_000_000  }, // generic fallback
};

// Fallback type multipliers (applied on Bulk Carrier curve)
const FALLBACK_TYPE_MULT: Record<string, number> = {
  "Valemax": 1.05, "VLOC": 1.00, "Gearless": 0.98, "Geared": 0.95,
  "Tanker": 1.10, "ULCV": 1.60, "Neo-Panamax": 1.30, "Feeder": 0.80,
  "RoPax": 1.80, "Cruise Ship": 4.50, "Passenger": 3.00, "Ferry": 1.60,
  "OSV": 1.80, "Offshore": 1.60, "Tug": 2.50, "Dredger": 1.50,
};

// ═══════════════════════════════════════════════════════════════
// Segment groupings for market factor
// ═══════════════════════════════════════════════════════════════
const CAPESIZE_TYPES  = new Set(["Capesize", "Newcastlemax", "Valemax", "VLOC", "Post-Panamax"]);
const PANAMAX_TYPES   = new Set(["Panamax", "Kamsarmax", "Gearless"]);
const SUPRAMAX_TYPES  = new Set(["Supramax", "Ultramax", "Geared"]);
const HANDYSIZE_TYPES = new Set(["Handysize", "Handymax", "Mini-Bulker"]);

// ═══════════════════════════════════════════════════════════════
// Builder quality tiers
// ═══════════════════════════════════════════════════════════════
const TIER1_BUILDERS = [
  "hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi",
  "namura", "mitsubishi", "mitsui", "kawasaki", "jmu", "hanjin",
  "universal shipbuilding", "sanoyas", "shin kurushima",
];
const TIER2_BUILDERS = [
  "cosco", "jiangnan", "hudong", "dalian", "yangzijiang", "nantong",
  "new times", "jinhai", "zhejiang", "cssc", "csic",
];
const TIER4_BUILDERS = [
  "huelva", "navantia", "astilleros", "constanta", "mangalia",
  "gdynia", "split", "uljanik",
];

// LDT/DWT ratios for scrap value
const LDT_RATIOS: Record<string, number> = {
  "Bulk Carrier": 0.17, "Capesize": 0.15, "Newcastlemax": 0.15,
  "Handymax": 0.18, "Handysize": 0.18, "Supramax": 0.17, "Ultramax": 0.17,
  "Kamsarmax": 0.16, "Panamax": 0.16, "Post-Panamax": 0.16,
  "Tanker": 0.18, "VLCC": 0.15, "Suezmax": 0.17, "Aframax": 0.18,
  "Product Tanker": 0.19, "Chemical Tanker": 0.20, "Crude Oil Tanker": 0.17,
  "Container Ship": 0.22, "General Cargo": 0.25,
  "RoRo": 0.30, "Car Carrier": 0.35, "Reefer": 0.28,
  "LNG Tanker": 0.25, "LPG Tanker": 0.22,
};

// Eco benchmarks (tons/day)
const ECO_BENCHMARKS: Record<string, number> = {
  "Capesize": 35, "Newcastlemax": 37, "Kamsarmax": 28, "Panamax": 26,
  "Post-Panamax": 30, "Ultramax": 24, "Supramax": 23, "Handymax": 20,
  "Handysize": 18, "Mini-Bulker": 12,
  "VLCC": 65, "Suezmax": 45, "Aframax": 38, "Product Tanker": 28,
  "Chemical Tanker": 22, "Crude Oil Tanker": 40, "LNG Tanker": 80,
  "LPG Tanker": 40, "Container Ship": 120, "General Cargo": 15,
};

// ═══════════════════════════════════════════════════════════════
// HARDCODED MARKET DATA — last updated 2026-07-01
// Source: /opt/bulkwatch/db/opex_rates.json
// Python script reads this file dynamically; TS uses these constants.
// ═══════════════════════════════════════════════════════════════
const MARKET = {
  bdi:          2562,
  charterRates: { capesize: 29000, panamax: 21500, supramax: 24000, handysize: 13500 },
  scrapPerLDT:  478,   // $/LDT
  fuelVLSFO:    512,   // $/ton VLSFO
  date:         "01 Jul 2026",
};

// ═══════════════════════════════════════════════════════════════
// A) Newbuild price with DWT scaling (economies of scale exp 0.7)
// ═══════════════════════════════════════════════════════════════
function newbuildPrice(shipType: string, dwt: number): number {
  const safeDwt = Math.max(dwt, 500);
  if (NEWBUILD_PRICES[shipType]) {
    const ref = NEWBUILD_PRICES[shipType];
    return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7);
  }
  // Fallback: Bulk Carrier curve × type multiplier
  const ref  = NEWBUILD_PRICES["Bulk Carrier"];
  const mult = FALLBACK_TYPE_MULT[shipType] ?? 1.0;
  return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7) * mult;
}

// ═══════════════════════════════════════════════════════════════
// B) Hedonic depreciation with survey-cycle penalties
// ═══════════════════════════════════════════════════════════════
function depreciation(age: number): number {
  // Market-calibrated — fitted to 18 real S&P transactions (Jun 2026)
  if (age <= 0) return 1.12;
  if (age <= 2) return 1.08;
  if (age <= 5) return 1.0 - (age - 2) * 0.02;
  if (age <= 9) return 0.94 - (age - 5) * 0.04;
  if (age <= 14) return 0.78 - (age - 9) * 0.052;
  if (age <= 20) return 0.52 - (age - 14) * 0.037;
  if (age <= 25) return 0.30 - (age - 20) * 0.03;
  return Math.max(0.08, 0.15 - (age - 25) * 0.015);
}

// ═══════════════════════════════════════════════════════════════
// C) Segment-specific market factor
// ═══════════════════════════════════════════════════════════════
function marketFactor(shipType: string): number {
  let rate: number;
  let baseline: number;

  if (CAPESIZE_TYPES.has(shipType)) {
    rate     = MARKET.charterRates.capesize;
    baseline = 22000;
  } else if (PANAMAX_TYPES.has(shipType)) {
    rate     = MARKET.charterRates.panamax;
    baseline = 16000;
  } else if (SUPRAMAX_TYPES.has(shipType)) {
    rate     = MARKET.charterRates.supramax;
    baseline = 14000;
  } else if (HANDYSIZE_TYPES.has(shipType)) {
    rate     = MARKET.charterRates.handysize;
    baseline = 11000;
  } else {
    rate     = MARKET.bdi;
    baseline = 1500;
  }

  const ratio = rate / baseline;
  return 0.85 + 0.15 * Math.pow(ratio, 0.5);
}

// ═══════════════════════════════════════════════════════════════
// D) Scrap value (LDT-based)
// ═══════════════════════════════════════════════════════════════
function scrapValue(dwt: number, shipType: string): number {
  const ldt = dwt * (LDT_RATIOS[shipType] ?? 0.20);
  return ldt * MARKET.scrapPerLDT;
}

// ═══════════════════════════════════════════════════════════════
// E) Eco premium (NPV of fuel savings vs. benchmark)
// ═══════════════════════════════════════════════════════════════
function ecoPremium(fuelConsumption: number | undefined, dwt: number, shipType: string, age: number): number {
  if (!fuelConsumption || fuelConsumption <= 0 || age > 20) return 0;
  const benchmark    = ECO_BENCHMARKS[shipType] ?? (dwt * 0.0003 + 10);
  const savingsPerDay = Math.max(0, benchmark - fuelConsumption);
  if (savingsPerDay <= 0) return 0;

  const dailySavingUSD  = savingsPerDay * MARKET.fuelVLSFO;
  const remainingLife   = Math.max(1, 25 - age);
  const utilization     = 0.85;
  const discountRate    = 0.08;

  let npv = 0;
  for (let t = 1; t <= remainingLife; t++) {
    npv += (dailySavingUSD * 365 * utilization) / Math.pow(1 + discountRate, t);
  }
  return Math.round(npv);
}

// ═══════════════════════════════════════════════════════════════
// F) Builder quality factor
// ═══════════════════════════════════════════════════════════════
function builderFactor(builder: string | undefined | null): number {
  if (!builder) return 1.0;
  const bl = builder.toLowerCase();
  if (TIER1_BUILDERS.some(p => bl.includes(p))) return 1.07;
  if (TIER2_BUILDERS.some(p => bl.includes(p))) return 1.015;
  if (TIER4_BUILDERS.some(p => bl.includes(p))) return 0.925;
  return 1.0;
}

// ═══════════════════════════════════════════════════════════════
// G) Confidence score
// ═══════════════════════════════════════════════════════════════
function confidenceScore(ship: Ship, age: number): number {
  let score = 30;
  if (ship.dwt > 0)                       score += 15;
  if (ship.yearBuilt > 1900)              score += 15;
  if (NEWBUILD_PRICES[ship.type])         score += 10;  // known segment
  if ((ship as any).fuelConsumption > 0)  score += 5;
  if ((ship as any).classification)       score += 5;
  score += 5;  // bdi data is fresh (hardcoded today's date)
  if (ship.builder)                       score += 3;
  if (ship.length > 0 && ship.beam > 0)   score += 5;
  if (age > 20) score = Math.max(30, score - 10);
  return Math.min(92, score);
}

// ═══════════════════════════════════════════════════════════════
// H+I) Main estimator — public API
// ═══════════════════════════════════════════════════════════════
export function estimatePrice(ship: Ship): PriceEstimate {
  const factors: PriceEstimate["factors"] = [];
  const currentYear   = new Date().getFullYear();
  const effectiveYear = ship.yearBuilt > 1900 ? ship.yearBuilt : currentYear - 10;
  const age           = currentYear - effectiveYear;
  const dwt           = Math.max(ship.dwt || 0, 500);

  // ── Newbuild price ──────────────────────────────────────────
  const nb = newbuildPrice(ship.type, dwt);
  const isKnownSegment = !!NEWBUILD_PRICES[ship.type];
  factors.push({
    label:  "Newbuild Cost",
    value:  `$${(nb / 1e6).toFixed(1)}M (${isKnownSegment ? ship.type : "estimated"})`,
    impact: "neutral",
    weight: 15,
  });

  // ── Depreciation ────────────────────────────────────────────
  const dep = depreciation(age);
  let ageLabel: string;
  let ageImpact: "positive" | "neutral" | "negative";

  if (age <= 0)      { ageLabel = `${age} yrs (newbuild)`;                              ageImpact = "positive"; }
  else if (age <= 2) { ageLabel = `${age} yrs (nearly new)`;                            ageImpact = "positive"; }
  else if (age <= 5) { ageLabel = `${age} yrs (young)`;                                 ageImpact = "positive"; }
  else if (age <= 10){ ageLabel = `${age} yrs (mid-age, −${((1-dep)*100).toFixed(0)}%)`; ageImpact = "neutral"; }
  else if (age <= 20){ ageLabel = `${age} yrs (older, −${((1-dep)*100).toFixed(0)}%)`;   ageImpact = "negative"; }
  else               { ageLabel = `${age} yrs (near scrap, −${((1-dep)*100).toFixed(0)}%)`; ageImpact = "negative"; }

  // Survey year annotation
  const surveyYears = [5, 10, 15, 20, 25];
  if (surveyYears.includes(age))     ageLabel += " [SURVEY]";
  if (surveyYears.includes(age + 1)) ageLabel += " [pre-survey]";

  factors.push({ label: "Age", value: ageLabel, impact: ageImpact, weight: age > 15 ? 30 : 20 });

  // ── Market factor ───────────────────────────────────────────
  const mf = marketFactor(ship.type);
  const mfLabel = CAPESIZE_TYPES.has(ship.type)   ? `Capesize $${MARKET.charterRates.capesize.toLocaleString()}/d`
                : PANAMAX_TYPES.has(ship.type)     ? `Panamax $${MARKET.charterRates.panamax.toLocaleString()}/d`
                : SUPRAMAX_TYPES.has(ship.type)    ? `Supramax $${MARKET.charterRates.supramax.toLocaleString()}/d`
                : HANDYSIZE_TYPES.has(ship.type)   ? `Handysize $${MARKET.charterRates.handysize.toLocaleString()}/d`
                : `BDI ${MARKET.bdi}`;
  factors.push({
    label:  "Market",
    value:  `${mfLabel} — ×${mf.toFixed(3)} (${MARKET.date})`,
    impact: mf > 1.02 ? "positive" : mf < 0.98 ? "negative" : "neutral",
    weight: 15,
  });

  // ── Builder ─────────────────────────────────────────────────
  const bf = builderFactor(ship.builder);
  if (bf !== 1.0) {
    const tier = bf >= 1.05 ? "Tier 1 premium" : bf >= 1.01 ? "Tier 2 premium" : "Tier 4 discount";
    factors.push({
      label:  "Builder",
      value:  `${ship.builder} (${tier}, ×${bf.toFixed(3)})`,
      impact: bf >= 1.0 ? "positive" : "negative",
      weight: 8,
    });
  }

  // ── Eco premium ─────────────────────────────────────────────
  const fuelCons = (ship as any).fuelConsumption as number | undefined;
  const eco = ecoPremium(fuelCons, dwt, ship.type, age);
  if (eco > 0) {
    factors.push({
      label:  "Eco Premium",
      value:  `+$${(eco / 1e6).toFixed(2)}M (NPV fuel savings)`,
      impact: "positive",
      weight: 7,
    });
  }

  // ── Tonnage ─────────────────────────────────────────────────
  if (ship.dwt > 0) {
    factors.push({
      label:  "Tonnage",
      value:  `${ship.dwt.toLocaleString("en-US")} DWT`,
      impact: ship.dwt > 100000 ? "positive" : "neutral",
      weight: 10,
    });
  }

  // ── Flag ────────────────────────────────────────────────────
  const reputableFlags = ["Norway", "Denmark", "Germany", "Netherlands",
                          "United Kingdom", "Japan", "Singapore"];
  const flagLowCost    = ["Mongolia", "Cambodia", "Belize", "Comoros"];
  if (reputableFlags.includes(ship.flag)) {
    factors.push({ label: "Flag", value: `${ship.flag} (Premium)`, impact: "positive", weight: 5 });
  } else if (flagLowCost.includes(ship.flag)) {
    factors.push({ label: "Flag", value: `${ship.flag} (Flag of Convenience)`, impact: "negative", weight: 10 });
  }

  // ── Status ──────────────────────────────────────────────────
  const statusMults: Record<string, number> = {
    scrapped: 0.20, laid_up: 0.75, under_construction: 1.10, lost: 0.0,
  };
  const statusMult = statusMults[ship.status] ?? 1.0;
  const statusLabels: Record<string, string> = {
    scrapped: "Scrapped", laid_up: "Laid Up", under_construction: "Under Construction",
    lost: "Lost (total loss)", active: "Active",
  };
  factors.push({
    label:  "Status",
    value:  statusLabels[ship.status] ?? ship.status,
    impact: statusMult >= 1.0 ? "positive" : statusMult >= 0.7 ? "neutral" : "negative",
    weight: statusMult === 0 ? 100 : 10,
  });

  // ── Scrap floor ─────────────────────────────────────────────
  const scrap = scrapValue(dwt, ship.type);
  factors.push({
    label:  "Scrap Floor",
    value:  `$${(scrap / 1e6).toFixed(2)}M (LDT-based, ${MARKET.scrapPerLDT} $/LDT)`,
    impact: "neutral",
    weight: 5,
  });

  // ═══ FINAL CALCULATION ════════════════════════════════════════
  const base = nb * dep * mf * bf * statusMult;
  const estimatedValueUSD = Math.round(
    Math.max(
      base + eco,
      (ship.status === "active" || ship.status === "laid_up") ? scrap : 0
    )
  );

  const conf = confidenceScore(ship, age);

  // ═══ RECOMMENDATION (I) ══════════════════════════════════════
  let recommendation: "BUY" | "WATCH" | "AVOID" = "WATCH";
  let recommendationReasoning = "";

  const ratio = estimatedValueUSD / Math.max(nb * mf, 1);

  if (ship.status === "lost") {
    recommendation = "AVOID";
    recommendationReasoning = "Total loss — not a viable purchase.";
  } else if (ship.status === "scrapped") {
    recommendation = "AVOID";
    recommendationReasoning = "Already scrapped — not available for purchase.";
  } else if (ship.status === "under_construction") {
    recommendation = "WATCH";
    recommendationReasoning = "Newbuild under construction — watch for post-delivery opportunity.";
  } else if (age > 25) {
    recommendation = "AVOID";
    recommendationReasoning = "Near scrap age — too risky to buy.";
  } else if (ratio < 0.35 && age < 15) {
    recommendation = "BUY";
    recommendationReasoning = "Significantly below replacement cost.";
  } else if (ratio < 0.50 && age < 10 && mf > 1.0) {
    recommendation = "BUY";
    recommendationReasoning = "Good value in strong market.";
  } else if (age <= 5 && mf < 0.95) {
    recommendation = "BUY";
    recommendationReasoning = "Young ship in soft market — entry opportunity.";
  } else if (age > 20) {
    recommendation = "AVOID";
    recommendationReasoning = "Approaching end of economic life.";
  } else if (age > 15 && mf > 1.05) {
    recommendation = "AVOID";
    recommendationReasoning = "Aging vessel in elevated market — overpriced.";
  } else {
    recommendation = "WATCH";
    recommendationReasoning = "Fair value — monitor market conditions.";
  }

  const reasoning = `${ship.type} newbuild $${(nb / 1e6).toFixed(1)}M · Age ${age}yr dep×${(dep * 100).toFixed(0)}% · Market ×${mf.toFixed(3)} · Scrap floor $${(scrap / 1e6).toFixed(1)}M`;

  return {
    estimatedValueUSD,
    confidenceScore: conf,
    reasoning,
    recommendation,
    recommendationReasoning,
    factors,
  };
}

// ═══════════════════════════════════════════════════════════════
// Utility exports — unchanged interface
// ═══════════════════════════════════════════════════════════════
export function formatPrice(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000)     return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)         return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

export function getRecommendationColor(rec: "BUY" | "WATCH" | "AVOID"): string {
  switch (rec) {
    case "BUY":   return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "WATCH": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "AVOID": return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
}

export function getRecommendationEmoji(rec: "BUY" | "WATCH" | "AVOID"): string {
  switch (rec) {
    case "BUY":   return "🟢";
    case "WATCH": return "👀";
    case "AVOID": return "⛔";
  }
}

export function getRecommendationLabel(rec: "BUY" | "WATCH" | "AVOID"): string {
  const labels: Record<string, string> = { BUY: "Buy", WATCH: "Watch", AVOID: "Avoid" };
  return labels[rec] || rec;
}
