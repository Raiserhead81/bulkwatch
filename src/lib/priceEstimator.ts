// Vessel value estimation — Power-Law × Exponential Depreciation
// Synchronized with valuation page broker model (Q2 2026)
// Sources: Clarksons, Baltic Exchange, NautiSNP, Xclusiv Shipbrokers

import type { Ship, BulkCarrierType } from "@/data/ships";

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

// ═══ BROKER MODEL (same as valuation/page.tsx) ═══
// Power-Law: newbuild = A × DWT^(1-B)
// Depreciation: exp(-rate × (age-5)), floor as minimum
const SIZE_PARAMS: Record<string, [number, number, number, number]> = {
  small:  [2100, 0.10, 0.057, 0.10],  // <10k DWT
  medium: [1600, 0.10, 0.057, 0.10],  // 10-40k DWT
  large:  [14200, 0.32, 0.057, 0.10], // 40-100k DWT
  vlarge: [1100, 0.10, 0.057, 0.40],  // >100k DWT
};

const TYPE_MULT: Record<string, number> = {
  "VLCC": 1.15, "Suezmax": 1.15, "Aframax": 1.20,
  "Product Tanker": 1.30, "Chemical Tanker": 1.80, "Oil/Chemical Tanker": 1.50,
  "Crude Oil Tanker": 1.15, "Tanker": 1.20,
  "LNG Tanker": 2.50, "LPG Tanker": 1.60,
  "Container Ship": 1.10, "ULCV": 1.30, "Neo-Panamax": 1.20, "Feeder": 1.15,
  "Car Carrier": 2.00, "RoRo": 1.40, "RoPax": 1.60,
  "Cruise Ship": 3.00, "Passenger": 2.50, "Ferry": 1.50,
  "Reefer": 1.30, "Multipurpose": 1.20, "Heavy Lift": 1.50,
  "Offshore": 1.80, "OSV": 1.80, "Tug": 2.50, "Dredger": 1.50,
};

const BULK_TYPES = new Set([
  "General Cargo", "Bulk Carrier", "Handymax", "Handysize", "Mini-Bulker",
  "Capesize", "Newcastlemax", "Valemax", "VLOC", "Kamsarmax", "Panamax",
  "Post-Panamax", "Supramax", "Ultramax", "Gearless", "Geared",
]);

const PREMIUM_BUILDERS = ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi", "namura", "mitsubishi", "mitsui", "kawasaki", "jmu"];
const DISCOUNT_BUILDERS = ["huelva", "navantia", "astilleros", "constanta", "mangalia", "gdynia"];

// Market indicators — update periodically
const MARKET_FACTORS = {
  bdiCurrent: 2490,
  bdiTrend: "stable" as "rising" | "stable" | "falling",
  bdiDate: "30 Jun 2026",
};

function getSizeClass(dwt: number): string {
  if (dwt < 10000) return "small";
  if (dwt < 40000) return "medium";
  if (dwt < 100000) return "large";
  return "vlarge";
}

export function estimatePrice(ship: Ship): PriceEstimate {
  const factors: PriceEstimate["factors"] = [];
  const currentYear = new Date().getFullYear();
  const effectiveYear = ship.yearBuilt > 1900 ? ship.yearBuilt : currentYear - 10;
  const age = currentYear - effectiveYear;
  const dwt = Math.max(ship.dwt, 500);

  let confidenceScore =
    ship.dwt > 0 && ship.yearBuilt > 1900 && ship.length > 0 ? 72 :
    ship.dwt > 0 && ship.yearBuilt > 1900 ? 58 :
    ship.dwt > 0 ? 45 : 30;

  // 1. Size class & newbuild price (Power-Law)
  const sc = getSizeClass(dwt);
  const [A, B, rate, floor] = SIZE_PARAMS[sc];
  const newbuild = A * Math.pow(dwt, 1 - B);

  factors.push({ label: "Newbuild Cost", value: `$${(newbuild / 1e6).toFixed(1)}M (${sc})`, impact: "neutral", weight: 15 });

  // 2. Type multiplier (non-bulk types get a premium)
  let tm = 1.0;
  if (!BULK_TYPES.has(ship.type)) {
    tm = TYPE_MULT[ship.type] || 1.0;
  }
  if (tm !== 1.0) {
    factors.push({ label: "Type Premium", value: `×${tm.toFixed(2)}`, impact: tm > 1 ? "positive" : "negative", weight: 10 });
  }

  // 3. Age depreciation (exponential)
  let ad: number;
  let ageLabel: string;
  let ageImpact: "positive" | "neutral" | "negative";
  if (age < 0) { ad = 1.10; ageLabel = `${age} yrs (newbuild)`; ageImpact = "positive"; }
  else if (age <= 2) { ad = 1.05; ageLabel = `${age} yrs (nearly new)`; ageImpact = "positive"; }
  else if (age <= 5) { ad = 1.0; ageLabel = `${age} yrs (young)`; ageImpact = "positive"; }
  else {
    ad = Math.max(floor, Math.exp(-rate * (age - 5)));
    if (age <= 10) { ageLabel = `${age} yrs (mid-age, −${((1 - ad) * 100).toFixed(0)}%)`; ageImpact = "neutral"; }
    else if (age <= 20) { ageLabel = `${age} yrs (older, −${((1 - ad) * 100).toFixed(0)}%)`; ageImpact = "negative"; }
    else { ageLabel = `${age} yrs (near scrap, −${((1 - ad) * 100).toFixed(0)}%)`; ageImpact = "negative"; confidenceScore -= 10; }
  }
  factors.push({ label: "Age", value: ageLabel, impact: ageImpact, weight: age > 15 ? 30 : 20 });

  // 4. Builder quality
  let bf = 1.0;
  if (ship.builder) {
    const bl = ship.builder.toLowerCase();
    if (PREMIUM_BUILDERS.some(p => bl.includes(p))) {
      bf = 1.05;
      factors.push({ label: "Builder", value: `${ship.builder} (premium)`, impact: "positive", weight: 8 });
    } else if (DISCOUNT_BUILDERS.some(d => bl.includes(d))) {
      bf = 0.92;
      factors.push({ label: "Builder", value: `${ship.builder} (discount)`, impact: "negative", weight: 8 });
    }
  }

  // 5. DWT info
  if (ship.dwt > 0) {
    factors.push({ label: "Tonnage", value: `${ship.dwt.toLocaleString("en-US")} DWT`, impact: ship.dwt > 100000 ? "positive" : "neutral", weight: 10 });
  }

  // 6. Flag
  const reputableFlags = ["Norway", "Denmark", "Germany", "Netherlands", "United Kingdom", "Japan", "Singapore"];
  const flagLowCost = ["Mongolia", "Cambodia", "Belize", "Comoros"];
  if (reputableFlags.includes(ship.flag)) {
    factors.push({ label: "Flag", value: `${ship.flag} (Premium)`, impact: "positive", weight: 5 });
  } else if (flagLowCost.includes(ship.flag)) {
    confidenceScore -= 5;
    factors.push({ label: "Flag", value: `${ship.flag} (Flag of Convenience)`, impact: "negative", weight: 10 });
  }

  // 7. Status
  let statusMult = 1.0;
  if (ship.status === "scrapped") {
    statusMult = 0.20; confidenceScore -= 30;
    factors.push({ label: "Status", value: "Scrapped", impact: "negative", weight: 50 });
  } else if (ship.status === "laid_up") {
    statusMult = 0.70;
    factors.push({ label: "Status", value: "Laid Up", impact: "negative", weight: 15 });
  } else if (ship.status === "under_construction") {
    statusMult = 1.15;
    factors.push({ label: "Status", value: "Under Construction", impact: "positive", weight: 20 });
  } else if (ship.status === "lost") {
    statusMult = 0;
    factors.push({ label: "Status", value: "Lost (total loss)", impact: "negative", weight: 100 });
  } else {
    factors.push({ label: "Status", value: "Active", impact: "positive", weight: 10 });
  }

  // 8. Market (BDI)
  let marketMult = 1.0;
  const bdiLabel = `BDI ${MARKET_FACTORS.bdiCurrent} (${MARKET_FACTORS.bdiDate})`;
  if (MARKET_FACTORS.bdiCurrent > 3000) {
    marketMult = 1.12;
    factors.push({ label: "Market", value: `${bdiLabel} — strong`, impact: "positive", weight: 15 });
  } else if (MARKET_FACTORS.bdiCurrent > 1500) {
    marketMult = 1.04;
    factors.push({ label: "Market", value: `${bdiLabel} — firm`, impact: "positive", weight: 8 });
  } else if (MARKET_FACTORS.bdiCurrent > 800) {
    factors.push({ label: "Market", value: `${bdiLabel} — normal`, impact: "neutral", weight: 8 });
  } else {
    marketMult = 0.85;
    factors.push({ label: "Market", value: `${bdiLabel} — weak`, impact: "negative", weight: 12 });
  }

  // ═══ FINAL CALCULATION ═══
  // newbuild × type × age_depreciation × builder × status × market
  const raw = newbuild * tm * ad * bf * statusMult * marketMult;
  const scrapValue = dwt * 0.20 * 480;
  const estimatedValueUSD = Math.max(Math.round(raw), ship.status === "active" ? Math.round(scrapValue) : 0);

  confidenceScore = Math.max(20, Math.min(95, confidenceScore));

  // Buy/Hold/Sell
  let recommendation: "BUY" | "WATCH" | "AVOID" = "WATCH";
  let recommendationReasoning = "";

  if (ship.status === "lost") {
    recommendation = "AVOID";
    recommendationReasoning = "Total loss — not a viable purchase.";
  } else if (ship.status === "scrapped") {
    recommendation = "AVOID";
    recommendationReasoning = "Already scrapped — not available for purchase.";
  } else if (ship.status === "under_construction") {
    recommendation = "WATCH";
    recommendationReasoning = "Newbuild under construction — watch for post-delivery purchase opportunity.";
  } else if (age > 25) {
    recommendation = "AVOID";
    recommendationReasoning = "Near scrap age — too risky to buy, minimal remaining value.";
  } else if (age > 15 && MARKET_FACTORS.bdiCurrent > 2000) {
    recommendation = "AVOID";
    recommendationReasoning = "Aging vessel in elevated market — overpriced, wait for correction.";
  } else if (age <= 5 && MARKET_FACTORS.bdiCurrent > 1500) {
    recommendation = "WATCH";
    recommendationReasoning = "Young ship in strong market — likely to appreciate, watch for dip.";
  } else if (age <= 5 && MARKET_FACTORS.bdiTrend === "falling") {
    recommendation = "BUY";
    recommendationReasoning = "Young ship with declining BDI — good entry point to buy.";
  } else if (age <= 10 && ship.dwt > 100000) {
    recommendation = "BUY";
    recommendationReasoning = "Large vessel in prime life phase. Strong ore demand — buy opportunity.";
  } else if (ship.dwt < 40000 && MARKET_FACTORS.bdiCurrent < 1000) {
    recommendation = "AVOID";
    recommendationReasoning = "Small ship in weak market — too volatile, wait for recovery.";
  } else if (ship.type === "Valemax" || ship.type === "VLOC") {
    recommendation = "WATCH";
    recommendationReasoning = "Specialized VLOC — long-term contracts, stable income. Watch for availability.";
  } else {
    recommendation = "WATCH";
    recommendationReasoning = "Balanced risk-return profile. Monitor market before buying.";
  }

  const reasoning = `${ship.type} newbuild $${(newbuild * tm / 1e6).toFixed(1)}M · Age ${age}yr (×${(ad * 100).toFixed(0)}%) · BDI ${MARKET_FACTORS.bdiCurrent} ${MARKET_FACTORS.bdiTrend} · Scrap floor $${(scrapValue / 1e6).toFixed(1)}M`;

  return { estimatedValueUSD, confidenceScore, reasoning, recommendation, recommendationReasoning, factors };
}

export function formatPrice(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

export function getRecommendationColor(rec: "BUY" | "WATCH" | "AVOID"): string {
  switch (rec) {
    case "BUY": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "WATCH": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "AVOID": return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
}

export function getRecommendationEmoji(rec: "BUY" | "WATCH" | "AVOID"): string {
  switch (rec) {
    case "BUY": return "🟢";
    case "WATCH": return "👀";
    case "AVOID": return "⛔";
  }
}

export function getRecommendationLabel(rec: "BUY" | "WATCH" | "AVOID"): string {
  const labels: Record<string, string> = { BUY: "Buy", WATCH: "Watch", AVOID: "Avoid" };
  return labels[rec] || rec;
}
