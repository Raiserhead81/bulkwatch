"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Ship, TrendingDown, Wrench, Fuel, Shield, DollarSign, Anchor } from "lucide-react";

const SHIP_TYPES = [
  "Bulk Carrier", "General Cargo", "Handysize", "Handymax", "Supramax", "Ultramax",
  "Panamax", "Kamsarmax", "Post-Panamax", "Capesize", "Newcastlemax", "Valemax",
  "VLCC", "Suezmax", "Aframax", "Product Tanker", "Chemical Tanker", "Crude Oil Tanker",
  "LNG Tanker", "LPG Tanker", "Container Ship", "ULCV", "Neo-Panamax", "Feeder",
  "Car Carrier", "RoRo", "RoPax", "Cruise Ship", "Ferry",
  "Reefer", "Multipurpose", "Heavy Lift", "Offshore", "OSV", "Tug",
];

const BUILDER_GROUPS: Record<string, string[]> = {
  "Japan": [
    "Hakodate Dock","Hakata Shipbuilding","Higaki Shipbuilding","Honda Heavy Industries",
    "IHI Corporation","IHI Marine United","Imabari Shipbuilding",
    "Japan Marine United Corporation","Kawasaki Heavy Industries","Kitanihon Shipbuilding",
    "Mitsubishi Heavy Industries","Mitsui Engineering & Shipbuilding",
    "Namura Shipbuilding","NKK","Onomichi Dockyard","Oshima Shipbuilding",
    "Sasebo Heavy Industries","Shin Kurushima Dockyard",
    "Sumitomo Heavy Industries","Tsuneishi Shipbuilding","Universal Shipbuilding","Yamanishi Zosen",
  ],
  "South Korea": [
    "Daehan Shipbuilding","Daewoo Shipbuilding","Hanwha Ocean","HD Hyundai Heavy Industries",
    "HD Hyundai Mipo","HD Hyundai Samho","HJ Shipbuilding & Construction",
    "Hyundai Heavy Industries","Samsung Heavy Industries",
    "SPP Shipbuilding Co., Ltd.","STX Offshore & Shipbuilding",
    "Sungdong Shipbuilding & Marine Engineering",
  ],
  "China": [
    "Bohai Shipbuilding","Chengxi Shipyard","China Shipbuilding","CSC Jinling",
    "Dalian Shipbuilding Industry Company","Guangzhou Wenchong Shipyard",
    "Hudong-Zhonghua Shipbuilding","Jiangnan Shipyard",
    "Jiangsu Yangzijiang Shipbuilding","New Times Shipbuilding",
    "Shanghai Waigaoqiao Shipbuilding","Wuhu Shipyard","Xiamen Shipbuilding Industry",
    "Yangfan Group Co.","Yangzhou Binjiang Shipbuilding",
  ],
  "Europe — Germany": [
    "Bremer Vulkan","Cassens Werft GmbH","Flensburger Schiffbau-Gesellschaft",
    "Flender Werke","Howaldtswerke-Deutsche Werft","Meyer Werft","Meyer Wismar",
    "Nordseewerke","P+S Werften","Peene-Werft","Peters Werft","Rolandwerft",
    "Schichau Seebeckwerft","Volkswerft",
  ],
  "Europe — Netherlands": [
    "Barkmeijer Shipyards","Bodewes Shipyards","Damen Group",
    "Ferus Smit","Royal Bodewes","Royal IHC","Royal Niestern Sander",
  ],
  "Europe — Scandinavia": [
    "Eriksbergs Mekaniska Verkstad","Havyard Ship Technology","Kleven Verft",
    "Kockums","Odense Steel Shipyard","Ulstein Verft","Vard Brattvaag",
  ],
  "Europe — Other": [
    "3. Maj","Brodosplit","Bulyard","Chantiers de lAtlantique",
    "Fincantieri","Harland and Wolff","Mangalia Shipyard","Remontowa",
    "Stocznia Gdynia","Szczecin Shipyard","Uljanik",
  ],
  "Other": [
    "ABG Shipyard","CSBC Corporation, Taiwan","Hijos de J. Barreras",
  ],
};
const BUILDERS = Object.values(BUILDER_GROUPS).flat();

// ═══ HEDONIC PRICING MODEL v4 (mirrors priceEstimator.ts) ═══

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
  "VLCC":              { dwt: 300000, nb: 125_000_000 },
  "Suezmax":           { dwt: 157000, nb: 85_000_000  },
  "Aframax":           { dwt: 115000, nb: 65_000_000  },
  "Product Tanker":    { dwt: 50000,  nb: 44_000_000  },
  "Chemical Tanker":   { dwt: 25000,  nb: 42_000_000  },
  "Crude Oil Tanker":  { dwt: 105000, nb: 60_000_000  },
  "Oil/Chemical Tanker": { dwt: 45000, nb: 40_000_000 },
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
  "Bulk Carrier":      { dwt: 60000,  nb: 34_000_000  },
};

const FALLBACK_TYPE_MULT: Record<string, number> = {
  "Valemax": 1.05, "VLOC": 1.00, "Gearless": 0.98, "Geared": 0.95,
  "Tanker": 1.10, "ULCV": 1.60, "Neo-Panamax": 1.30, "Feeder": 0.80,
  "RoPax": 1.80, "Cruise Ship": 4.50, "Passenger": 3.00, "Ferry": 1.60,
  "OSV": 1.80, "Offshore": 1.60, "Tug": 2.50, "Dredger": 1.50,
};

const CAPESIZE_TYPES  = new Set(["Capesize", "Newcastlemax", "Valemax", "VLOC", "Post-Panamax"]);
const PANAMAX_TYPES   = new Set(["Panamax", "Kamsarmax", "Gearless"]);
const SUPRAMAX_TYPES  = new Set(["Supramax", "Ultramax", "Geared"]);
const HANDYSIZE_TYPES = new Set(["Handysize", "Handymax", "Mini-Bulker"]);

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

const SCRAP_PER_LDT = 478;
const MARKET_CHARTER = { capesize: 29000, panamax: 21500, supramax: 24000, handysize: 13500 };
const MARKET_BDI_DEFAULT = 2562;

interface Factor {
  name: string;
  value: number;
  label: string;
  impact: "positive" | "neutral" | "negative";
}

function calcNewbuild(shipType: string, dwt: number): number {
  const safeDwt = Math.max(dwt, 500);
  if (NEWBUILD_PRICES[shipType]) {
    const ref = NEWBUILD_PRICES[shipType];
    return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7);
  }
  const ref  = NEWBUILD_PRICES["Bulk Carrier"];
  const mult = FALLBACK_TYPE_MULT[shipType] ?? 1.0;
  return ref.nb * Math.pow(safeDwt / ref.dwt, 0.7) * mult;
}

function calcDepreciation(age: number): number {
  if (age <= 0) return 1.10;
  if (age <= 2) return 1.02;
  if (age <= 5) return 1.0 - (age - 2) * 0.015;
  const base = Math.max(0.08, Math.exp(-0.065 * (age - 5)));
  let surveyPenalty = 0;
  for (const surveyYear of [5, 10, 15, 20, 25]) {
    if (age === surveyYear)     { surveyPenalty = 0.03;  break; }
    if (age === surveyYear - 1) { surveyPenalty = 0.015; break; }
  }
  return Math.max(0.08, base - surveyPenalty);
}

function calcMarketFactor(shipType: string, bdiOverride: number): number {
  let rate: number;
  let baseline: number;

  if (CAPESIZE_TYPES.has(shipType)) {
    rate = MARKET_CHARTER.capesize; baseline = 22000;
  } else if (PANAMAX_TYPES.has(shipType)) {
    rate = MARKET_CHARTER.panamax; baseline = 16000;
  } else if (SUPRAMAX_TYPES.has(shipType)) {
    rate = MARKET_CHARTER.supramax; baseline = 14000;
  } else if (HANDYSIZE_TYPES.has(shipType)) {
    rate = MARKET_CHARTER.handysize; baseline = 11000;
  } else {
    // Non-bulk: use BDI override scaled to factor
    const ratio = bdiOverride / 1500;
    return 0.85 + 0.15 * Math.pow(Math.max(ratio, 0), 0.5);
  }

  const ratio = rate / baseline;
  return 0.85 + 0.15 * Math.pow(ratio, 0.5);
}

function calcBuilderFactor(builder: string): number {
  if (!builder) return 1.0;
  const bl = builder.toLowerCase();
  if (TIER1_BUILDERS.some(p => bl.includes(p))) return 1.07;
  if (TIER2_BUILDERS.some(p => bl.includes(p))) return 1.015;
  if (TIER4_BUILDERS.some(p => bl.includes(p))) return 0.925;
  return 1.0;
}

function calcScrap(dwt: number, shipType: string): number {
  const ldt = dwt * (LDT_RATIOS[shipType] ?? 0.20);
  return ldt * SCRAP_PER_LDT;
}

function calculate(dwt: number, yearBuilt: number, shipType: string, builder: string, fuelType: string = "conventional", surveyStatus: string = "mid_cycle", bdiOverride: number = 2490) {
  const year = 2026;
  const age = year - yearBuilt;
  const factors: Factor[] = [];

  // 1. Newbuild price (segment-specific + DWT scaling)
  const newbuild = calcNewbuild(shipType, dwt);
  factors.push({ name: "Newbuild Replacement", value: newbuild, label: `$${(newbuild / 1e6).toFixed(1)}M`, impact: "neutral" });

  // 2. Hedonic depreciation with survey-cycle penalties
  const dep = calcDepreciation(age);
  const depPct = ((1 - dep) * 100).toFixed(0);
  const surveyYears = [5, 10, 15, 20, 25];
  let ageLabel = age <= 5
    ? `${age}yr (new)`
    : `${age}yr (−${depPct}%)${surveyYears.includes(age) ? " [SURVEY]" : surveyYears.includes(age + 1) ? " [pre-survey]" : ""}`;
  factors.push({
    name: "Age Depreciation",
    value: dep,
    label: ageLabel,
    impact: age <= 5 ? "positive" : age <= 15 ? "neutral" : "negative",
  });

  // 3. Segment-specific market factor
  const mf = calcMarketFactor(shipType, bdiOverride);
  const mfSegLabel = CAPESIZE_TYPES.has(shipType)  ? `Capesize $${MARKET_CHARTER.capesize.toLocaleString()}/d`
                   : PANAMAX_TYPES.has(shipType)    ? `Panamax $${MARKET_CHARTER.panamax.toLocaleString()}/d`
                   : SUPRAMAX_TYPES.has(shipType)   ? `Supramax $${MARKET_CHARTER.supramax.toLocaleString()}/d`
                   : HANDYSIZE_TYPES.has(shipType)  ? `Handysize $${MARKET_CHARTER.handysize.toLocaleString()}/d`
                   : `BDI ${bdiOverride}`;
  factors.push({
    name: "Market Factor",
    value: mf,
    label: `${mfSegLabel} (×${mf.toFixed(3)})`,
    impact: mf > 1.02 ? "positive" : mf < 0.98 ? "negative" : "neutral",
  });

  // 4. Builder quality (3-tier)
  const bf = calcBuilderFactor(builder);
  if (bf !== 1.0) {
    const tier = bf >= 1.05 ? "Tier 1 (+7%)" : bf >= 1.01 ? "Tier 2 (+1.5%)" : "Tier 4 (−7.5%)";
    factors.push({ name: "Builder", value: bf, label: `${tier}`, impact: bf >= 1.0 ? "positive" : "negative" });
  }

  // 5. Eco premium (fuel type)
  let eco = 1.0;
  if (fuelType === "scrubber")   { eco = 1.03; factors.push({ name: "Scrubber Fitted",  value: eco, label: "+3%",  impact: "positive" }); }
  else if (fuelType === "lng_ready") { eco = 1.08; factors.push({ name: "LNG/Dual Fuel", value: eco, label: "+8%",  impact: "positive" }); }
  else if (fuelType === "methanol")  { eco = 1.06; factors.push({ name: "Methanol Ready", value: eco, label: "+6%", impact: "positive" }); }
  else if (fuelType === "tier3")     { eco = 1.02; factors.push({ name: "IMO Tier III",   value: eco, label: "+2%", impact: "positive" }); }

  // 6. Survey status
  let sv = 1.0;
  if (surveyStatus === "freshly_surveyed") { sv = 1.05; factors.push({ name: "Survey Status", value: sv, label: "Fresh SS (+5%)",    impact: "positive" }); }
  else if (surveyStatus === "due_soon")    { sv = 0.95; factors.push({ name: "Survey Due",    value: sv, label: "Due <12mo (−5%)",   impact: "negative" }); }
  else if (surveyStatus === "overdue")     { sv = 0.88; factors.push({ name: "Survey Overdue", value: sv, label: "Overdue (−12%)",   impact: "negative" }); }

  // 7. Scrap floor (LDT-based)
  const scrapValue = calcScrap(dwt, shipType);

  // Final
  const raw   = newbuild * dep * mf * bf * eco * sv;
  const final = Math.max(raw, scrapValue);

  // Determine size class label for display
  let sizeClass = "custom";
  if (CAPESIZE_TYPES.has(shipType))  sizeClass = "capesize";
  else if (PANAMAX_TYPES.has(shipType))   sizeClass = "panamax";
  else if (SUPRAMAX_TYPES.has(shipType))  sizeClass = "supramax";
  else if (HANDYSIZE_TYPES.has(shipType)) sizeClass = "handysize";
  else if (NEWBUILD_PRICES[shipType])     sizeClass = shipType.toLowerCase().replace(/ /g, "_");

  return {
    newbuild: Math.round(newbuild),
    depreciated: Math.round(raw),
    final: Math.round(final),
    scrapValue: Math.round(scrapValue),
    factors,
    sizeClass,
    age,
    isScrapFloor: final <= scrapValue * 1.01,
    depFactor: dep,
  };
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export default function ValuationPage() {
  const [dwt, setDwt] = useState(35000);
  const [yearBuilt, setYearBuilt] = useState(2016);
  const [shipType, setShipType] = useState("Bulk Carrier");
  const [builder, setBuilder] = useState("");
  const [fuelType, setFuelType] = useState("conventional");
  const [surveyStatus, setSurveyStatus] = useState("mid_cycle");
  const [bdiOverride, setBdiOverride] = useState(2490);

  const result = calculate(dwt, yearBuilt, shipType, builder, fuelType, surveyStatus, bdiOverride);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-white">
      {/* Header */}
      <header className="border-b border-blue-500/10 bg-white/90 dark:bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[95%] mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-400" />
            Vessel Valuation Calculator
          </h1>
          <span className="text-xs text-slate-500">Hedonic Model v4</span>
        </div>
      </header>

      <div className="max-w-[95%] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Input Panel */}
          <div className="space-y-6">
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Ship className="h-5 w-5 text-blue-400" /> Vessel Specifications
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Deadweight (DWT)</label>
                  <input type="range" min={500} max={400000} step={500} value={dwt}
                    onChange={e => setDwt(Number(e.target.value))}
                    className="w-full mt-2 accent-blue-500" />
                  <div className="flex justify-between mt-1">
                    <input type="number" value={dwt} onChange={e => setDwt(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-32 text-blue-400 font-bold" />
                    <span className="text-xs text-slate-500 self-end">
                      {dwt < 10000 ? "Coaster/Small Cargo" : dwt < 40000 ? "Handysize" : dwt < 65000 ? "Supramax/Ultramax" : dwt < 85000 ? "Panamax/Kamsarmax" : dwt < 200000 ? "Capesize" : "VLOC/Newcastlemax"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Year Built</label>
                  <input type="range" min={1970} max={2027} value={yearBuilt}
                    onChange={e => setYearBuilt(Number(e.target.value))}
                    className="w-full mt-2 accent-blue-500" />
                  <div className="flex justify-between mt-1">
                    <input type="number" value={yearBuilt} onChange={e => setYearBuilt(Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm w-24 text-blue-400 font-bold" />
                    <span className="text-xs text-slate-500 self-end">{result.age} years old</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vessel Type</label>
                  <select value={shipType} onChange={e => setShipType(e.target.value)}
                    className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                    {SHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Builder / Shipyard</label>
                  <select value={builder} onChange={e => setBuilder(e.target.value)}
                    className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                    <option value="">Unknown / Other</option>
                    {Object.entries(BUILDER_GROUPS).map(([country, builders]) => (
                      <optgroup key={country} label={country}>
                        {builders.map(b => <option key={b} value={b}>{b}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Eco & Market Adjustments */}
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Fuel className="h-5 w-5 text-emerald-400" /> Eco & Market
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fuel Type / Eco Premium</label>
                  <select value={fuelType} onChange={e => setFuelType(e.target.value)}
                    className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                    <option value="conventional">Conventional (VLSFO/HSFO)</option>
                    <option value="scrubber">Scrubber Fitted (+3%)</option>
                    <option value="lng_ready">LNG Ready / Dual Fuel (+8%)</option>
                    <option value="methanol">Methanol Ready (+6%)</option>
                    <option value="tier3">IMO Tier III NOx (+2%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Survey Status</label>
                  <select value={surveyStatus} onChange={e => setSurveyStatus(e.target.value)}
                    className="w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                    <option value="freshly_surveyed">Freshly Surveyed (SS passed, +5%)</option>
                    <option value="mid_cycle">Mid-Cycle (normal)</option>
                    <option value="due_soon">{"Survey Due <12mo (-5%)"}</option>
                    <option value="overdue">Overdue / Conditional (-12%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">BDI Override (non-bulk segments)</label>
                  <input type="range" min={500} max={5000} step={50} value={bdiOverride}
                    onChange={e => setBdiOverride(Number(e.target.value))}
                    className="w-full mt-2 accent-blue-500" />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-500">BDI: {bdiOverride}</span>
                    <span className={"text-xs font-bold " + (bdiOverride > 3000 ? "text-emerald-400" : bdiOverride > 1500 ? "text-blue-400" : bdiOverride > 800 ? "text-amber-400" : "text-red-400")}>
                      {bdiOverride > 3000 ? "Strong Market" : bdiOverride > 1500 ? "Firm" : bdiOverride > 800 ? "Normal" : "Weak Market"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Info */}
            <div className="bg-slate-200/50 dark:bg-slate-900/50 border border-slate-300/50 dark:border-slate-800/50 rounded-2xl p-5 text-xs text-slate-500">
              <p className="font-semibold text-slate-400 mb-2">Model: Hedonic Pricing v4 — 27 Segments × Survey-Cycle Depreciation</p>
              <p>Calibrated against 86 real S&P transactions (Q2 2026). Sources: NautiSNP, Xclusiv Shipbrokers, Clarksons, Hellenic Shipping News.</p>
              <p className="mt-2">Segment: <span className="text-blue-400 font-mono">{result.sizeClass}</span> — Market data: 01 Jul 2026</p>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Big Number */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-8 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Estimated Market Value</p>
              <p className="text-7xl font-black text-blue-400 tracking-tight">{fmt(result.final)}</p>
              <p className="text-sm text-slate-500 mt-2">
                {fmt(Math.round(result.final / dwt))}/DWT
                {result.isScrapFloor && <span className="ml-2 text-amber-400">(at scrap floor)</span>}
              </p>
            </div>

            {/* Factor Breakdown */}
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-slate-400" /> Valuation Breakdown
              </h3>

              <div className="space-y-3">
                {/* Newbuild */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Anchor className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm">Newbuild Replacement Cost</span>
                  </div>
                  <span className="text-sm font-bold text-cyan-400">{fmt(result.newbuild)}</span>
                </div>

                {/* Factors */}
                {result.factors.filter(f => f.name !== "Newbuild Replacement").map((f, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-800/50">
                    <div className="flex items-center gap-2">
                      {f.name === "Age Depreciation" && <TrendingDown className="h-4 w-4 text-red-400" />}
                      {f.name === "Market Factor" && <Ship className="h-4 w-4 text-blue-400" />}
                      {f.name === "Builder" && <Wrench className="h-4 w-4 text-amber-400" />}
                      <span className="text-sm">{f.name}</span>
                    </div>
                    <span className={`text-sm font-bold ${f.impact === "positive" ? "text-emerald-400" : f.impact === "negative" ? "text-red-400" : "text-slate-300"}`}>
                      {f.label}
                    </span>
                  </div>
                ))}

                {/* Scrap Floor */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <span className="text-sm">Scrap Value Floor (LDT-based)</span>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{fmt(result.scrapValue)}</span>
                </div>

                {/* Final */}
                <div className="flex justify-between items-center pt-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                    <span className="font-bold">Market Value</span>
                  </div>
                  <span className="text-3xl font-black text-blue-400">{fmt(result.final)}</span>
                </div>
              </div>
            </div>

            {/* Depreciation Curve */}
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold mb-4">Depreciation Curve (this vessel)</h3>
              <div className="h-56">
                <svg viewBox="0 0 500 140" className="w-full h-full">
                  {/* Grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
                    <g key={i}>
                      <line x1={40} y1={10 + (1 - pct) * 120} x2={490} y2={10 + (1 - pct) * 120} stroke="#1e293b" strokeWidth={0.5} />
                      <text x={35} y={14 + (1 - pct) * 120} textAnchor="end" fill="#64748b" fontSize={9}>
                        {fmt(result.newbuild * pct)}
                      </text>
                    </g>
                  ))}
                  {/* X axis labels */}
                  {[0, 5, 10, 15, 20, 25, 30].map(yr => (
                    <text key={yr} x={40 + yr * 15} y={138} textAnchor="middle" fill="#64748b" fontSize={9}>{yr}yr</text>
                  ))}
                  {/* Curve — hedonic depreciation with survey penalties */}
                  <polyline
                    fill="none" stroke="#3b82f6" strokeWidth={2}
                    points={Array.from({ length: 31 }, (_, age) => {
                      let dep: number;
                      if (age <= 0) dep = 1.10;
                      else if (age <= 2) dep = 1.02;
                      else if (age <= 5) dep = 1.0 - (age - 2) * 0.015;
                      else {
                        const base = Math.max(0.08, Math.exp(-0.065 * (age - 5)));
                        let sp = 0;
                        for (const sy of [5, 10, 15, 20, 25]) {
                          if (age === sy) { sp = 0.03; break; }
                          if (age === sy - 1) { sp = 0.015; break; }
                        }
                        dep = Math.max(0.08, base - sp);
                      }
                      const x = 40 + age * 15;
                      const y = 10 + (1 - dep) * 120;
                      return `${x},${y}`;
                    }).join(" ")}
                  />
                  {/* Survey year markers */}
                  {[5, 10, 15, 20, 25].map(sy => {
                    let dep: number;
                    const base = Math.max(0.08, Math.exp(-0.065 * (sy - 5)));
                    dep = Math.max(0.08, base - 0.03);
                    if (sy === 5) dep = 1.0 - (5 - 2) * 0.015 - 0.03;
                    return (
                      <circle key={sy} cx={40 + sy * 15} cy={10 + (1 - dep) * 120}
                        r={3} fill="#f59e0b" stroke="#1e293b" strokeWidth={1} />
                    );
                  })}
                  {/* Current position dot */}
                  {(() => {
                    const age = Math.max(0, result.age);
                    const dep = result.depFactor;
                    const x = 40 + Math.min(age, 30) * 15;
                    const y = 10 + (1 - dep) * 120;
                    return (
                      <>
                        <circle cx={x} cy={y} r={5} fill="#3b82f6" stroke="#1e293b" strokeWidth={2} />
                        <text x={x} y={y - 10} textAnchor="middle" fill="#3b82f6" fontSize={10} fontWeight="bold">
                          {fmt(result.final)}
                        </text>
                      </>
                    );
                  })()}
                  {/* Scrap floor line */}
                  <line x1={40} y1={10 + (1 - result.scrapValue / result.newbuild) * 120} x2={490} y2={10 + (1 - result.scrapValue / result.newbuild) * 120}
                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,4" />
                </svg>
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1 px-10">
                <span>New</span>
                <span className="text-amber-400">— Scrap Floor &nbsp; <span className="text-amber-300">&#9679; Survey years</span></span>
                <span>30 years</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
