// Vessel value estimation — Hedonic Pricing Model v4.1
// Segment-specific newbuild prices × survey-cycle depreciation × segment market factor
// ALL parameters loaded from shared db/model_params.json (single source of truth with Python).
// Market data loaded from db/opex_rates.json (live, updated daily by cron).
// Sources: Clarksons, Baltic Exchange, NautiSNP, Xclusiv Shipbrokers

import type { Ship } from "@/data/ships";
import * as fs from "fs";
import * as path from "path";

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
// Load shared model parameters from JSON
// ═══════════════════════════════════════════════════════════════
interface ModelParams {
  newbuildPrices: Record<string, { dwt: number; nb: number }>;
  fallbackTypeMult: Record<string, number>;
  depreciation: { brackets: DepBracket[] };
  segmentGroups: Record<string, string[]>;
  marketFactorBaselines: Record<string, { defaultRate: number; baseline: number }>;
  tankerPremium: { factor: number; types: string[] };
  builderTiers: Record<string, { factor: number; keywords: string[] }>;
  ldtRatios: Record<string, number>;
  ecoBenchmarks: Record<string, number>;
}

interface DepBracket {
  maxAge: number;
  value?: number;
  startValue?: number;
  slope?: number;
  fromAge?: number;
  floor?: number;
}

interface MarketData {
  bdi: number;
  charterRates: { capesize: number; panamax: number; supramax: number; handysize: number };
  scrapPerLDT: number;
  fuelVLSFO: number;
  date: string;
}

const MODEL_PARAMS_PATH = path.join(process.cwd(), "db", "model_params.json");
const OPEX_RATES_PATH   = path.join(process.cwd(), "db", "opex_rates.json");

// Fallback hardcoded values (used if files don't exist)
const FALLBACK_MARKET: MarketData = {
  bdi:          2562,
  charterRates: { capesize: 29000, panamax: 21500, supramax: 24000, handysize: 13500 },
  scrapPerLDT:  478,
  fuelVLSFO:    512,
  date:         "fallback",
};

function loadModelParams(): ModelParams {
  try {
    const raw = fs.readFileSync(MODEL_PARAMS_PATH, "utf8");
    return JSON.parse(raw) as ModelParams;
  } catch {
    // Should not happen in production — but fail gracefully
    console.warn("priceEstimator: could not load model_params.json, using inline fallback");
    return null as any; // will cause errors below, but better than silent wrong data
  }
}

function loadMarketData(): MarketData {
  try {
    const raw = fs.readFileSync(OPEX_RATES_PATH, "utf8");
    const data = JSON.parse(raw);
    return {
      bdi:          data.bdiIndex ?? FALLBACK_MARKET.bdi,
      charterRates: data.charterRates ?? FALLBACK_MARKET.charterRates,
      scrapPerLDT:  data.scrapPriceLDT ?? FALLBACK_MARKET.scrapPerLDT,
      fuelVLSFO:    data.bunkerVLSFO ?? FALLBACK_MARKET.fuelVLSFO,
      date:         data.date ?? FALLBACK_MARKET.date,
    };
  } catch {
    console.warn("priceEstimator: could not load opex_rates.json, using hardcoded fallback");
    return { ...FALLBACK_MARKET };
  }
}

// Load once at module init (server-side, reloaded on restart)
const PARAMS = loadModelParams();
const MARKET = loadMarketData();

const NEWBUILD_PRICES    = PARAMS.newbuildPrices;
const FALLBACK_TYPE_MULT = PARAMS.fallbackTypeMult;
const LDT_RATIOS         = PARAMS.ldtRatios;
const ECO_BENCHMARKS     = PARAMS.ecoBenchmarks;
const DEP_BRACKETS       = PARAMS.depreciation.brackets;

// Segment sets from shared params
const CAPESIZE_TYPES  = new Set(PARAMS.segmentGroups.capesize);
const PANAMAX_TYPES   = new Set(PARAMS.segmentGroups.panamax);
const SUPRAMAX_TYPES  = new Set(PARAMS.segmentGroups.supramax);
const HANDYSIZE_TYPES = new Set(PARAMS.segmentGroups.handysize);

// Tanker premium from shared params
const TANKER_PREMIUM_FACTOR = PARAMS.tankerPremium.factor;
const TANKER_PREMIUM_TYPES  = new Set(PARAMS.tankerPremium.types);

// Market factor baselines from shared params
const MF_BASELINES = PARAMS.marketFactorBaselines;

// Builder tiers from shared params
const TIER1_BUILDERS = PARAMS.builderTiers.tier1.keywords;
const TIER1_FACTOR   = PARAMS.builderTiers.tier1.factor;
const TIER2_BUILDERS = PARAMS.builderTiers.tier2.keywords;
const TIER2_FACTOR   = PARAMS.builderTiers.tier2.factor;
const TIER4_BUILDERS = PARAMS.builderTiers.tier4.keywords;
const TIER4_FACTOR   = PARAMS.builderTiers.tier4.factor;

// ═══════════════════════════════════════════════════════════════
// A) Newbuild price with DWT scaling (economies of scale exp 0.7)
// ═══════════════════════════════════════════════════════════════
function newbuildPrice(shipType: string, dwt: number): number {
  const safeDwt = Math.max(dwt, 500);
  if (NEWBUILD_PRICES[shipType]) {
    const ref = NEWBUILD_PRICES[shipType];
    return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7);
  }
  const ref  = NEWBUILD_PRICES["Bulk Carrier"];
  const mult = FALLBACK_TYPE_MULT[shipType] ?? 1.0;
  return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7) * mult;
}

// ═══════════════════════════════════════════════════════════════
// B) Hedonic depreciation with survey-cycle penalties
// ═══════════════════════════════════════════════════════════════
function depreciation(age: number): number {
  for (const b of DEP_BRACKETS) {
    if (age <= b.maxAge) {
      if (b.slope !== undefined && b.startValue !== undefined && b.fromAge !== undefined) {
        const val = b.startValue - (age - b.fromAge) * b.slope;
        return Math.max(val, b.floor ?? 0);
      }
      return b.value!;
    }
  }
  // Beyond all brackets
  const last = DEP_BRACKETS[DEP_BRACKETS.length - 1];
  const val = (last.startValue ?? 0.15) - (age - (last.fromAge ?? 25)) * (last.slope ?? 0.015);
  return Math.max(val, last.floor ?? 0.08);
}

// ═══════════════════════════════════════════════════════════════
// C) Segment-specific market factor (with tanker premium)
// ═══════════════════════════════════════════════════════════════
function marketFactor(shipType: string): number {
  let seg: string;
  if (CAPESIZE_TYPES.has(shipType))       seg = "capesize";
  else if (PANAMAX_TYPES.has(shipType))   seg = "panamax";
  else if (SUPRAMAX_TYPES.has(shipType))  seg = "supramax";
  else if (HANDYSIZE_TYPES.has(shipType)) seg = "handysize";
  else                                    seg = "other";

  const bl = MF_BASELINES[seg];
  let rate: number;
  if (seg === "other") {
    rate = MARKET.bdi;
  } else {
    rate = (MARKET.charterRates as any)[seg] ?? bl.defaultRate;
  }
  const baseline = bl.baseline;

  const ratio = rate / baseline;
  let base = 0.85 + 0.15 * Math.pow(ratio, 0.5);

  // Tanker market premium
  if (TANKER_PREMIUM_TYPES.has(shipType)) {
    base *= TANKER_PREMIUM_FACTOR;
  }

  return base;
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
  if (TIER1_BUILDERS.some(p => bl.includes(p))) return TIER1_FACTOR;
  if (TIER2_BUILDERS.some(p => bl.includes(p))) return TIER2_FACTOR;
  if (TIER4_BUILDERS.some(p => bl.includes(p))) return TIER4_FACTOR;
  return 1.0;
}

// ═══════════════════════════════════════════════════════════════
// G) Confidence score
// ═══════════════════════════════════════════════════════════════
function confidenceScore(ship: Ship, age: number): number {
  let score = 30;
  if (ship.dwt > 0)                       score += 15;
  if (ship.yearBuilt > 1900)              score += 15;
  if (NEWBUILD_PRICES[ship.type])         score += 10;
  if ((ship as any).fuelConsumption > 0)  score += 5;
  if ((ship as any).classification)       score += 5;
  score += 5;  // market data is fresh (loaded from opex_rates.json)
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
  else if (age <= 10){ ageLabel = `${age} yrs (mid-age, -${((1-dep)*100).toFixed(0)}%)`; ageImpact = "neutral"; }
  else if (age <= 20){ ageLabel = `${age} yrs (older, -${((1-dep)*100).toFixed(0)}%)`;   ageImpact = "negative"; }
  else               { ageLabel = `${age} yrs (near scrap, -${((1-dep)*100).toFixed(0)}%)`; ageImpact = "negative"; }

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
  const tankerNote = TANKER_PREMIUM_TYPES.has(ship.type) ? ` +${Math.round((TANKER_PREMIUM_FACTOR - 1) * 100)}% tanker premium` : "";
  factors.push({
    label:  "Market",
    value:  `${mfLabel} — x${mf.toFixed(3)}${tankerNote} (${MARKET.date})`,
    impact: mf > 1.02 ? "positive" : mf < 0.98 ? "negative" : "neutral",
    weight: 15,
  });

  // ── Builder ─────────────────────────────────────────────────
  const bf = builderFactor(ship.builder);
  if (bf !== 1.0) {
    const tier = bf >= 1.05 ? "Tier 1 premium" : bf >= 1.01 ? "Tier 2 premium" : "Tier 4 discount";
    factors.push({
      label:  "Builder",
      value:  `${ship.builder} (${tier}, x${bf.toFixed(3)})`,
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

  const reasoning = `${ship.type} newbuild $${(nb / 1e6).toFixed(1)}M · Age ${age}yr dep x${(dep * 100).toFixed(0)}% · Market x${mf.toFixed(3)} · Scrap floor $${(scrap / 1e6).toFixed(1)}M`;

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
    case "BUY":   return "\u{1F7E2}";
    case "WATCH": return "\u{1F440}";
    case "AVOID": return "\u26D4";
  }
}

export function getRecommendationLabel(rec: "BUY" | "WATCH" | "AVOID"): string {
  const labels: Record<string, string> = { BUY: "Buy", WATCH: "Watch", AVOID: "Avoid" };
  return labels[rec] || rec;
}
