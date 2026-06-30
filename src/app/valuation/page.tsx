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

const BUILDERS = [
  "", "Hyundai Heavy Industries", "Samsung Heavy Industries", "Daewoo (DSME)",
  "Imabari Shipbuilding", "Oshima Shipbuilding", "Tsuneishi Shipbuilding",
  "Namura Shipbuilding", "Japan Marine United", "Mitsubishi Heavy Industries",
  "New Times Shipbuilding", "Yangzijiang", "COSCO Shipping Heavy",
  "Ferus Smit", "Royal Bodewes", "Bodewes Shipyards",
  "Astilleros de Huelva", "Constanta Shipyard", "Other",
];

// ═══ BROKER MODEL (same as daily-valuations.py) ═══
const SIZE_PARAMS: Record<string, [number, number, number, number]> = {
  small:  [2100, 0.10, 0.057, 0.10],
  medium: [1600, 0.10, 0.057, 0.10],
  large:  [14200, 0.32, 0.057, 0.10],
  vlarge: [1100, 0.10, 0.057, 0.40],
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

interface Factor {
  name: string;
  value: number;
  label: string;
  impact: "positive" | "neutral" | "negative";
}

function calculate(dwt: number, yearBuilt: number, shipType: string, builder: string) {
  const year = 2026;
  const age = year - yearBuilt;
  const factors: Factor[] = [];

  // 1. Size class
  const sc = dwt < 10000 ? "small" : dwt < 40000 ? "medium" : dwt < 100000 ? "large" : "vlarge";
  const [A, B, rate, floor] = SIZE_PARAMS[sc];

  // 2. Newbuild price
  const newbuild = A * Math.pow(Math.max(dwt, 500), 1 - B);
  factors.push({ name: "Newbuild Replacement", value: newbuild, label: `$${(newbuild / 1e6).toFixed(1)}M`, impact: "neutral" });

  // 3. Type multiplier
  let tm = 1.0;
  if (!BULK_TYPES.has(shipType)) {
    tm = TYPE_MULT[shipType] || 1.0;
  }
  if (tm !== 1.0) {
    factors.push({ name: "Type Premium", value: tm, label: `×${tm.toFixed(2)}`, impact: tm > 1 ? "positive" : "negative" });
  }

  // 4. Age depreciation
  let ad: number;
  if (age < 0) { ad = 1.10; }
  else if (age <= 2) { ad = 1.05; }
  else if (age <= 5) { ad = 1.0; }
  else { ad = Math.max(floor, Math.exp(-rate * (age - 5))); }
  const adPct = ((1 - ad) * 100).toFixed(0);
  factors.push({
    name: "Age Depreciation",
    value: ad,
    label: age <= 5 ? `${age}yr (new)` : `${age}yr (−${adPct}%)`,
    impact: age <= 5 ? "positive" : age <= 15 ? "neutral" : "negative"
  });

  // 5. Builder
  let bf = 1.0;
  if (builder) {
    const bl = builder.toLowerCase();
    if (PREMIUM_BUILDERS.some(p => bl.includes(p))) { bf = 1.05; }
    else if (DISCOUNT_BUILDERS.some(d => bl.includes(d))) { bf = 0.92; }
  }
  if (bf !== 1.0) {
    factors.push({ name: "Builder", value: bf, label: bf > 1 ? "+5% Premium" : "−8% Discount", impact: bf > 1 ? "positive" : "negative" });
  }

  // 6. Scrap floor
  const scrap = dwt * 0.20 * 480;

  // Final
  const raw = newbuild * tm * ad * bf;
  const final = Math.max(raw, scrap);

  return {
    newbuild: Math.round(newbuild * tm),
    depreciated: Math.round(raw),
    final: Math.round(final),
    scrapValue: Math.round(scrap),
    factors,
    sizeClass: sc,
    age,
    isScrapFloor: final <= scrap * 1.01,
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

  const result = calculate(dwt, yearBuilt, shipType, builder);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-blue-500/10 bg-slate-950/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-400" />
            Vessel Valuation Calculator
          </h1>
          <span className="text-xs text-slate-500">Broker Model v3</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Input Panel */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
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
                    {BUILDERS.filter(b => b).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Model Info */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 text-xs text-slate-500">
              <p className="font-semibold text-slate-400 mb-2">Model: Power-Law × Exponential Depreciation</p>
              <p>Calibrated against 86 real S&P transactions (Q2 2026). Sources: NautiSNP, Xclusiv Shipbrokers, Clarksons, Hellenic Shipping News.</p>
              <p className="mt-2">Size class: <span className="text-blue-400 font-mono">{result.sizeClass}</span> — RMSE: {result.sizeClass === "large" ? "13.5%" : result.sizeClass === "vlarge" ? "20.7%" : result.sizeClass === "medium" ? "24.3%" : "26.9%"}</p>
            </div>
          </div>

          {/* Results Panel */}
          <div className="space-y-6">
            {/* Big Number */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-8 text-center">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Estimated Market Value</p>
              <p className="text-5xl font-black text-blue-400 tracking-tight">{fmt(result.final)}</p>
              <p className="text-sm text-slate-500 mt-2">
                {fmt(Math.round(result.final / dwt))}/DWT
                {result.isScrapFloor && <span className="ml-2 text-amber-400">(at scrap floor)</span>}
              </p>
            </div>

            {/* Factor Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
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
                      {f.name === "Type Premium" && <Ship className="h-4 w-4 text-purple-400" />}
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
                    <span className="text-sm">Scrap Value Floor</span>
                  </div>
                  <span className="text-sm font-bold text-amber-400">{fmt(result.scrapValue)}</span>
                </div>

                {/* Final */}
                <div className="flex justify-between items-center pt-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                    <span className="font-bold">Market Value</span>
                  </div>
                  <span className="text-xl font-black text-blue-400">{fmt(result.final)}</span>
                </div>
              </div>
            </div>

            {/* Depreciation Curve */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold mb-4">Depreciation Curve (this vessel)</h3>
              <div className="h-40">
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
                  {/* Curve */}
                  <polyline
                    fill="none" stroke="#3b82f6" strokeWidth={2}
                    points={Array.from({ length: 31 }, (_, age) => {
                      const [, , rate, floor] = SIZE_PARAMS[result.sizeClass];
                      let ad: number;
                      if (age <= 2) ad = 1.05;
                      else if (age <= 5) ad = 1.0;
                      else ad = Math.max(floor, Math.exp(-rate * (age - 5)));
                      const x = 40 + age * 15;
                      const y = 10 + (1 - ad) * 120;
                      return `${x},${y}`;
                    }).join(" ")}
                  />
                  {/* Current position dot */}
                  {(() => {
                    const age = result.age;
                    const [, , rate, floor] = SIZE_PARAMS[result.sizeClass];
                    let ad: number;
                    if (age <= 2) ad = 1.05;
                    else if (age <= 5) ad = 1.0;
                    else ad = Math.max(floor, Math.exp(-rate * (age - 5)));
                    const x = 40 + Math.min(age, 30) * 15;
                    const y = 10 + (1 - ad) * 120;
                    return (
                      <>
                        <circle cx={x} cy={y} r={5} fill="#3b82f6" stroke="#0f172a" strokeWidth={2} />
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
                <span className="text-amber-400">— Scrap Floor</span>
                <span>30 years</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
