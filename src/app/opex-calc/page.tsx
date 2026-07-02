"use client";

import { useState, useEffect, useMemo } from "react";
import { calculateOpex, fetchLiveRates, type LiveOpexRates } from "@/lib/opex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Ship types in the order requested ──────────────────────────
const SHIP_TYPES = [
  "Capesize","Kamsarmax","Panamax","Ultramax","Supramax","Handymax","Handysize",
  "Mini-Bulker","VLCC","Suezmax","Aframax","Product Tanker","Chemical Tanker",
  "Container Ship","LNG Tanker","LPG Tanker","Car Carrier","RoRo","General Cargo",
];

// ── Top-20 flags ───────────────────────────────────────────────
const FLAGS = [
  "Panama","Liberia","Marshall Islands","Hong Kong","Singapore","Malta","Bahamas",
  "Greece","Norway","Japan","Bermuda","Cyprus","United Kingdom","Denmark",
  "Germany","China","South Korea","Antigua and Barbuda","Isle of Man","India",
];

// ── Auto-calculate fuel consumption from DWT + type ────────────
function defaultFuel(dwt: number, shipType: string): number {
  if (shipType === "LNG Tanker") return Math.round(dwt * 0.00027 + 55);
  if (shipType === "VLCC" || shipType === "Suezmax") return Math.round(dwt * 0.00020 + 25);
  if (shipType === "Container Ship") return Math.round(Math.pow(dwt, 0.6) * 0.18);
  if (shipType === "Aframax") return Math.round(dwt * 0.00022 + 18);
  return Math.round(dwt * 0.00035 + 6);
}

// ── Auto-calculate crew size from DWT ──────────────────────────
function defaultCrew(dwt: number): number {
  if (dwt < 5000)  return 12;
  if (dwt < 10000) return 14;
  if (dwt < 60000) return 18;
  if (dwt < 100000) return 21;
  return 24;
}

// ── Estimate ship value using same logic as priceEstimator ─────
function estimateValueM(shipType: string, dwt: number, yearBuilt: number): number {
  const NB: Record<string, { dwt: number; nb: number }> = {
    "Capesize":       { dwt:180000, nb:70e6 }, "Kamsarmax":   { dwt:82000,  nb:38e6 },
    "Panamax":        { dwt:77000,  nb:35e6 }, "Ultramax":    { dwt:64000,  nb:35e6 },
    "Supramax":       { dwt:58000,  nb:33e6 }, "Handymax":    { dwt:50000,  nb:32e6 },
    "Handysize":      { dwt:38000,  nb:31e6 }, "Mini-Bulker": { dwt:12000,  nb:18e6 },
    "VLCC":           { dwt:300000, nb:125e6}, "Suezmax":     { dwt:157000, nb:85e6 },
    "Aframax":        { dwt:115000, nb:65e6 }, "Product Tanker":{ dwt:50000,nb:44e6 },
    "Chemical Tanker":{ dwt:25000,  nb:42e6 }, "Container Ship":{ dwt:70000,nb:95e6 },
    "LNG Tanker":     { dwt:80000,  nb:250e6}, "LPG Tanker":  { dwt:50000,  nb:85e6 },
    "Car Carrier":    { dwt:15000,  nb:70e6 }, "RoRo":        { dwt:12000,  nb:45e6 },
    "General Cargo":  { dwt:10000,  nb:18e6 },
  };
  const ref = NB[shipType] || { dwt:50000, nb:32e6 };
  const nb = ref.nb * Math.pow(Math.max(dwt,500) / ref.dwt, 0.7);
  const age = new Date().getFullYear() - yearBuilt;
  const dep = age <= 0 ? 1.12 : age <= 2 ? 1.08 : age <= 5 ? 1.0 - (age-2)*0.02
    : age <= 9 ? 0.94-(age-5)*0.04 : age <= 14 ? 0.78-(age-9)*0.058
    : age <= 20 ? 0.52-(age-14)*0.037 : age <= 25 ? 0.30-(age-20)*0.03
    : Math.max(0.08, 0.15-(age-25)*0.015);
  return Math.round((nb * dep) / 1e6 * 10) / 10;
}

// ── Format helpers ─────────────────────────────────────────────
function fmt(n: number) { return `$${Math.round(n).toLocaleString("en-US")}`; }
function fmtM(n: number) { return `$${(n/1e6).toFixed(2)}M`; }

interface Inputs {
  shipType: string; dwt: number; yearBuilt: number; crewSize: number;
  flag: string; management: "own" | "third-party"; scrubber: boolean;
  fuelConsumption: number; estimatedValueM: number;
  fuelManual: boolean; crewManual: boolean; valueManual: boolean;
}

const DEFAULTS: Inputs = {
  shipType: "Handymax", dwt: 50000, yearBuilt: 2015, crewSize: 18,
  flag: "Panama", management: "third-party", scrubber: false,
  fuelConsumption: defaultFuel(50000, "Handymax"),
  estimatedValueM: estimateValueM("Handymax", 50000, 2015),
  fuelManual: false, crewManual: false, valueManual: false,
};

// ── Fuel time splits for display ───────────────────────────────
const SCRUBBER_SPLITS = { hsfo: 0.45, vlsfo: 0.35, mgo: 0.20 };

export default function OpexCalcPage() {
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const [rates, setRates] = useState<LiveOpexRates | null>(null);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Load live rates once on mount
  useEffect(() => {
    fetchLiveRates().then(r => { setRates(r); setRatesLoaded(true); });
  }, []);

  // Derive auto-values when key inputs change
  function update(patch: Partial<Inputs>) {
    setInp(prev => {
      const next = { ...prev, ...patch };
      // Auto-recalc fuel unless manually set
      if (!next.fuelManual && ("dwt" in patch || "shipType" in patch)) {
        next.fuelConsumption = defaultFuel(next.dwt, next.shipType);
      }
      // Auto-recalc crew unless manually set
      if (!next.crewManual && "dwt" in patch) {
        next.crewSize = defaultCrew(next.dwt);
      }
      // Auto-recalc value unless manually set
      if (!next.valueManual && ("dwt" in patch || "shipType" in patch || "yearBuilt" in patch)) {
        next.estimatedValueM = estimateValueM(next.shipType, next.dwt, next.yearBuilt);
      }
      return next;
    });
  }

  function reset() {
    const fresh: Inputs = {
      shipType: "Handymax", dwt: 50000, yearBuilt: 2015, crewSize: 18,
      flag: "Panama", management: "third-party", scrubber: false,
      fuelConsumption: defaultFuel(50000, "Handymax"),
      estimatedValueM: estimateValueM("Handymax", 50000, 2015),
      fuelManual: false, crewManual: false, valueManual: false,
    };
    setInp(fresh);
  }

  // Compute OPEX
  const result = useMemo(() => {
    return calculateOpex(
      inp.dwt, inp.yearBuilt, inp.shipType,
      inp.estimatedValueM * 1e6,
      inp.flag, inp.fuelConsumption, inp.crewSize,
      undefined,
      inp.management, inp.scrubber,
    );
  }, [inp, ratesLoaded]);

  const age = new Date().getFullYear() - inp.yearBuilt;
  const liveDate = rates?.date || "—";

  // Fuel price display
  const bunkerVLSFO = rates?.bunkerVLSFO || 533;
  const bunkerHSFO  = rates?.bunkerHSFO  || 391;
  const bunkerMGO   = rates?.bunkerMGO   || 746;

  const netIsPositive = result.netEarningsPerDay >= 0;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              ⚙️ OPEX Calculator
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Broker-level daily operating cost breakdown — Drewry/Baltic calibrated
            </p>
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ↺ Reset to Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">

          {/* ── LEFT: Input panel ─────────────────────────────── */}
          <div className="space-y-4">

            {/* Ship identity */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ship Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Ship Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Ship Type</label>
                  <select
                    value={inp.shipType}
                    onChange={e => update({ shipType: e.target.value, fuelManual: false, valueManual: false })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* DWT */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    DWT <span className="text-slate-400">{inp.dwt.toLocaleString("en-US")}</span>
                  </label>
                  <input
                    type="number" min={1000} max={400000} step={1000}
                    value={inp.dwt}
                    onChange={e => update({ dwt: Math.max(1000, Math.min(400000, +e.target.value)) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <input
                    type="range" min={1000} max={400000} step={1000}
                    value={inp.dwt}
                    onChange={e => update({ dwt: +e.target.value })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>1k</span><span>400k</span>
                  </div>
                </div>

                {/* Year Built */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Year Built</label>
                  <input
                    type="number" min={1990} max={2026}
                    value={inp.yearBuilt}
                    onChange={e => update({ yearBuilt: Math.max(1990, Math.min(2026, +e.target.value)) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Age: {age} years</p>
                </div>

                {/* Crew Size */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Crew Size
                    {!inp.crewManual && <span className="ml-1 text-xs text-blue-400">(auto)</span>}
                  </label>
                  <input
                    type="number" min={10} max={30}
                    value={inp.crewSize}
                    onChange={e => update({ crewSize: Math.max(10, Math.min(30, +e.target.value)), crewManual: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Flag */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Flag</label>
                  <select
                    value={inp.flag}
                    onChange={e => update({ flag: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {FLAGS.map(f => <option key={f}>{f}</option>)}
                  </select>
                  {result.flagMultiplier !== 1.0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Crew cost ×{result.flagMultiplier.toFixed(2)} vs. Filipino baseline
                    </p>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* Operations */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Operations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* Management */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Management</label>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {(["third-party","own"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => update({ management: m })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          inp.management === m
                            ? "bg-blue-500 text-white"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {m === "third-party" ? "Third-Party" : "Own Managed"}
                      </button>
                    ))}
                  </div>
                  {inp.management === "own" && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">~30% management fee savings</p>
                  )}
                </div>

                {/* Scrubber */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Scrubber</label>
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {([false, true] as const).map(v => (
                      <button
                        key={String(v)}
                        onClick={() => update({ scrubber: v })}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          inp.scrubber === v
                            ? (v ? "bg-emerald-500 text-white" : "bg-slate-400 text-white")
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {v ? "✓ Fitted" : "Not Fitted"}
                      </button>
                    ))}
                  </div>
                  {inp.scrubber && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      HSFO {SCRUBBER_SPLITS.hsfo*100}% · VLSFO {SCRUBBER_SPLITS.vlsfo*100}% · MGO {SCRUBBER_SPLITS.mgo*100}%
                    </p>
                  )}
                </div>

                {/* Fuel Consumption */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Fuel Consumption (t/day)
                    {!inp.fuelManual && <span className="ml-1 text-xs text-blue-400">(auto)</span>}
                  </label>
                  <input
                    type="number" min={1} max={200} step={0.5}
                    value={inp.fuelConsumption}
                    onChange={e => update({ fuelConsumption: Math.max(1, +e.target.value), fuelManual: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Estimated Value */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Estimated Value ($M)
                    {!inp.valueManual && <span className="ml-1 text-xs text-blue-400">(auto)</span>}
                  </label>
                  <input
                    type="number" min={0.5} max={1000} step={0.5}
                    value={inp.estimatedValueM}
                    onChange={e => update({ estimatedValueM: Math.max(0.5, +e.target.value), valueManual: true })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </CardContent>
            </Card>

            {/* Bunker prices */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardContent className="pt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Live Bunker Prices</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-xs text-slate-400 mb-0.5">VLSFO</div>
                    <div className="text-sm font-bold">${bunkerVLSFO}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-xs text-slate-400 mb-0.5">HSFO</div>
                    <div className="text-sm font-bold">${bunkerHSFO}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
                    <div className="text-xs text-slate-400 mb-0.5">MGO</div>
                    <div className="text-sm font-bold">${bunkerMGO}</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Bunker prices: Singapore, {liveDate}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Output panel ───────────────────────────── */}
          <div className="space-y-4">

            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 p-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Total Fixed OPEX/day</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{fmt(result.totalFixedOpex)}</p>
              </div>
              <div className="rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 p-4">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wide">Fuel/day</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{fmt(result.fuelCostPerDay)}</p>
              </div>
              <div className={`rounded-xl border p-4 ${
                netIsPositive
                  ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20"
                  : "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20"
              }`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${netIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  Net Earnings/day
                </p>
                <p className={`text-2xl font-bold mt-1 ${netIsPositive ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                  {result.netEarningsPerDay >= 0 ? "+" : ""}{fmt(result.netEarningsPerDay)}
                </p>
              </div>
            </div>

            {/* Daily cost breakdown */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Daily Fixed OPEX Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr className="py-2">
                      <td className="py-2 text-slate-600 dark:text-slate-400 w-1/2">
                        Crew
                        <span className="ml-2 text-xs text-slate-400">{result.crewCount} crew · ×{result.flagMultiplier.toFixed(2)} flag</span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.crewCostPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Provisions</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.provisionsPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        Insurance H&M
                        <span className="ml-2 text-xs text-slate-400">
                          {age > 20 ? "+25% age load" : age > 15 ? "+15% age load" : age > 10 ? "+8% age load" : ""}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.insuranceHMPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Insurance P&I</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.insurancePnIPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        Maintenance
                        <span className="ml-2 text-xs text-slate-400">
                          age factor ×{(1 + Math.min(Math.max(0, age - 10) * 0.04, 0.50)).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.maintenancePerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Stores & Spares</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.storesSpares)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Lube Oil</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.lubeOilPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        Management
                        <span className="ml-2">
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {inp.management === "own" ? "Own" : "3rd Party"}
                          </Badge>
                        </span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.managementPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Drydock (amortized 5yr)</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.drydockPerDay)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        EU ETS
                        <span className="ml-2 text-xs text-slate-400">~15% EU exposure</span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.euEtsPerDay)}</td>
                    </tr>
                    <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold">
                      <td className="py-2.5 px-2 rounded-l text-blue-700 dark:text-blue-300">Total Fixed OPEX</td>
                      <td className="py-2.5 px-2 rounded-r text-right text-blue-700 dark:text-blue-300">{fmt(result.totalFixedOpex)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Fuel costs */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Fuel Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {inp.scrubber ? (
                      <>
                        <tr>
                          <td className="py-2 text-slate-600 dark:text-slate-400">
                            HSFO <span className="text-xs text-slate-400">({SCRUBBER_SPLITS.hsfo*100}% of time · ${bunkerHSFO}/t)</span>
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {fmt(inp.fuelConsumption * 0.65 * bunkerHSFO * SCRUBBER_SPLITS.hsfo)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-600 dark:text-slate-400">
                            VLSFO <span className="text-xs text-slate-400">({SCRUBBER_SPLITS.vlsfo*100}% · ban zones · ${bunkerVLSFO}/t)</span>
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {fmt(inp.fuelConsumption * 0.65 * bunkerVLSFO * SCRUBBER_SPLITS.vlsfo)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-600 dark:text-slate-400">
                            MGO <span className="text-xs text-slate-400">({SCRUBBER_SPLITS.mgo*100}% · ECA/SECA · ${bunkerMGO}/t)</span>
                          </td>
                          <td className="py-2 text-right font-semibold">
                            {fmt(inp.fuelConsumption * 0.65 * bunkerMGO * SCRUBBER_SPLITS.mgo)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-600 dark:text-slate-400">Blended effective price</td>
                          <td className="py-2 text-right font-semibold">${result.fuelPriceEffective}/t</td>
                        </tr>
                        <tr className="text-emerald-600 dark:text-emerald-400">
                          <td className="py-2">Scrubber savings vs VLSFO</td>
                          <td className="py-2 text-right font-semibold">−{fmt(result.scrubberSavingsPerDay)}/day</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td className="py-2 text-slate-600 dark:text-slate-400">
                          VLSFO <span className="text-xs text-slate-400">({inp.fuelConsumption} t/day · 65% utilization · ${bunkerVLSFO}/t)</span>
                        </td>
                        <td className="py-2 text-right font-semibold">{fmt(result.fuelCostPerDay)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Port costs</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.portCostsPerDay)}</td>
                    </tr>
                    <tr className="bg-amber-50 dark:bg-amber-900/20 font-bold">
                      <td className="py-2.5 px-2 rounded-l text-amber-700 dark:text-amber-300">Total Voyage Costs/day</td>
                      <td className="py-2.5 px-2 rounded-r text-right text-amber-700 dark:text-amber-300">{fmt(result.totalVoyexPerDay)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Earnings */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Earnings (TC Basis)</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        Charter Rate
                        <span className="ml-2 text-xs text-slate-400">est. {inp.shipType} segment</span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(result.charterRatePerDay)}/day</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">TC Net Earnings</td>
                      <td className={`py-2 text-right font-bold text-lg ${netIsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {result.netEarningsPerDay >= 0 ? "+" : ""}{fmt(result.netEarningsPerDay)}/day
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Annual Fixed OPEX</td>
                      <td className="py-2 text-right font-semibold">{fmtM(result.annualOpex)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Annual Net Earnings</td>
                      <td className={`py-2 text-right font-semibold ${result.annualNetEarnings >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {fmtM(result.annualNetEarnings)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600 dark:text-slate-400">Break-Even Charter Rate</td>
                      <td className="py-2 text-right font-semibold">{fmt(result.breakEvenCharterRate)}/day</td>
                    </tr>
                    {result.roiPercent !== null && (
                      <tr>
                        <td className="py-2 text-slate-600 dark:text-slate-400">
                          ROI
                          <span className="ml-2 text-xs text-slate-400">on ${inp.estimatedValueM.toFixed(1)}M ship value</span>
                        </td>
                        <td className={`py-2 text-right font-bold ${result.roiPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {result.roiPercent}%
                        </td>
                      </tr>
                    )}
                    {result.paybackYears !== null && (
                      <tr>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Payback Period</td>
                        <td className="py-2 text-right font-semibold">{result.paybackYears} years</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center pb-4">
              Bunker prices: Singapore, {liveDate} · Source: {rates?.sources?.join(", ") || "defaults"} · Calibrated: Drewry Manning Review 2025/26
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
