// Vessel value estimation based on ship type, age, DWT and market conditions
// Sources: Clarksons, Baltic Exchange, VesselsValue comps (Q2 2026)

import type { Ship, BulkCarrierType } from "@/data/ships";

export interface PriceEstimate {
  estimatedValueUSD: number;
  confidenceScore: number; // 0-100
  reasoning: string;
  recommendation: "BUY" | "HOLD" | "SELL";
  recommendationReasoning: string;
  factors: Array<{
    label: string;
    value: string;
    impact: "positive" | "neutral" | "negative";
    weight: number;
  }>;
}

// Base values by ship type (USD, ~5-year-old mid-spec vessel, Japanese/Korean build)
// Calibrated against Q2 2026 S&P market data:
//   Handysize 35k DWT 2011 build = $10-14M → 5yr-old base ~$18M, 15yr×0.55=$9.9M ✓
//   Panamax 77k DWT 2004 build = $9M → 5yr-old base ~$25M, 22yr×0.22=$5.5M (too low, DWT bonus lifts)
//   Capesize 181k DWT 2012 = $35M → 5yr-old base ~$52M, 14yr×0.55=$28.6M+DWT ✓
//   Newcastlemax 210k DWT 2021 = $76M → 5yr-old base ~$72M, 5yr×1.0=$72M ✓
//   General Cargo 5k DWT 2023 = $4.25M → 5yr-old base ~$8M, 3yr×1.0=$8M (DWT tiny) ✓
const BASE_PRICES: Partial<Record<string, number>> = {
  // ── Bulk Carriers (calibrated vs Clarksons/NautiSNP Jun 2026) ──
  Valemax:          95_000_000,  // 400k DWT, Vale long-term
  VLOC:             85_000_000,  // 300k+ DWT ore carrier
  Newcastlemax:     72_000_000,  // 210k DWT — Nord Palladium 2021=$76M
  Capesize:         52_000_000,  // 180k DWT — 10yr benchmark $52.5M
  "Post-Panamax":   35_000_000,
  Kamsarmax:        32_000_000,  // 82k DWT — 10yr benchmark $26.5M
  Panamax:          25_000_000,  // 75k DWT
  Ultramax:         28_000_000,  // 64k DWT — 10yr benchmark $26.5M
  Supramax:         22_000_000,  // 58k DWT
  Handymax:         18_000_000,  // 45k DWT
  Handysize:        15_000_000,  // 35k DWT — 10yr benchmark $20.25M
  "Mini-Bulker":     5_000_000,
  "Bulk Carrier":   20_000_000,  // generic fallback
  Gearless:         28_000_000,
  Geared:           22_000_000,

  // ── Tankers ────────────────────────────────────────────
  "Crude Oil Tanker":    70_000_000,  // Suezmax range
  "Tanker":              45_000_000,  // generic
  "Oil/Chemical Tanker": 35_000_000,
  "Product Tanker":      42_000_000,  // MR tanker
  "Chemical Tanker":     32_000_000,  // IMO II/III
  "LNG Tanker":         220_000_000,  // 174k m³ — newbuild $250M+
  "LPG Tanker":          80_000_000,  // VLGC
  VLCC:                 110_000_000,
  Suezmax:               70_000_000,
  Aframax:               55_000_000,

  // ── Container Ships ────────────────────────────────────
  "Container Ship":      40_000_000,  // ~5000 TEU generic (post-2022 crash)
  ULCV:                 160_000_000,  // 18k+ TEU
  "Neo-Panamax":         90_000_000,  // 14k TEU
  Feeder:                18_000_000,

  // ── General Cargo / Multi ──────────────────────────────
  "General Cargo":        8_000_000,  // wide range 3-15M depending on size
  Multipurpose:          16_000_000,
  Reefer:                12_000_000,
  "Heavy Lift":          40_000_000,

  // ── RoRo / Car Carriers ────────────────────────────────
  RoRo:                  30_000_000,
  RoPax:                 45_000_000,
  "Car Carrier":         65_000_000,  // PCTC 6500 CEU — market very hot

  // ── Passenger ──────────────────────────────────────────
  Passenger:             25_000_000,
  "Cruise Ship":        180_000_000,
  Ferry:                 18_000_000,

  // ── Offshore / Special ─────────────────────────────────
  Offshore:              18_000_000,
  OSV:                   12_000_000,
  Tug:                    3_000_000,
  Dredger:               22_000_000,
  "Cable Ship":          55_000_000,
  "Research Vessel":     25_000_000,

  // ── Fallback ───────────────────────────────────────────
  Other:                  8_000_000,
};

// Market indicators — update periodically (source: Baltic Exchange / tradingeconomics.com)
const MARKET_FACTORS = {
  bdiCurrent: 2490,        // Baltic Dry Index — 28 Jun 2026
  bdiTrend: "stable" as "rising" | "stable" | "falling",
  bdiDate: "29 Jun 2026",
  freightRateMultiplier: 1.0,
};

// DWT-zu-Wert Multiplikator (pro tausend DWT) — calibrated:
// A 35k DWT Handysize should get ~$3M bonus on top of base
// 35 × 85 = $2.975M ✓
const DWT_VALUE_PER_1000 = 85; // USD pro 1000 DWT (was 250, too high)

/**
 * Berechnet eine Preis-Schätzung für ein Schiff basierend auf:
 * - Typ (Basispreis)
 * - Baujahr (Altersabschlag)
 * - DWT (Größenbonus)
 * - Flag ( regulatorische Faktoren)
 * - Status (aktiv, stillgelegt, etc.)
 */
export function estimatePrice(ship: Ship): PriceEstimate {
  // DWT-adjusted base price: larger ships within the same type are worth more
  // A 47k DWT "General Cargo" should price closer to Handymax than a 5k DWT one
  let basePrice = BASE_PRICES[ship.type] ?? BASE_PRICES["Other"] ?? 8_000_000;
  if (ship.dwt > 0) {
    // DWT scaling: price per DWT is roughly $300-500/DWT for bulk, less for others
    const dwtBase = ship.dwt * 350; // $/DWT for a 5yr old bulk ship
    // Use the higher of type-base or DWT-base, blended
    const dwtEstimate = Math.max(dwtBase, basePrice);
    basePrice = basePrice * 0.4 + dwtEstimate * 0.6; // 60% DWT-driven, 40% type-driven
  }
  const factors: PriceEstimate["factors"] = [];
  let priceMultiplier = 1.0;
  // Start confidence based on available data quality
  let confidenceScore =
    ship.dwt > 0 && ship.yearBuilt > 1900 && ship.length > 0 ? 72 :
    ship.dwt > 0 && ship.yearBuilt > 1900 ? 58 :
    ship.dwt > 0 ? 45 : 30;

  // 1. Alter (größter Faktor)
  const currentYear = new Date().getFullYear();
  // yearBuilt=0 means unknown — treat conservatively as mid-age (10 years)
  const effectiveYear = ship.yearBuilt > 1900 ? ship.yearBuilt : currentYear - 10;
  const age = currentYear - effectiveYear;
  // Age depreciation curve — calibrated against Q2 2026 S&P comps:
  //   5yr-old: 100% (benchmark)     | 10yr: ~75%     | 15yr: ~55%
  //  20yr: ~35%                      | 25yr: ~22%     | 30yr: ~15% (scrap floor)
  // Real market: old ships hold value better than straight-line due to scrap floor
  let ageMultiplier = 1.0;
  let ageLabel = "";
  let ageImpact: "positive" | "neutral" | "negative" = "neutral";
  if (age <= 2) {
    ageMultiplier = 1.08;
    ageLabel = `${age} yrs (nearly new)`;
    ageImpact = "positive";
  } else if (age <= 5) {
    ageMultiplier = 1.0;
    ageLabel = `${age} yrs (young)`;
    ageImpact = "positive";
  } else if (age <= 10) {
    // Linear from 1.0 to 0.75 over 5 years
    ageMultiplier = 1.0 - (age - 5) * 0.05;
    ageLabel = `${age} yrs (mid-age)`;
    ageImpact = "neutral";
  } else if (age <= 15) {
    // Linear from 0.75 to 0.55
    ageMultiplier = 0.75 - (age - 10) * 0.04;
    ageLabel = `${age} yrs (older)`;
    ageImpact = "negative";
  } else if (age <= 20) {
    // Linear from 0.55 to 0.35
    ageMultiplier = 0.55 - (age - 15) * 0.04;
    ageLabel = `${age} yrs (old)`;
    ageImpact = "negative";
  } else if (age <= 25) {
    // Slower decline — approaching scrap floor
    ageMultiplier = 0.35 - (age - 20) * 0.03;
    ageLabel = `${age} yrs (very old)`;
    ageImpact = "negative";
    confidenceScore -= 10;
  } else {
    // Scrap floor: never below ~12% (steel value)
    ageMultiplier = Math.max(0.12, 0.20 - (age - 25) * 0.02);
    ageLabel = `${age} yrs (near scrap age)`;
    ageImpact = "negative";
    confidenceScore -= 20;
  }
  factors.push({ label: "Age", value: ageLabel, impact: ageImpact, weight: age > 15 ? 30 : 20 });
  priceMultiplier *= ageMultiplier;

  // 2. DWT info (already factored into base price above)
  if (ship.dwt > 0) {
    factors.push({
      label: "Tonnage",
      value: `${ship.dwt.toLocaleString("en-US")} DWT`,
      impact: ship.dwt > 100000 ? "positive" : "neutral",
      weight: 10,
    });
  }

  // 3. Flag/Regulatorik
  const reputableFlags = [
    "Norway",
    "Denmark",
    "Germany",
    "Netherlands",
    "United Kingdom",
    "Japan",
    "Singapore",
  ];
  const flagCompliant = ["Panama", "Liberia", "Marshall Islands", "Hong Kong"];
  const flagLowCost = ["Mongolia", "Cambodia", "Belize", "Comoros"];

  if (reputableFlags.includes(ship.flag)) {
    priceMultiplier *= 1.02;
    factors.push({
      label: "Flag",
      value: `${ship.flag} (Premium)`,
      impact: "positive",
      weight: 8,
    });
  } else if (flagCompliant.includes(ship.flag)) {
    factors.push({
      label: "Flag",
      value: `${ship.flag} (Standard)`,
      impact: "neutral",
      weight: 5,
    });
  } else if (flagLowCost.includes(ship.flag)) {
    priceMultiplier *= 0.95;
    factors.push({
      label: "Flag",
      value: `${ship.flag} (Flag of Convenience)`,
      impact: "negative",
      weight: 10,
    });
    confidenceScore -= 5;
  }

  // 3b. Builder quality premium/discount
  if (ship.builder) {
    const b = ship.builder.toLowerCase();
    const premiumBuilders = ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi", "namura", "mitsubishi", "mitsui", "kawasaki", "jmu"];
    const standardBuilders = ["yangzijiang", "new times", "bohai", "cosco", "dalian", "shanghai"];
    const discountBuilders = ["spain", "spanish", "huelva", "navantia", "astilleros", "juliana", "constanta", "mangalia", "gdynia", "split"];

    if (premiumBuilders.some(p => b.includes(p))) {
      priceMultiplier *= 1.05;
      factors.push({ label: "Builder", value: `${ship.builder} (premium yard)`, impact: "positive" as const, weight: 8 });
    } else if (discountBuilders.some(d => b.includes(d))) {
      priceMultiplier *= 0.90;
      factors.push({ label: "Builder", value: `${ship.builder} (discount)`, impact: "negative" as const, weight: 8 });
    } else if (standardBuilders.some(s => b.includes(s))) {
      factors.push({ label: "Builder", value: `${ship.builder} (standard)`, impact: "neutral" as const, weight: 5 });
    }
  }

  // 4. Status (aktiv, stillgelegt, verschrottet, verloren)
  if (ship.status === "scrapped") {
    priceMultiplier *= 0.20;
    factors.push({
      label: "Status",
      value: "Scrapped (scrap value)",
      impact: "negative",
      weight: 50,
    });
    confidenceScore -= 30;
  } else if (ship.status === "laid_up") {
    priceMultiplier *= 0.70;
    factors.push({
      label: "Status",
      value: "Laid Up",
      impact: "negative",
      weight: 15,
    });
  } else if (ship.status === "under_construction") {
    priceMultiplier *= 1.15;
    factors.push({
      label: "Status",
      value: "Under Construction (newbuild premium)",
      impact: "positive",
      weight: 20,
    });
  } else if (ship.status === "lost") {
    priceMultiplier *= 0;
    factors.push({
      label: "Status",
      value: "Lost (total loss)",
      impact: "negative",
      weight: 100,
    });
    confidenceScore -= 50;
  } else {
    factors.push({
      label: "Status",
      value: "Active in Service",
      impact: "positive",
      weight: 10,
    });
  }

  // 5. Bauwerft-Qualität
  const premiumBuilders = [
    "Hyundai Heavy Industries",
    "Mitsubishi Heavy Industries",
    "Daewoo Shipbuilding",
    "Imabari Shipbuilding",
    "Namura Shipbuilding",
    "Shanghai Waigaoqiao",
  ];
  if (ship.builder && premiumBuilders.includes(ship.builder)) {
    priceMultiplier *= 1.03;
    factors.push({
      label: "Shipyard",
      value: `${ship.builder} (Premium)`,
      impact: "positive",
      weight: 7,
    });
  }

  // 6. Market conditions (BDI — bulk carrier proxy; tanker/container use own indices)
  const bdiLabel = `BDI ${MARKET_FACTORS.bdiCurrent} (${MARKET_FACTORS.bdiDate})`;
  if (MARKET_FACTORS.bdiCurrent > 3000) {
    priceMultiplier *= 1.12;
    factors.push({ label: "Market", value: `${bdiLabel} — strong`, impact: "positive", weight: 15 });
  } else if (MARKET_FACTORS.bdiCurrent > 1500) {
    priceMultiplier *= 1.04;
    factors.push({ label: "Market", value: `${bdiLabel} — firm`, impact: "positive", weight: 8 });
  } else if (MARKET_FACTORS.bdiCurrent > 800) {
    factors.push({ label: "Market", value: `${bdiLabel} — normal`, impact: "neutral", weight: 8 });
  } else {
    priceMultiplier *= 0.85;
    factors.push({ label: "Market", value: `${bdiLabel} — weak`, impact: "negative", weight: 12 });
  }

  // Endpreis berechnen
  // Scrap value as floor: ~$450/LDT, LDT ≈ 0.35 * DWT for bulk carriers
  const scrapValueUSD = Math.round(ship.dwt * 0.35 * 450);
  const rawEstimate = Math.round((basePrice + dwtBonus) * priceMultiplier);
  const estimatedValueUSD = Math.max(rawEstimate, ship.status === "active" ? scrapValueUSD : 0);

  // Konfidenz-Score anpassen
  confidenceScore = Math.max(20, Math.min(95, confidenceScore));

  // Buy/Hold/Sell Empfehlung
  let recommendation: "BUY" | "HOLD" | "SELL" = "HOLD";
  let recommendationReasoning = "";

  if (ship.status === "under_construction") {
    recommendation = "HOLD";
    recommendationReasoning = "Newbuild under construction. Value depends on delivery date and yard reputation. Resale at premium possible in strong markets.";
  }

  if (ship.status === "lost") {
    recommendation = "SELL";
    recommendationReasoning =
      "Ship is lost — no resale value. Check insurance scrap value.";
  } else if (ship.status === "scrapped") {
    recommendation = "SELL";
    recommendationReasoning =
      "Ship already scrapped. Scrap value noted, not an investment.";
  } else if (age > 25) {
    recommendation = "SELL";
    recommendationReasoning =
      "Scrap-ready. Sell before further depreciation. Steel price (~$500/t) as minimum reference.";
  } else if (age > 15 && MARKET_FACTORS.bdiCurrent > 2000) {
    recommendation = "SELL";
    recommendationReasoning =
      "BDI elevated (2,500+) but trending down — sell window is now. Age factor compounds risk.";
  } else if (age <= 5 && MARKET_FACTORS.bdiCurrent > 1500) {
    recommendation = "HOLD";
    recommendationReasoning =
      "Young ship in a good market — value appreciation likely. Selling in 2-3 years may be better.";
  } else if (age <= 5 && MARKET_FACTORS.bdiTrend === "falling") {
    recommendation = "BUY";
    recommendationReasoning =
      "Young ship with BDI declining — prices softening. Entry opportunity before next freight cycle upturn.";
  } else if (age <= 10 && ship.dwt > 100000) {
    recommendation = "BUY";
    recommendationReasoning =
      "Large ship in prime life phase. Capesize/VLOCs benefit strongly from ore freight demand.";
  } else if (ship.dwt < 40000 && MARKET_FACTORS.bdiCurrent < 1000) {
    recommendation = "SELL";
    recommendationReasoning =
      "Small ship in weak market — Handysize vessels are most sensitive to freight rate fluctuations.";
  } else if (ship.type === "Valemax" || ship.type === "VLOC") {
    recommendation = "HOLD";
    recommendationReasoning =
      "Specialized VLOCs have long-term contracts with Vale — stable income but limited buyer pool.";
  } else {
    recommendation = "HOLD";
    recommendationReasoning =
      "Balanced risk-return. Market monitoring recommended depending on freight rate developments.";
  }

  // Reasoning-Text für Preis
  const reasoning = `${ship.type} base $${(basePrice / 1_000_000).toFixed(0)}M · Age ${age} yrs (×${Math.round(ageMultiplier * 100)}%) · BDI ${MARKET_FACTORS.bdiCurrent} ${MARKET_FACTORS.bdiTrend} (${MARKET_FACTORS.bdiDate}) · Scrap floor $${(scrapValueUSD / 1_000_000).toFixed(1)}M. Confidence ${confidenceScore}% — ${ship.dwt > 0 && ship.yearBuilt > 1900 ? "specs available" : "limited data"}.`;

  return {
    estimatedValueUSD,
    confidenceScore,
    reasoning,
    recommendation,
    recommendationReasoning,
    factors,
  };
}

// Hilfsfunktion: Schätzwert formatieren
export function formatPrice(usd: number): string {
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(2)}M`;
  } else if (usd >= 1_000) {
    return `$${(usd / 1_000).toFixed(0)}K`;
  }
  return `$${usd}`;
}

// Hilfsfunktion: Recommendation-Farbe
export function getRecommendationColor(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "HOLD":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "SELL":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
}

// Hilfsfunktion: Recommendation-Emoji
export function getRecommendationEmoji(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "🟢";
    case "HOLD":
      return "🟡";
    case "SELL":
      return "🔴";
  }
}

// Hilfsfunktion: Recommendation-Text (Deutsch)
export function getRecommendationLabel(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "BUY";
    case "HOLD":
      return "HOLD";
    case "SELL":
      return "SELL";
  }
}
