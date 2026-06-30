// ═══════════════════════════════════════════════════════════════
// OPEX MODEL — BROKER LEVEL
// Daily operating cost estimation for commercial shipping
// Sources: Drewry Ship Operating Costs 2025/26, Baltic Exchange
//          BOPEX, ITF/ILO MLC, Gard/Skuld P&I, ClassNK/DNV,
//          daily live data from opex_update.py (12+ sources)
// ═══════════════════════════════════════════════════════════════

// ═══ CREW MANNING & COSTS ═══
// Based on: ITF CBA minimums, Drewry Manning Review, maritime-zone.com
// All-in cost = base wage + OT + leave pay + social insurance + travel +
//               training + medical + P&I crew liability

interface CrewMember {
  rank: string;
  dept: "D" | "E" | "C"; // Deck, Engine, Catering
  dailyUSD: number; // all-in cost to shipowner
}

// Flag-state crew cost multiplier (manning nationality correlates with flag)
// Source: Drewry Manning Review — Filipino baseline = 1.0
const FLAG_CREW_MULT: Record<string, number> = {
  "Philippines":1.00, "Myanmar":0.85, "India":0.95, "Indonesia":0.90,
  "China":1.05, "Vietnam":0.88, "Ukraine":1.10, "Russia":1.08,
  "Croatia":1.25, "Poland":1.20, "Greece":1.40, "Norway":1.80,
  "Denmark":1.75, "Germany":1.65, "Netherlands":1.55, "United Kingdom":1.50,
  "Japan":1.60, "South Korea":1.45, "Singapore":1.35, "Ireland":1.45,
  "Marshall Islands":1.00, "Panama":1.00, "Liberia":1.00, "Malta":1.10,
  "Hong Kong":1.15, "Bahamas":1.05, "Bermuda":1.10, "Cyprus":1.15,
  "Isle of Man":1.20, "Antigua and Barbuda":1.00, "Tuvalu":0.95,
};

// Crew templates by size class (Filipino baseline rates, $/day all-in)
const CREW: Record<string, CrewMember[]> = {
  // <5k DWT: Coaster (10-12 crew)
  coaster: [
    {rank:"Master",dept:"D",dailyUSD:290},{rank:"Ch.Officer",dept:"D",dailyUSD:210},
    {rank:"2/O",dept:"D",dailyUSD:155},{rank:"Bosun",dept:"D",dailyUSD:85},
    {rank:"AB",dept:"D",dailyUSD:65},{rank:"AB",dept:"D",dailyUSD:65},
    {rank:"Ch.Engineer",dept:"E",dailyUSD:270},{rank:"2/E",dept:"E",dailyUSD:195},
    {rank:"Oiler",dept:"E",dailyUSD:55},{rank:"Oiler",dept:"E",dailyUSD:55},
    {rank:"Cook",dept:"C",dailyUSD:65},{rank:"Steward",dept:"C",dailyUSD:50},
  ],
  // 5-10k DWT: Mini-Bulker / GenCargo (14 crew)
  small: [
    {rank:"Master",dept:"D",dailyUSD:340},{rank:"Ch.Officer",dept:"D",dailyUSD:245},
    {rank:"2/O",dept:"D",dailyUSD:175},{rank:"Bosun",dept:"D",dailyUSD:95},
    {rank:"AB",dept:"D",dailyUSD:72},{rank:"AB",dept:"D",dailyUSD:72},
    {rank:"OS",dept:"D",dailyUSD:52},
    {rank:"Ch.Engineer",dept:"E",dailyUSD:315},{rank:"2/E",dept:"E",dailyUSD:225},
    {rank:"3/E",dept:"E",dailyUSD:165},{rank:"Oiler",dept:"E",dailyUSD:60},
    {rank:"Oiler",dept:"E",dailyUSD:60},
    {rank:"Cook",dept:"C",dailyUSD:72},{rank:"Steward",dept:"C",dailyUSD:52},
  ],
  // 10-45k DWT: Handysize/Supramax (18 crew)
  medium: [
    {rank:"Master",dept:"D",dailyUSD:375},{rank:"Ch.Officer",dept:"D",dailyUSD:265},
    {rank:"2/O",dept:"D",dailyUSD:190},{rank:"3/O",dept:"D",dailyUSD:155},
    {rank:"Bosun",dept:"D",dailyUSD:105},{rank:"AB",dept:"D",dailyUSD:78},
    {rank:"AB",dept:"D",dailyUSD:78},{rank:"AB",dept:"D",dailyUSD:78},
    {rank:"OS",dept:"D",dailyUSD:57},
    {rank:"Ch.Engineer",dept:"E",dailyUSD:345},{rank:"2/E",dept:"E",dailyUSD:248},
    {rank:"3/E",dept:"E",dailyUSD:178},{rank:"4/E",dept:"E",dailyUSD:145},
    {rank:"Electrician",dept:"E",dailyUSD:128},{rank:"Oiler",dept:"E",dailyUSD:65},
    {rank:"Oiler",dept:"E",dailyUSD:65},
    {rank:"Cook",dept:"C",dailyUSD:78},{rank:"Messman",dept:"C",dailyUSD:52},
  ],
  // 45-100k DWT: Panamax/Kamsarmax (21 crew)
  large: [
    {rank:"Master",dept:"D",dailyUSD:395},{rank:"Ch.Officer",dept:"D",dailyUSD:285},
    {rank:"2/O",dept:"D",dailyUSD:205},{rank:"3/O",dept:"D",dailyUSD:168},
    {rank:"Bosun",dept:"D",dailyUSD:115},{rank:"AB",dept:"D",dailyUSD:82},
    {rank:"AB",dept:"D",dailyUSD:82},{rank:"AB",dept:"D",dailyUSD:82},
    {rank:"AB",dept:"D",dailyUSD:82},{rank:"OS",dept:"D",dailyUSD:62},
    {rank:"Ch.Engineer",dept:"E",dailyUSD:375},{rank:"2/E",dept:"E",dailyUSD:268},
    {rank:"3/E",dept:"E",dailyUSD:192},{rank:"4/E",dept:"E",dailyUSD:158},
    {rank:"Electrician",dept:"E",dailyUSD:138},{rank:"Fitter",dept:"E",dailyUSD:92},
    {rank:"Oiler",dept:"E",dailyUSD:72},{rank:"Oiler",dept:"E",dailyUSD:72},
    {rank:"Cook",dept:"C",dailyUSD:82},{rank:"Messman",dept:"C",dailyUSD:55},
    {rank:"Steward",dept:"C",dailyUSD:58},
  ],
  // 100k+ DWT: Capesize/VLOC/Newcastlemax (24 crew)
  vlarge: [
    {rank:"Master",dept:"D",dailyUSD:425},{rank:"Ch.Officer",dept:"D",dailyUSD:308},
    {rank:"2/O",dept:"D",dailyUSD:220},{rank:"3/O",dept:"D",dailyUSD:178},
    {rank:"Bosun",dept:"D",dailyUSD:128},{rank:"AB",dept:"D",dailyUSD:88},
    {rank:"AB",dept:"D",dailyUSD:88},{rank:"AB",dept:"D",dailyUSD:88},
    {rank:"AB",dept:"D",dailyUSD:88},{rank:"OS",dept:"D",dailyUSD:68},
    {rank:"OS",dept:"D",dailyUSD:68},
    {rank:"Ch.Engineer",dept:"E",dailyUSD:398},{rank:"2/E",dept:"E",dailyUSD:288},
    {rank:"3/E",dept:"E",dailyUSD:208},{rank:"4/E",dept:"E",dailyUSD:168},
    {rank:"Electrician",dept:"E",dailyUSD:148},{rank:"Fitter",dept:"E",dailyUSD:98},
    {rank:"Oiler",dept:"E",dailyUSD:78},{rank:"Oiler",dept:"E",dailyUSD:78},
    {rank:"Oiler",dept:"E",dailyUSD:78},{rank:"Wiper",dept:"E",dailyUSD:58},
    {rank:"Cook",dept:"C",dailyUSD:88},{rank:"2nd Cook",dept:"C",dailyUSD:62},
    {rank:"Steward",dept:"C",dailyUSD:62},
  ],
};

// ═══ LIVE RATES INTERFACE ═══
export interface LiveOpexRates {
  date: string;
  bunkerVLSFO: number;
  bunkerHSFO: number;
  bunkerMGO: number;
  bdiIndex: number;
  scrapPriceLDT: number;
  steelScrapUSD: number;
  insuranceRateHull: number;
  insuranceRatePnI: number;
  lubeOilPrice: number;
  provisionsCostPerPersonDay: number;
  charterRates: { handysize:number; supramax:number; panamax:number; capesize:number };
  sources: string[];
}

const DEFAULTS: LiveOpexRates = {
  date:"2026-06-30", bunkerVLSFO:533, bunkerHSFO:391, bunkerMGO:746,
  bdiIndex:2490, scrapPriceLDT:478, steelScrapUSD:156, insuranceRateHull:0.25,
  insuranceRatePnI:4.50, lubeOilPrice:4.20, provisionsCostPerPersonDay:12,
  charterRates:{handysize:13500,supramax:17500,panamax:18000,capesize:29000},
  sources:["defaults"],
};

let _cache: LiveOpexRates|null = null;
let _cacheTs = 0;

export function getLiveRates(): LiveOpexRates {
  if(_cache && Date.now()-_cacheTs < 3600_000) return _cache;
  try {
    if(typeof window==="undefined") {
      const fs=require("fs"), path=require("path");
      const f=path.join(process.cwd(),"db","opex_rates.json");
      if(fs.existsSync(f)){_cache=JSON.parse(fs.readFileSync(f,"utf8"));_cacheTs=Date.now();return _cache!;}
    }
  } catch{}
  return DEFAULTS;
}

// ═══ OPEX CALCULATION ═══

export interface OpexBreakdown {
  // Crew
  crewCostPerDay: number;
  crewCount: number;
  crewDetails: {rank:string; dept:string; dailyUSD:number}[];
  flagMultiplier: number;
  // Fixed OPEX
  provisionsPerDay: number;
  insuranceHMPerDay: number;
  insurancePnIPerDay: number;
  insuranceTotalPerDay: number;
  maintenancePerDay: number;
  lubeOilPerDay: number;
  storesSpares: number;
  managementPerDay: number;
  drydockPerDay: number; // amortized over 5yr cycle
  // Regulatory
  euEtsPerDay: number;
  // TOTAL
  totalFixedOpex: number; // all above
  // Voyage costs (variable, for reference)
  fuelCostPerDay: number;
  portCostsPerDay: number; // estimated
  totalVoyexPerDay: number;
  // Combined
  totalCostPerDay: number; // OPEX + VOYEX
  // Earnings
  charterRatePerDay: number;
  netEarningsPerDay: number;
  annualOpex: number;
  annualNetEarnings: number;
  breakEvenCharterRate: number;
  paybackYears: number|null;
  roiPercent: number|null;
  sizeClass: string;
  ratesDate: string;
  sources: string[];
}

function getSizeClass(dwt: number): string {
  if(dwt<5000) return "coaster";
  if(dwt<10000) return "small";
  if(dwt<45000) return "medium";
  if(dwt<100000) return "large";
  return "vlarge";
}

function getCharterRate(dwt:number, type:string, rates:LiveOpexRates): number {
  // Tanker/container premium on charter rates
  const tankerTypes = ["VLCC","Suezmax","Aframax","Product Tanker","Chemical Tanker","Crude Oil Tanker","Tanker","Oil/Chemical Tanker","LNG Tanker","LPG Tanker"];
  const containerTypes = ["Container Ship","ULCV","Neo-Panamax","Feeder"];
  let mult = 1.0;
  if(tankerTypes.includes(type)) mult = 1.3;
  if(containerTypes.includes(type)) mult = 1.15;
  if(type==="LNG Tanker") mult = 2.5;
  if(type==="Car Carrier") mult = 1.8;

  if(dwt<5000) return Math.round(rates.charterRates.handysize * 0.55 * mult);
  if(dwt<10000) return Math.round(rates.charterRates.handysize * 0.75 * mult);
  if(dwt<45000) return Math.round(rates.charterRates.handysize * mult);
  if(dwt<65000) return Math.round(rates.charterRates.supramax * mult);
  if(dwt<100000) return Math.round(rates.charterRates.panamax * mult);
  return Math.round(rates.charterRates.capesize * mult);
}

export function calculateOpex(
  dwt: number,
  yearBuilt: number,
  shipType: string,
  estimatedValueUSD: number,
  flag?: string,
  fuelConsumptionTonsDay?: number,
  crewSizeOverride?: number,
  grossTonnage?: number,
): OpexBreakdown {
  const rates = getLiveRates();
  const year = new Date().getFullYear();
  const age = yearBuilt > 1900 ? year - yearBuilt : 10;
  const sc = getSizeClass(dwt);

  // ─── 1. CREW ───
  const template = CREW[sc];
  const flagMult = (flag && FLAG_CREW_MULT[flag]) || 1.0;
  // Age factor: older ships need more crew overtime for maintenance
  const ageCrewMult = 1 + Math.max(0, age - 8) * 0.015;
  const crewDetails = template.map(c => ({
    rank: c.rank,
    dept: c.dept,
    dailyUSD: Math.round(c.dailyUSD * flagMult * ageCrewMult),
  }));
  const crewCount = crewSizeOverride || template.length;
  const crewCostPerDay = crewDetails.reduce((s,c)=>s+c.dailyUSD, 0);

  // ─── 2. PROVISIONS ───
  // ILO MLC minimum $10/person/day, market average $12-15
  const provisionsPerDay = Math.round(crewCount * rates.provisionsCostPerPersonDay);

  // ─── 3. INSURANCE ───
  // H&M: % of insured value (110% of market) — varies by age
  const insuredValue = estimatedValueUSD * 1.10;
  const hmAgeLoad = age > 15 ? 1.3 : age > 10 ? 1.15 : 1.0;
  const hmRate = rates.insuranceRateHull * hmAgeLoad;
  const insuranceHMPerDay = Math.round((insuredValue * (hmRate/100)) / 365);
  // P&I: $/GT/year — International Group clubs (Gard, Skuld, West of England)
  const gt = grossTonnage || Math.round(dwt * 0.6);
  const insurancePnIPerDay = Math.round((gt * rates.insuranceRatePnI) / 365);
  const insuranceTotalPerDay = insuranceHMPerDay + insurancePnIPerDay;

  // ─── 4. MAINTENANCE & REPAIRS ───
  // Drewry benchmark: $2,000-8,000/day depending on size & age
  const baseMaint: Record<string,number> = {
    coaster:650, small:850, medium:1400, large:2000, vlarge:2800
  };
  const maintAgeFactor = age <= 5 ? 0.85 : age <= 10 ? 1.0 : age <= 15 ? 1.20 : age <= 20 ? 1.45 : 1.75;
  const maintenancePerDay = Math.round((baseMaint[sc]||1500) * maintAgeFactor);

  // ─── 5. STORES & SPARES ───
  // Consumables, paint, ropes, safety equipment
  const storesSpares = Math.round(dwt < 10000 ? 350 : dwt < 45000 ? 550 : dwt < 100000 ? 750 : 1000);

  // ─── 6. LUBE OIL ───
  // SFOC-based: ME power×0.7g/kWh cylinder + 0.15g/kWh system
  const approxMEkW = fuelConsumptionTonsDay
    ? fuelConsumptionTonsDay * 1000 / (170 * 24 / 1000) // reverse from SFOC ~170g/kWh
    : dwt < 5000 ? 1800 : dwt < 10000 ? 3000 : dwt < 45000 ? 7000 : dwt < 100000 ? 11000 : 18000;
  const cylOilLitersDay = approxMEkW * 0.0007 * 24;
  const sysOilLitersDay = approxMEkW * 0.00015 * 24;
  const lubeOilPerDay = Math.round((cylOilLitersDay + sysOilLitersDay) * rates.lubeOilPrice);

  // ─── 7. MANAGEMENT ───
  // Technical + commercial management (V.Ships, Anglo-Eastern, etc.)
  const managementPerDay = Math.round(dwt < 5000 ? 400 : dwt < 10000 ? 550 : dwt < 45000 ? 750 : dwt < 100000 ? 950 : 1150);

  // ─── 8. DRYDOCK (amortized) ───
  // Special survey every 5 years: $500k-3M depending on size
  const dockCost: Record<string,number> = {
    coaster:350_000, small:500_000, medium:900_000, large:1_500_000, vlarge:2_500_000
  };
  const dockAgeAdj = age > 20 ? 1.5 : age > 15 ? 1.3 : 1.0;
  const drydockPerDay = Math.round(((dockCost[sc]||1_000_000) * dockAgeAdj) / (5*365));

  // ─── 9. EU ETS (since 2024, 100% in 2026) ───
  // ~3.2 tons CO2 per ton fuel × EU ETS price ~€60/ton ≈ $65
  // Only for EU voyages, assume 30% of trading days
  const fuelPerDay = fuelConsumptionTonsDay || (dwt < 5000 ? 8 : dwt < 10000 ? 14 : dwt < 45000 ? 25 : dwt < 100000 ? 35 : 55);
  const co2PerDay = fuelPerDay * 3.15; // tons CO2
  const etsPrice = 65; // $/ton CO2 (EU ETS ~€60)
  const euTradeShare = 0.25; // ~25% of days in EU waters
  const euEtsPerDay = Math.round(co2PerDay * etsPrice * euTradeShare);

  // ─── TOTAL FIXED OPEX ───
  const totalFixedOpex = crewCostPerDay + provisionsPerDay + insuranceTotalPerDay +
    maintenancePerDay + storesSpares + lubeOilPerDay + managementPerDay + drydockPerDay + euEtsPerDay;

  // ─── VOYAGE COSTS (variable, estimated) ───
  const bunkerPrice = rates.bunkerVLSFO; // most ships now on VLSFO
  const fuelCostPerDay = Math.round(fuelPerDay * bunkerPrice);
  // Port costs amortized: ~$50-150k per port call, ~24 calls/year
  const portCostsPerDay = Math.round(dwt < 10000 ? 350 : dwt < 45000 ? 650 : dwt < 100000 ? 1000 : 1500);
  const totalVoyexPerDay = fuelCostPerDay + portCostsPerDay;

  // ─── COMBINED ───
  const totalCostPerDay = totalFixedOpex + totalVoyexPerDay;

  // ─── EARNINGS ───
  const charterRatePerDay = getCharterRate(dwt, shipType, rates);
  const netEarningsPerDay = charterRatePerDay - totalFixedOpex; // TC: owner pays OPEX, charterer pays VOYEX
  const annualOpex = totalFixedOpex * 365;
  const annualNetEarnings = netEarningsPerDay * 365;
  const paybackYears = netEarningsPerDay > 0
    ? Math.round((estimatedValueUSD / annualNetEarnings) * 10) / 10
    : null;
  const roiPercent = estimatedValueUSD > 0
    ? Math.round((annualNetEarnings / estimatedValueUSD) * 1000) / 10
    : null;

  return {
    crewCostPerDay, crewCount, crewDetails, flagMultiplier: flagMult,
    provisionsPerDay,
    insuranceHMPerDay, insurancePnIPerDay, insuranceTotalPerDay,
    maintenancePerDay, lubeOilPerDay, storesSpares, managementPerDay,
    drydockPerDay, euEtsPerDay,
    totalFixedOpex,
    fuelCostPerDay, portCostsPerDay, totalVoyexPerDay,
    totalCostPerDay,
    charterRatePerDay, netEarningsPerDay,
    annualOpex, annualNetEarnings,
    breakEvenCharterRate: totalFixedOpex,
    paybackYears, roiPercent,
    sizeClass: sc, ratesDate: rates.date, sources: rates.sources,
  };
}

export function formatUSD(n: number): string {
  if(Math.abs(n) >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if(Math.abs(n) >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n.toLocaleString("en-US")}`;
}
