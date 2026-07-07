// Vessel value estimation — Hedonic Pricing Model v4.1
// Segment-specific newbuild prices x survey-cycle depreciation x segment market factor
// Server-side: parameters loaded from db/model_params.json + db/opex_rates.json
// Client-side: uses inline fallback constants (same values, compiled at build time)
// Sources: Clarksons, Baltic Exchange, NautiSNP, Xclusiv Shipbrokers

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
// Model parameters — inline defaults (kept in sync with model_params.json)
// On server side these get overridden by the JSON file at module load
// ═══════════════════════════════════════════════════════════════

interface DepBracket {
  maxAge: number;
  value?: number;
  startValue?: number;
  slope?: number;
  fromAge?: number;
  floor?: number;
}

// Inline defaults matching model_params.json (Python canonical values)
const INLINE_NEWBUILD_PRICES: Record<string, { dwt: number; nb: number }> = {
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
  "VLCC":              { dwt: 300000, nb: 125_000_000 },
  "Suezmax":           { dwt: 157000, nb: 85_000_000 },
  "Aframax":           { dwt: 115000, nb: 78_000_000 },
  "Product Tanker":    { dwt: 50000,  nb: 44_000_000 },
  "Chemical Tanker":   { dwt: 25000,  nb: 42_000_000 },
  "Crude Oil Tanker":  { dwt: 105000, nb: 60_000_000 },
  "Oil/Chemical Tanker": { dwt: 45000, nb: 40_000_000 },
  "Container Ship":    { dwt: 70000,  nb: 95_000_000 },
  "LNG Tanker":        { dwt: 80000,  nb: 250_000_000 },
  "LPG Tanker":        { dwt: 50000,  nb: 85_000_000 },
  "Car Carrier":       { dwt: 15000,  nb: 70_000_000 },
  "RoRo":              { dwt: 12000,  nb: 45_000_000 },
  "Reefer":            { dwt: 12000,  nb: 35_000_000 },
  "Multipurpose":      { dwt: 15000,  nb: 22_000_000 },
  "Heavy Lift":        { dwt: 20000,  nb: 45_000_000 },
  "General Cargo":     { dwt: 10000,  nb: 18_000_000 },
  "Bulk Carrier":      { dwt: 60000,  nb: 34_000_000 },
};

const INLINE_FALLBACK_TYPE_MULT: Record<string, number> = {
  "Valemax": 1.05, "VLOC": 1.00, "Gearless": 0.98, "Geared": 0.95,
  "Tanker": 1.10, "ULCV": 1.60, "Neo-Panamax": 1.30, "Feeder": 0.80,
  "RoPax": 1.80, "Cruise Ship": 4.50, "Passenger": 3.00, "Ferry": 1.60,
  "OSV": 1.80, "Offshore": 1.60, "Tug": 2.50, "Dredger": 1.50,
};

const INLINE_DEP_BRACKETS: DepBracket[] = [
  { maxAge: 0,  value: 1.12 },
  { maxAge: 2,  value: 1.08 },
  { maxAge: 5,  startValue: 1.0,  slope: 0.02,  fromAge: 2 },
  { maxAge: 9,  startValue: 0.94, slope: 0.04,  fromAge: 5 },
  { maxAge: 14, startValue: 0.78, slope: 0.052, fromAge: 9 },
  { maxAge: 20, startValue: 0.52, slope: 0.037, fromAge: 14 },
  { maxAge: 25, startValue: 0.30, slope: 0.03,  fromAge: 20 },
  { maxAge: 99, startValue: 0.15, slope: 0.015, fromAge: 25, floor: 0.08 },
];

const INLINE_SEGMENT_GROUPS = {
  capesize:  ["Capesize", "Newcastlemax", "Valemax", "VLOC"],
  panamax:   ["Panamax", "Kamsarmax", "Gearless"],
  supramax:  ["Supramax", "Ultramax", "Geared"],
  handysize: ["Handysize", "Handymax", "Mini-Bulker"],
};

const INLINE_MF_BASELINES: Record<string, { defaultRate: number; baseline: number }> = {
  capesize:  { defaultRate: 29000, baseline: 22000 },
  panamax:   { defaultRate: 21500, baseline: 16000 },
  supramax:  { defaultRate: 24000, baseline: 14000 },
  handysize: { defaultRate: 13500, baseline: 11000 },
  other:     { defaultRate: 1500,  baseline: 1500 },
};

const INLINE_TANKER_PREMIUM = {
  factor: 1.15,
  types: ["VLCC", "Suezmax", "Aframax", "Product Tanker", "Chemical Tanker",
          "Crude Oil Tanker", "Tanker", "Oil/Chemical Tanker"],
};

const INLINE_BUILDER_TIERS = {
  tier1: { factor: 1.07, keywords: ["hyundai", "samsung", "daewoo", "imabari", "oshima", "tsuneishi", "namura", "mitsubishi", "mitsui", "kawasaki", "jmu", "hanjin", "universal shipbuilding", "sanoyas", "shin kurushima"] },
  tier2: { factor: 1.015, keywords: ["cosco", "jiangnan", "hudong", "dalian", "yangzijiang", "nantong", "new times", "jinhai", "zhejiang", "cssc", "csic"] },
  tier4: { factor: 0.925, keywords: ["huelva", "navantia", "astilleros", "constanta", "mangalia", "gdynia", "split", "uljanik"] },
};

const INLINE_LDT_RATIOS: Record<string, number> = {
  "Bulk Carrier": 0.17, "Capesize": 0.15, "Newcastlemax": 0.15,
  "Handymax": 0.18, "Handysize": 0.18, "Supramax": 0.17, "Ultramax": 0.17,
  "Kamsarmax": 0.16, "Panamax": 0.16, "Post-Panamax": 0.16,
  "Tanker": 0.18, "VLCC": 0.15, "Suezmax": 0.17, "Aframax": 0.18,
  "Product Tanker": 0.19, "Chemical Tanker": 0.20, "Crude Oil Tanker": 0.17,
  "Container Ship": 0.22, "General Cargo": 0.25,
  "RoRo": 0.30, "Car Carrier": 0.35, "Reefer": 0.28,
  "LNG Tanker": 0.25, "LPG Tanker": 0.22,
};

const INLINE_ECO_BENCHMARKS: Record<string, number> = {
  "Capesize": 35, "Newcastlemax": 37, "Kamsarmax": 28, "Panamax": 26,
  "Post-Panamax": 30, "Ultramax": 24, "Supramax": 23, "Handymax": 20,
  "Handysize": 18, "Mini-Bulker": 12,
  "VLCC": 65, "Suezmax": 45, "Aframax": 38, "Product Tanker": 28,
  "Chemical Tanker": 22, "Crude Oil Tanker": 40, "LNG Tanker": 80,
  "LPG Tanker": 40, "Container Ship": 120, "General Cargo": 15,
};

const INLINE_MARKET = {
  bdi:          2562,
  charterRates: { capesize: 29000, panamax: 21500, supramax: 24000, handysize: 13500 },
  scrapPerLDT:  478,
  fuelVLSFO:    512,
  date:         "fallback",
};

// ═══════════════════════════════════════════════════════════════
// Try to load from JSON files (server-side only)
// ═══════════════════════════════════════════════════════════════
function tryLoadJson(filePath: string): any {
  if (typeof window !== "undefined") return null; // client-side: skip
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function initParams() {
  const modelJson = tryLoadJson("/opt/bulkwatch/db/model_params.json");
  const opexJson  = tryLoadJson("/opt/bulkwatch/db/opex_rates.json");

  const nbPrices       = modelJson?.newbuildPrices       ?? INLINE_NEWBUILD_PRICES;
  const fallbackMult   = modelJson?.fallbackTypeMult     ?? INLINE_FALLBACK_TYPE_MULT;
  const depBrackets    = modelJson?.depreciation?.brackets ?? INLINE_DEP_BRACKETS;
  const segGroups      = modelJson?.segmentGroups        ?? INLINE_SEGMENT_GROUPS;
  const mfBaselines    = modelJson?.marketFactorBaselines ?? INLINE_MF_BASELINES;
  const tankerPremium  = modelJson?.tankerPremium        ?? INLINE_TANKER_PREMIUM;
  const builderTiers   = modelJson?.builderTiers         ?? INLINE_BUILDER_TIERS;
  const ldtRatios      = modelJson?.ldtRatios            ?? INLINE_LDT_RATIOS;
  const ecoBenchmarks  = modelJson?.ecoBenchmarks        ?? INLINE_ECO_BENCHMARKS;

  const market = opexJson ? {
    bdi:          opexJson.bdiIndex       ?? INLINE_MARKET.bdi,
    charterRates: opexJson.charterRates   ?? INLINE_MARKET.charterRates,
    scrapPerLDT:  opexJson.scrapPriceLDT  ?? INLINE_MARKET.scrapPerLDT,
    fuelVLSFO:    opexJson.bunkerVLSFO    ?? INLINE_MARKET.fuelVLSFO,
    date:         opexJson.date           ?? INLINE_MARKET.date,
  } : { ...INLINE_MARKET };

  const biasCorrection = modelJson?.segment_bias_correction ?? {};
  const containerSegments = modelJson?.containerSegments?.segments ?? [];

  return {
    nbPrices, fallbackMult, depBrackets, segGroups, mfBaselines,
    tankerPremium, builderTiers, ldtRatios, ecoBenchmarks, market, biasCorrection,
    containerSegments,
  };
}

const P = initParams();
const TYPE_ALIASES: Record<string, string> = (tryLoadJson("/opt/bulkwatch/db/model_params.json") ?? {}).type_aliases ?? {};

function resolveType(rawType: string): string {
  return TYPE_ALIASES[rawType] ?? rawType;
}

const BIAS_CORRECTION: Record<string, number> = P.biasCorrection;
const CONTAINER_SEGMENTS: Array<{name: string; maxTeu: number; nb: number}> = P.containerSegments;
const NEWBUILD_PRICES    = P.nbPrices;
const FALLBACK_TYPE_MULT = P.fallbackMult;
const DEP_BRACKETS       = P.depBrackets as DepBracket[];
const LDT_RATIOS         = P.ldtRatios;
const ECO_BENCHMARKS     = P.ecoBenchmarks;
const MARKET             = P.market;

const CAPESIZE_TYPES  = new Set(P.segGroups.capesize);
const PANAMAX_TYPES   = new Set(P.segGroups.panamax);
const SUPRAMAX_TYPES  = new Set(P.segGroups.supramax);
const HANDYSIZE_TYPES = new Set(P.segGroups.handysize);

const TANKER_PREMIUM_FACTOR = P.tankerPremium.factor;
const TANKER_PREMIUM_TYPES  = new Set(P.tankerPremium.types);

const MF_BASELINES = P.mfBaselines;

const TIER1_BUILDERS = P.builderTiers.tier1.keywords;
const TIER1_FACTOR   = P.builderTiers.tier1.factor;
const TIER2_BUILDERS = P.builderTiers.tier2.keywords;
const TIER2_FACTOR   = P.builderTiers.tier2.factor;
const TIER4_BUILDERS = P.builderTiers.tier4.keywords;
const TIER4_FACTOR   = P.builderTiers.tier4.factor;

// ═══════════════════════════════════════════════════════════════
// A) Newbuild price with DWT scaling (economies of scale exp 0.7)
// ═══════════════════════════════════════════════════════════════
function containerNewbuildPrice(teu: number): number {
  if (!CONTAINER_SEGMENTS.length || teu <= 0) return 0;
  for (const seg of CONTAINER_SEGMENTS) {
    if (teu <= seg.maxTeu) return seg.nb;
  }
  return CONTAINER_SEGMENTS[CONTAINER_SEGMENTS.length - 1].nb;
}

function newbuildPrice(shipType: string, dwt: number, teu: number = 0): number {
  const safeDwt = Math.max(dwt, 500);

  // Container ships: use TEU-based segmentation (6 classes)
  if (shipType === "Container Ship") {
    const effectiveTeu = teu > 0 ? teu : Math.round(safeDwt / 14);
    const cnb = containerNewbuildPrice(effectiveTeu);
    if (cnb > 0) return cnb;
  }

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
  score += 5;  // market data from opex_rates.json
  if (ship.builder)                       score += 3;
  if (ship.length > 0 && ship.beam > 0)   score += 5;
  if (age > 20) score = Math.max(30, score - 10);
  if (ship.type === "Other") score = Math.max(30, score - 10);
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
  const shipType      = resolveType(ship.type);

  const teu = (ship as any).teu as number | undefined;
  const nb = newbuildPrice(shipType, dwt, teu);
  const isKnownSegment = !!NEWBUILD_PRICES[shipType];
  factors.push({
    label:  "Newbuild Cost",
    value:  `$${(nb / 1e6).toFixed(1)}M (${isKnownSegment ? ship.type : "estimated"})`,
    impact: "neutral",
    weight: 15,
  });

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

  const mf = marketFactor(shipType);
  const mfLabel = CAPESIZE_TYPES.has(shipType)   ? `Capesize $${MARKET.charterRates.capesize.toLocaleString()}/d`
                : PANAMAX_TYPES.has(shipType)     ? `Panamax $${MARKET.charterRates.panamax.toLocaleString()}/d`
                : SUPRAMAX_TYPES.has(shipType)    ? `Supramax $${MARKET.charterRates.supramax.toLocaleString()}/d`
                : HANDYSIZE_TYPES.has(shipType)   ? `Handysize $${MARKET.charterRates.handysize.toLocaleString()}/d`
                : `BDI ${MARKET.bdi}`;
  const tankerNote = TANKER_PREMIUM_TYPES.has(shipType) ? ` +${Math.round((TANKER_PREMIUM_FACTOR - 1) * 100)}% tanker premium` : "";
  factors.push({
    label:  "Market",
    value:  `${mfLabel} — x${mf.toFixed(3)}${tankerNote} (${MARKET.date})`,
    impact: mf > 1.02 ? "positive" : mf < 0.98 ? "negative" : "neutral",
    weight: 15,
  });

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

  const fuelCons = (ship as any).fuelConsumption as number | undefined;
  const eco = ecoPremium(fuelCons, dwt, shipType, age);
  if (eco > 0) {
    factors.push({
      label:  "Eco Premium",
      value:  `+$${(eco / 1e6).toFixed(2)}M (NPV fuel savings)`,
      impact: "positive",
      weight: 7,
    });
  }

  if (ship.dwt > 0) {
    factors.push({
      label:  "Tonnage",
      value:  `${ship.dwt.toLocaleString("en-US")} DWT`,
      impact: ship.dwt > 100000 ? "positive" : "neutral",
      weight: 10,
    });
  }

  const reputableFlags = ["Norway", "Denmark", "Germany", "Netherlands",
                          "United Kingdom", "Japan", "Singapore"];
  const flagLowCost    = ["Mongolia", "Cambodia", "Belize", "Comoros"];
  if (reputableFlags.includes(ship.flag)) {
    factors.push({ label: "Flag", value: `${ship.flag} (Premium)`, impact: "positive", weight: 5 });
  } else if (flagLowCost.includes(ship.flag)) {
    factors.push({ label: "Flag", value: `${ship.flag} (Flag of Convenience)`, impact: "negative", weight: 10 });
  }

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

  const scrap = scrapValue(dwt, shipType);
  factors.push({
    label:  "Scrap Floor",
    value:  `$${(scrap / 1e6).toFixed(2)}M (LDT-based, ${MARKET.scrapPerLDT} $/LDT)`,
    impact: "neutral",
    weight: 5,
  });

  const bias = BIAS_CORRECTION[shipType] ?? 1.0;
  const base = nb * dep * mf * bf * statusMult * bias;
  const estimatedValueUSD = Math.round(
    Math.max(
      base + eco,
      (ship.status === "active" || ship.status === "laid_up") ? scrap : 0
    )
  );

  const conf = confidenceScore({...ship, type: shipType as any}, age);

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
