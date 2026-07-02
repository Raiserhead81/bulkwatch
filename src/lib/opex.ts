// ═══════════════════════════════════════════════════════════════
// OPEX MODEL — BROKER LEVEL (v2 — calibrated against Drewry 2025/26)
// ═══════════════════════════════════════════════════════════════

interface CrewMember {
  rank: string;
  dept: "D" | "E" | "C";
  dailyUSD: number;
}

// Flag-state crew cost multiplier
// IMPORTANT: Most open-registry flags (Panama, Liberia, Marshall Islands)
// use Filipino crew. Premium flags = higher wages by CBA requirement.
// Source: Drewry Manning Review, ITF CBAs
const FLAG_CREW_MULT: Record<string, number> = {
  // Open registry (Filipino/Indian/Myanmar crew typical)
  "Philippines":1.00, "Myanmar":0.90, "India":0.95, "Indonesia":0.92,
  "China":1.05, "Vietnam":0.90, "Ukraine":1.05, "Russia":1.05,
  "Marshall Islands":1.00, "Panama":1.00, "Liberia":1.00, "Malta":1.02,
  "Hong Kong":1.05, "Bahamas":1.00, "Bermuda":1.02, "Cyprus":1.05,
  "Antigua and Barbuda":1.00, "Tuvalu":0.95,
  // Premium flags (home-country or mixed crew)
  "Greece":1.15, "Norway":1.25, "Denmark":1.20, "Germany":1.20,
  "Netherlands":1.15, "United Kingdom":1.15, "Japan":1.20,
  "South Korea":1.10, "Singapore":1.10, "Ireland":1.12,
  "Croatia":1.08, "Poland":1.05, "Isle of Man":1.10,
};

// Crew templates — Filipino baseline rates ($/day, all-in)
const CREW: Record<string, CrewMember[]> = {
  coaster: [ // <5k DWT, 12 crew
    {rank:"Master",dept:"D",dailyUSD:290},{rank:"Ch.Off",dept:"D",dailyUSD:210},
    {rank:"2/O",dept:"D",dailyUSD:155},{rank:"Bosun",dept:"D",dailyUSD:85},
    {rank:"AB",dept:"D",dailyUSD:65},{rank:"AB",dept:"D",dailyUSD:65},
    {rank:"Ch.Eng",dept:"E",dailyUSD:270},{rank:"2/E",dept:"E",dailyUSD:195},
    {rank:"Oiler",dept:"E",dailyUSD:55},{rank:"Oiler",dept:"E",dailyUSD:55},
    {rank:"Cook",dept:"C",dailyUSD:65},{rank:"Steward",dept:"C",dailyUSD:50},
  ],
  small: [ // 5-10k DWT, 14 crew
    {rank:"Master",dept:"D",dailyUSD:340},{rank:"Ch.Off",dept:"D",dailyUSD:245},
    {rank:"2/O",dept:"D",dailyUSD:175},{rank:"Bosun",dept:"D",dailyUSD:95},
    {rank:"AB",dept:"D",dailyUSD:72},{rank:"AB",dept:"D",dailyUSD:72},
    {rank:"OS",dept:"D",dailyUSD:52},
    {rank:"Ch.Eng",dept:"E",dailyUSD:315},{rank:"2/E",dept:"E",dailyUSD:225},
    {rank:"3/E",dept:"E",dailyUSD:165},{rank:"Oiler",dept:"E",dailyUSD:60},
    {rank:"Oiler",dept:"E",dailyUSD:60},
    {rank:"Cook",dept:"C",dailyUSD:72},{rank:"Steward",dept:"C",dailyUSD:52},
  ],
  medium: [ // 10-60k DWT, 18 crew
    {rank:"Master",dept:"D",dailyUSD:375},{rank:"Ch.Off",dept:"D",dailyUSD:265},
    {rank:"2/O",dept:"D",dailyUSD:190},{rank:"3/O",dept:"D",dailyUSD:155},
    {rank:"Bosun",dept:"D",dailyUSD:105},{rank:"AB",dept:"D",dailyUSD:78},
    {rank:"AB",dept:"D",dailyUSD:78},{rank:"AB",dept:"D",dailyUSD:78},
    {rank:"OS",dept:"D",dailyUSD:57},
    {rank:"Ch.Eng",dept:"E",dailyUSD:345},{rank:"2/E",dept:"E",dailyUSD:248},
    {rank:"3/E",dept:"E",dailyUSD:178},{rank:"4/E",dept:"E",dailyUSD:145},
    {rank:"Electrician",dept:"E",dailyUSD:128},{rank:"Oiler",dept:"E",dailyUSD:65},
    {rank:"Oiler",dept:"E",dailyUSD:65},
    {rank:"Cook",dept:"C",dailyUSD:78},{rank:"Messman",dept:"C",dailyUSD:52},
  ],
  large: [ // 60-100k DWT, 21 crew
    {rank:"Master",dept:"D",dailyUSD:395},{rank:"Ch.Off",dept:"D",dailyUSD:285},
    {rank:"2/O",dept:"D",dailyUSD:205},{rank:"3/O",dept:"D",dailyUSD:168},
    {rank:"Bosun",dept:"D",dailyUSD:115},{rank:"AB",dept:"D",dailyUSD:82},
    {rank:"AB",dept:"D",dailyUSD:82},{rank:"AB",dept:"D",dailyUSD:82},
    {rank:"AB",dept:"D",dailyUSD:82},{rank:"OS",dept:"D",dailyUSD:62},
    {rank:"Ch.Eng",dept:"E",dailyUSD:375},{rank:"2/E",dept:"E",dailyUSD:268},
    {rank:"3/E",dept:"E",dailyUSD:192},{rank:"4/E",dept:"E",dailyUSD:158},
    {rank:"Electrician",dept:"E",dailyUSD:138},{rank:"Fitter",dept:"E",dailyUSD:92},
    {rank:"Oiler",dept:"E",dailyUSD:72},{rank:"Oiler",dept:"E",dailyUSD:72},
    {rank:"Cook",dept:"C",dailyUSD:82},{rank:"Messman",dept:"C",dailyUSD:55},
    {rank:"Steward",dept:"C",dailyUSD:58},
  ],
  vlarge: [ // 100k+ DWT, 24 crew
    {rank:"Master",dept:"D",dailyUSD:425},{rank:"Ch.Off",dept:"D",dailyUSD:308},
    {rank:"2/O",dept:"D",dailyUSD:220},{rank:"3/O",dept:"D",dailyUSD:178},
    {rank:"Bosun",dept:"D",dailyUSD:128},{rank:"AB",dept:"D",dailyUSD:88},
    {rank:"AB",dept:"D",dailyUSD:88},{rank:"AB",dept:"D",dailyUSD:88},
    {rank:"AB",dept:"D",dailyUSD:88},{rank:"OS",dept:"D",dailyUSD:68},
    {rank:"OS",dept:"D",dailyUSD:68},
    {rank:"Ch.Eng",dept:"E",dailyUSD:398},{rank:"2/E",dept:"E",dailyUSD:288},
    {rank:"3/E",dept:"E",dailyUSD:208},{rank:"4/E",dept:"E",dailyUSD:168},
    {rank:"Electrician",dept:"E",dailyUSD:148},{rank:"Fitter",dept:"E",dailyUSD:98},
    {rank:"Oiler",dept:"E",dailyUSD:78},{rank:"Oiler",dept:"E",dailyUSD:78},
    {rank:"Oiler",dept:"E",dailyUSD:78},{rank:"Wiper",dept:"E",dailyUSD:58},
    {rank:"Cook",dept:"C",dailyUSD:88},{rank:"2nd Cook",dept:"C",dailyUSD:62},
    {rank:"Steward",dept:"C",dailyUSD:62},
  ],
};

export interface LiveOpexRates {
  date: string;
  bunkerVLSFO: number; bunkerHSFO: number; bunkerMGO: number;
  bdiIndex: number; scrapPriceLDT: number; steelScrapUSD: number;
  insuranceRateHull: number; insuranceRatePnI: number;
  lubeOilPrice: number; provisionsCostPerPersonDay: number;
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
  // Always return defaults — works on both client and server
  // Live rates from opex_update.py are baked into DEFAULTS at build time
  return DEFAULTS;
}

export interface OpexBreakdown {
  crewCostPerDay: number; crewCount: number;
  crewDetails: {rank:string; dept:string; dailyUSD:number}[];
  flagMultiplier: number;
  provisionsPerDay: number;
  insuranceHMPerDay: number; insurancePnIPerDay: number; insuranceTotalPerDay: number;
  maintenancePerDay: number; lubeOilPerDay: number; storesSpares: number;
  managementPerDay: number; drydockPerDay: number; euEtsPerDay: number;
  totalFixedOpex: number;
  fuelCostPerDay: number; portCostsPerDay: number; totalVoyexPerDay: number;
  totalCostPerDay: number;
  charterRatePerDay: number; netEarningsPerDay: number;
  annualOpex: number; annualNetEarnings: number;
  scrubberSavingsPerDay: number;
  fuelPriceEffective: number;
  breakEvenCharterRate: number;
  paybackYears: number|null; roiPercent: number|null;
  sizeClass: string; ratesDate: string; sources: string[];
}

function getSizeClass(dwt: number): string {
  if(dwt<5000) return "coaster";
  if(dwt<10000) return "small";
  if(dwt<60000) return "medium";   // ← was 45000, now 60k = Supramax/Ultramax still medium
  if(dwt<100000) return "large";
  return "vlarge";
}

function getCharterRate(dwt:number, type:string, rates:LiveOpexRates): number {
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
  dwt: number, yearBuilt: number, shipType: string, estimatedValueUSD: number,
  flag?: string, fuelConsumptionTonsDay?: number,
  crewSizeOverride?: number, grossTonnage?: number,
  managementType?: "own" | "third-party",
  hasScrubber?: boolean,
): OpexBreakdown {
  const rates = getLiveRates();
  const year = new Date().getFullYear();
  const age = yearBuilt > 1900 ? year - yearBuilt : 10;
  const sc = getSizeClass(dwt);

  // 1. CREW — flag mult capped more conservatively
  const template = CREW[sc];
  const flagMult = (flag && FLAG_CREW_MULT[flag]) || 1.0;
  // Age factor: +1% per year over 10yr (not 1.5%)
  const ageCrewMult = 1 + Math.max(0, age - 10) * 0.01;
  const crewDetails = template.map(c => ({
    rank: c.rank, dept: c.dept,
    dailyUSD: Math.round(c.dailyUSD * flagMult * ageCrewMult),
  }));
  const crewCount = crewSizeOverride || template.length;
  const crewCostPerDay = crewDetails.reduce((s,c)=>s+c.dailyUSD, 0);

  // 2. PROVISIONS
  const provisionsPerDay = Math.round(crewCount * rates.provisionsCostPerPersonDay);

  // 3. INSURANCE
  const insuredValue = estimatedValueUSD * 1.10;
  const hmAgeLoad = age > 20 ? 1.25 : age > 15 ? 1.15 : age > 10 ? 1.08 : 1.0;
  const hmRate = (rates.insuranceRateHull || 0.25) * hmAgeLoad;
  // Minimum H&M insurance floor based on ship size
  const hmMinPerDay = dwt < 5000 ? 30 : dwt < 10000 ? 50 : dwt < 60000 ? 100 : dwt < 100000 ? 200 : 350;
  const insuranceHMPerDay = Math.max(Math.round((insuredValue * (hmRate/100)) / 365), hmMinPerDay);
  const gt = grossTonnage || Math.round(dwt * 0.6);
  const pniMin = dwt < 5000 ? 40 : dwt < 10000 ? 60 : dwt < 60000 ? 100 : dwt < 100000 ? 150 : 250;
  const insurancePnIPerDay = Math.max(Math.round((gt * rates.insuranceRatePnI) / 365), pniMin);
  const insuranceTotalPerDay = insuranceHMPerDay + insurancePnIPerDay;

  // 4. MAINTENANCE — more moderate age scaling
  const baseMaint: Record<string,number> = {
    coaster:500, small:700, medium:1100, large:1500, vlarge:2200
  };
  // Age factor: ×0.85 if <5yr, ×1.0 if 5-10, then +5% per year (not ×1.75 at 30yr)
  const maintAgeFactor = age <= 5 ? 0.85 : age <= 10 ? 1.0
    : 1.0 + Math.min((age - 10) * 0.04, 0.50); // +4%/yr, cap at ×1.50
  const maintenancePerDay = Math.round((baseMaint[sc]||1200) * maintAgeFactor);

  // 5. STORES & SPARES
  const storesSpares = Math.round(dwt < 5000 ? 250 : dwt < 10000 ? 350 : dwt < 60000 ? 500 : dwt < 100000 ? 650 : 850);

  // 6. LUBE OIL — based on ME power, with fuel consumption sanity cap
  // DB sometimes has wrong fuel data (e.g. 80t/d for 50k DWT). Cap to reasonable max per size.
  const maxFuelBySize = dwt < 5000 ? 15 : dwt < 10000 ? 20 : dwt < 30000 ? 30 : dwt < 60000 ? 40 : dwt < 100000 ? 55 : 75;
  const cappedFuel = fuelConsumptionTonsDay ? Math.min(fuelConsumptionTonsDay, maxFuelBySize) : undefined;
  const approxMEkW = cappedFuel
    ? cappedFuel * 1000 / 4.08 // SFOC ~170g/kWh, 24h
    : dwt < 5000 ? 1800 : dwt < 10000 ? 3000 : dwt < 60000 ? 7000 : dwt < 100000 ? 11000 : 18000;
  const lubePerDay = approxMEkW * 0.0007 * 24; // total lube liters/day (cyl + system)
  const lubeOilPerDay = Math.round(lubePerDay * rates.lubeOilPrice);

  // 7. MANAGEMENT (own-managed = ~30% cheaper than third-party)
  const mgmtType = managementType || "third-party";
  const baseMgmt = dwt < 5000 ? 350 : dwt < 10000 ? 450 : dwt < 60000 ? 650 : dwt < 100000 ? 850 : 1050;
  const managementPerDay = mgmtType === "own" ? Math.round(baseMgmt * 0.70) : baseMgmt;

  // 8. DRYDOCK (amortized over 5yr)
  const dockCost: Record<string,number> = {
    coaster:250_000, small:400_000, medium:700_000, large:1_200_000, vlarge:2_000_000
  };
  const dockAgeAdj = age > 25 ? 1.3 : age > 20 ? 1.2 : age > 15 ? 1.1 : 1.0;
  const drydockPerDay = Math.round(((dockCost[sc]||800_000) * dockAgeAdj) / (5*365));

  // 9. EU ETS — conservative estimate
  // At sea fuel consumption × fraction of time at sea × EU route share
  // Typical: ~60-70% of time at sea, ~15-20% of voyages touch EU
  const fuelAtSea = cappedFuel || (dwt < 5000 ? 8 : dwt < 10000 ? 12 : dwt < 60000 ? 22 : dwt < 100000 ? 32 : 50);
  const avgDailyFuel = fuelAtSea * 0.65; // ~65% time at sea (rest: port, canal, ballast slow)
  const co2PerDay = avgDailyFuel * 3.15;
  const etsPerTonCO2 = 65; // ~EUR60
  const euShareOfTrading = 0.15; // 15% of trading days involve EU
  const euEtsPerDay = Math.round(co2PerDay * etsPerTonCO2 * euShareOfTrading);

  // TOTAL FIXED OPEX
  const totalFixedOpex = crewCostPerDay + provisionsPerDay + insuranceTotalPerDay +
    maintenancePerDay + storesSpares + lubeOilPerDay + managementPerDay + drydockPerDay + euEtsPerDay;

  // VOYAGE COSTS (variable)
  // Scrubber fuel cost — accounts for open-loop ban zones
  // Sources: NorthStandard, SAFETY4SEA, ICS, DNV (Jul 2026)
  //
  // Open-loop BANNED in ports/waters of:
  //   Europe: Belgium, Denmark, Finland, France, Germany, Ireland, Lithuania,
  //           Netherlands, Norway, Portugal, Spain, Sweden, UK (Forth/Tay),
  //           Gibraltar, Turkey — OSPAR full ban from Jul 2027
  //   Middle East: Bahrain, Saudi Arabia, UAE (Fujairah, Abu Dhabi), Suez Canal
  //   Asia: Singapore, Malaysia, China (all DECA ports + inland + Bohai Bay),
  //         Pakistan (Karachi)
  //   Americas: Panama Canal, California, Connecticut, Bermuda
  //   Med ECA (0.10% S since May 2025) — scrubber technically OK but many
  //           coastal states ban discharge (France, Spain, Portugal)
  //
  // Typical time breakdown for a global trading bulk carrier:
  //   ~45% high seas (scrubber OK, burn HSFO)
  //   ~20% in ECA/SECA waters (need 0.10% S → MGO unless closed-loop)
  //   ~20% in scrubber-ban ports/territorial waters (must burn VLSFO/MGO)
  //   ~15% transiting restricted zones (Panama, Suez, Singapore, China coast)
  //
  // Net: open-loop scrubber usable ~45% of time
  // Closed-loop/hybrid: usable ~65% (OK in most ban zones, not Panama/some ECAs)
  const hasScrubberFlag = hasScrubber || false;
  let fuelPriceEffective = rates.bunkerVLSFO;
  let scrubberSavings = 0;
  if (hasScrubberFlag) {
    const hsfoTime = 0.45;   // high seas, scrubber running
    const vlsfoTime = 0.35;  // ban zones, must use VLSFO
    const mgoTime = 0.20;    // ECA/SECA, must use MGO (0.10% S)
    fuelPriceEffective = Math.round(
      rates.bunkerHSFO * hsfoTime +
      rates.bunkerVLSFO * vlsfoTime +
      rates.bunkerMGO * mgoTime
    );
    scrubberSavings = Math.round(fuelAtSea * 0.65 * (rates.bunkerVLSFO - fuelPriceEffective));
  }
  const fuelCostPerDay = Math.round(fuelAtSea * 0.65 * fuelPriceEffective);
  const portCostsPerDay = Math.round(dwt < 10000 ? 300 : dwt < 60000 ? 550 : dwt < 100000 ? 850 : 1200);
  const totalVoyexPerDay = fuelCostPerDay + portCostsPerDay;

  const totalCostPerDay = totalFixedOpex + totalVoyexPerDay;

  // EARNINGS (TC basis: owner pays OPEX, charterer pays voyage costs)
  const charterRatePerDay = getCharterRate(dwt, shipType, rates);
  const netEarningsPerDay = charterRatePerDay - totalFixedOpex;
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
    scrubberSavingsPerDay: scrubberSavings,
    fuelPriceEffective,
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
