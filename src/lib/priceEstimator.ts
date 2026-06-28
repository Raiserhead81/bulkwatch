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

// Base values by ship type (USD, ~5-year-old mid-spec vessel)
// Sources: Clarksons SIN, VesselsValue, Baltic Exchange Q2 2026
const BASE_PRICES: Partial<Record<string, number>> = {
  // ── Bulk Carriers ──────────────────────────────────────
  Valemax:          95_000_000,  // 400k DWT, Vale long-term
  VLOC:             85_000_000,  // 300k+ DWT ore carrier
  Newcastlemax:     65_000_000,  // 210k DWT
  Capesize:         38_000_000,  // 180k DWT
  "Post-Panamax":   32_000_000,
  Kamsarmax:        28_000_000,  // 82k DWT
  Panamax:          22_000_000,  // 75k DWT
  Ultramax:         21_000_000,  // 64k DWT
  Supramax:         19_000_000,  // 58k DWT
  Handymax:         18_000_000,  // 45k DWT
  Handysize:        12_000_000,  // 35k DWT
  "Mini-Bulker":     6_000_000,
  "Bulk Carrier":   22_000_000,  // generic
  Gearless:         25_000_000,
  Geared:           20_000_000,

  // ── Tankers ────────────────────────────────────────────
  "Crude Oil Tanker":    65_000_000,  // Suezmax range
  "Tanker":              45_000_000,  // generic
  "Oil/Chemical Tanker": 35_000_000,
  "Product Tanker":      40_000_000,  // MR tanker
  "Chemical Tanker":     30_000_000,  // IMO II/III
  "LNG Tanker":         200_000_000,  // 160k m³ TFDE
  "LPG Tanker":          75_000_000,  // VLGC
  VLCC:                 100_000_000,
  Suezmax:               65_000_000,
  Aframax:               50_000_000,

  // ── Container Ships ────────────────────────────────────
  "Container Ship":      55_000_000,  // ~5000 TEU generic
  ULCV:                 150_000_000,  // 18k+ TEU
  "Neo-Panamax":         80_000_000,  // 14k TEU
  Feeder:                20_000_000,

  // ── General Cargo / Multi ──────────────────────────────
  "General Cargo":       12_000_000,
  Multipurpose:          18_000_000,
  Reefer:                15_000_000,
  "Heavy Lift":          40_000_000,

  // ── RoRo / Car Carriers ────────────────────────────────
  RoRo:                  35_000_000,
  RoPax:                 50_000_000,
  "Car Carrier":         70_000_000,  // PCTC 6500 CEU

  // ── Passenger ──────────────────────────────────────────
  Passenger:             30_000_000,
  "Cruise Ship":        200_000_000,
  Ferry:                 20_000_000,

  // ── Offshore / Special ─────────────────────────────────
  Offshore:              20_000_000,
  OSV:                   15_000_000,
  Tug:                    4_000_000,
  Dredger:               25_000_000,
  "Cable Ship":          60_000_000,
  "Research Vessel":     30_000_000,

  // ── Fallback ───────────────────────────────────────────
  Other:                 10_000_000,
};

// Market indicators — update periodically (source: Baltic Exchange / tradingeconomics.com)
const MARKET_FACTORS = {
  bdiCurrent: 2524,        // Baltic Dry Index — 28 Jun 2026
  bdiTrend: "rising" as "rising" | "stable" | "falling",  // -45% from Jan peak
  bdiDate: "28 Jun 2026",
  freightRateMultiplier: 1.0,
};

// DWT-zu-Wert Multiplikator (pro tausend DWT)
const DWT_VALUE_PER_1000 = 250; // USD pro 1000 DWT

/**
 * Berechnet eine Preis-Schätzung für ein Schiff basierend auf:
 * - Typ (Basispreis)
 * - Baujahr (Altersabschlag)
 * - DWT (Größenbonus)
 * - Flag ( regulatorische Faktoren)
 * - Status (aktiv, stillgelegt, etc.)
 */
export function estimatePrice(ship: Ship): PriceEstimate {
  const basePrice = BASE_PRICES[ship.type] ?? BASE_PRICES["Other"] ?? 10_000_000;
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
  let ageMultiplier = 1.0;
  if (age <= 2) {
    ageMultiplier = 1.05;
    factors.push({
      label: "Age",
      value: `${age} yrs (nearly new)`,
      impact: "positive",
      weight: 30,
    });
  } else if (age <= 5) {
    ageMultiplier = 1.0;
    factors.push({
      label: "Age",
      value: `${age} yrs (young)`,
      impact: "positive",
      weight: 25,
    });
  } else if (age <= 10) {
    ageMultiplier = 0.85;
    factors.push({
      label: "Age",
      value: `${age} yrs (mid-age)`,
      impact: "neutral",
      weight: 20,
    });
  } else if (age <= 15) {
    ageMultiplier = 0.65;
    factors.push({
      label: "Age",
      value: `${age} yrs (older)`,
      impact: "negative",
      weight: 25,
    });
  } else if (age <= 20) {
    ageMultiplier = 0.45;
    factors.push({
      label: "Age",
      value: `${age} yrs (old)`,
      impact: "negative",
      weight: 30,
    });
  } else if (age <= 25) {
    ageMultiplier = 0.30;
    factors.push({
      label: "Age",
      value: `${age} yrs (very old)`,
      impact: "negative",
      weight: 35,
    });
    confidenceScore -= 10;
  } else {
    ageMultiplier = 0.15;
    factors.push({
      label: "Age",
      value: `${age} yrs (scrap-ready)`,
      impact: "negative",
      weight: 40,
    });
    confidenceScore -= 20;
  }
  priceMultiplier *= ageMultiplier;

  // 2. DWT-Größenbonus
  const dwtBonus = (ship.dwt / 1000) * DWT_VALUE_PER_1000;
  const dwtBonusPercent = dwtBonus / basePrice;
  if (dwtBonusPercent > 0.1) {
    factors.push({
      label: "Tonnage",
      value: `${ship.dwt.toLocaleString("en-US")} DWT (large)`,
      impact: "positive",
      weight: 15,
    });
  } else if (dwtBonusPercent > 0.05) {
    factors.push({
      label: "Tonnage",
      value: `${ship.dwt.toLocaleString("en-US")} DWT`,
      impact: "neutral",
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
