"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Anchor, Ship as ShipIcon, MapPin, Calendar, Ruler, Weight, Flag,
  Building2, Home, Gauge, Navigation, TrendingUp, TrendingDown, Minus,
  Star, StarOff, Download, ArrowRight, Stethoscope, Fuel, Users, Cog,
  Box, Shield, Radio, AlertTriangle, DollarSign, BarChart3, Wallet,
} from "lucide-react";
import { type Ship } from "@/data/ships";
import {
  estimatePrice, formatPrice, getRecommendationColor,
  getRecommendationEmoji, getRecommendationLabel,
} from "@/lib/priceEstimator";
import { calculateFreightRates, getRateForDwt } from "@/lib/freightRates";
import { generateMockVoyage, getStatusColor, getStatusLabel } from "@/lib/mockVoyages";
import { getNearbySurveyPorts, formatSurveyCost } from "@/lib/surveyPorts";
import { useWatchlist, toggleWatch } from "@/lib/useWatchlist";
import { calculateOpex, formatUSD } from "@/lib/opex";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false, loading: () => <div className="bg-slate-900 rounded-lg animate-pulse" style={{ height: 280 }} /> });
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ShipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ship, setShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(true);
  const watchlist = useWatchlist();
  const [priceHistory, setPriceHistory] = useState<any>(null);

  useEffect(() => {
    if (ship?.imo) {
      fetch(`/api/ships/${ship.imo}/history`).then(r => r.ok ? r.json() : null).then(data => setPriceHistory(data)).catch(() => {});
    }
  }, [ship?.imo]);

  useEffect(() => {
    fetch(`/api/ships/${id}`).then(r => r.ok ? r.json() : null).then(data => { setShip(data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const isWatched = ship ? watchlist.includes(ship.imo) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500">Loading ship data...</p>
        </div>
      </div>
    );
  }

  if (!ship) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
        <div className="text-center">
          <ShipIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
          <p className="mb-4">Ship not found</p>
          <Link href="/"><Button>Back to Overview</Button></Link>
        </div>
      </div>
    );
  }

  const price = estimatePrice(ship);
  const voyage = generateMockVoyage(ship);
  const opex = ship.dwt > 0 ? calculateOpex(ship.dwt, ship.yearBuilt, ship.type, price.estimatedValueUSD, ship.flag, ship.fuelConsumption, ship.crewSize, ship.grossTonnage) : null;
  const nearbySurveyPorts = getNearbySurveyPorts(voyage.currentPosition.lat, voyage.currentPosition.lon, 3000).slice(0, 3);
  const age = ship.yearBuilt > 1900 ? new Date().getFullYear() - ship.yearBuilt : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Badge className={`${getRecommendationColor(price.recommendation)} border`}>
              {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => toggleWatch(ship.imo)} className="border-slate-200 dark:border-slate-800">
              {isWatched ? <><Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" /> Watchlist</> : <><StarOff className="h-4 w-4 mr-1" /> Save</>}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ═══ HERO: Ship Name + Image ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Image */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
              <div className="aspect-[16/10] bg-slate-200 dark:bg-slate-800">
                {ship.imageUrl ? (
                  <img src={ship.imageUrl} alt={ship.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)" }}>
                    <div className="text-5xl mb-3">{ship.status === "under_construction" ? "🏗" : "🚢"}</div>
                    <p className="text-sm font-semibold text-white/60">{ship.type}</p>
                  </div>
                )}
              </div>
              {ship.imageAttribution && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-500 dark:text-white/40 font-mono">Photo: {ship.imageAttribution}</div>
              )}
            </Card>
          </div>

          {/* Ship Info + Quick Stats */}
          <div className="lg:col-span-3 space-y-4">
            {/* Name & Type */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0">{ship.type}</Badge>
                <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-cyan-400">IMO: {ship.imo}</Badge>
                {ship.mmsi && <Badge variant="outline" className="border-slate-500/30">MMSI: {ship.mmsi}</Badge>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{ship.name}</h1>
              <p className="text-sm text-slate-600 dark:text-white/50 mt-1">
                {ship.operator || "Unknown Operator"} · {ship.flag} {age ? `· ${age} years old` : ""}
              </p>
            </div>

            {/* Key Numbers */}
            {ship.dwt > 0 && (
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-800 text-white p-4">
                  <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Estimated Value</p>
                  <p className="text-2xl font-bold tabular-nums text-white">{formatPrice(price.estimatedValueUSD)}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span>Confidence:</span>
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${price.confidenceScore}%` }} />
                    </div>
                    <span className="font-semibold">{price.confidenceScore}%</span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">DWT</p>
                      <p className="text-lg font-bold tabular-nums">{(ship.dwt/1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">$/DWT</p>
                      <p className="text-lg font-bold tabular-nums">${(price.estimatedValueUSD/ship.dwt).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Built</p>
                      <p className="text-lg font-bold">{ship.yearBuilt > 0 ? ship.yearBuilt : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Link href={`/vergleich?ships=${ship.imo}`}><Button variant="outline" size="sm" className="border-blue-500/30">Compare</Button></Link>
              <a href={`/api/ships/${ship.imo}/pdf`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="border-slate-200 dark:border-slate-800"><Download className="h-3 w-3 mr-1" /> PDF</Button></a>
              {ship.position && (
                <Link href={`/karte?lat=${ship.position.lat}&lon=${ship.position.lon}&zoom=8&imo=${ship.imo}`}>
                  <Button variant="outline" size="sm" className="border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400"><MapPin className="h-3 w-3 mr-1" /> Map</Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ═══ LIVE POSITION ═══ */}
        {ship.position && (
          <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 flex items-center justify-between gap-2">
            <span>
              ✓ Live AIS · {ship.position.lat.toFixed(4)}°N {ship.position.lon.toFixed(4)}°E
              {ship.lastSeen ? ` · ${new Date(ship.lastSeen * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
            <Link href={`/karte?lat=${ship.position.lat}&lon=${ship.position.lon}&zoom=8&imo=${ship.imo}`} className="flex items-center gap-1 text-emerald-500 hover:text-emerald-300 font-semibold whitespace-nowrap">
              <MapPin className="h-3 w-3" /> Show on Map
            </Link>
          </div>
        )}

        {/* ═══ FINANCIALS: 3 cards row ═══ */}
        {ship.dwt > 0 && opex && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recommendation */}
            <Card className={`border-2 ${getRecommendationColor(price.recommendation).split(" ").find(c => c.startsWith("border-"))}`}>
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40">Recommendation</p>
                <p className="text-xl font-bold">{getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}</p>
                <Separator />
                <p className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">{price.recommendationReasoning}</p>
              </CardContent>
            </Card>

            {/* Net Earnings */}
            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className={`p-5 text-white ${opex.netEarningsPerDay > 0 ? "bg-slate-800" : "bg-slate-800"}`}>
                <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Net Earnings (TC)</p>
                <p className="text-xl font-bold tabular-nums text-white">{opex.netEarningsPerDay > 0 ? "+" : ""}${opex.netEarningsPerDay.toLocaleString()}/d</p>
                <p className="text-xs text-white/60 mt-1">Charter ${opex.charterRatePerDay.toLocaleString()}/d − OPEX ${opex.totalFixedOpex.toLocaleString()}/d</p>
              </div>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div><p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">ROI</p><p className={"text-lg font-bold " + ((opex.roiPercent||0) > 0 ? "text-green-400" : "text-red-400")}>{opex.roiPercent}%</p></div>
                  <div><p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Payback</p><p className="text-lg font-bold text-amber-500">{opex.paybackYears ? opex.paybackYears + "yr" : "n/a"}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* OPEX Summary */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 mb-2">Daily OPEX Breakdown</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-3">${opex.totalFixedOpex.toLocaleString()}/day</p>
                {[
                  ["Crew (" + opex.crewCount + ")", opex.crewCostPerDay],
                  ["Insurance", opex.insuranceTotalPerDay],
                  ["Maintenance", opex.maintenancePerDay],
                  ["Management", opex.managementPerDay],
                  ["Other", opex.provisionsPerDay + opex.lubeOilPerDay + opex.storesSpares + opex.drydockPerDay + opex.euEtsPerDay],
                ].map(([label, val], i) => (
                  <div key={i} className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-500 dark:text-white/50">{label as string}</span>
                    <span className="font-mono">${(val as number).toLocaleString()}</span>
                  </div>
                ))}
                <div className="text-[10px] text-slate-400 mt-2">{opex.sources.length} sources · {opex.ratesDate}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ SPECS & DETAILS: 2 columns ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Technical Specs */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShipIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" /> Technical Specifications</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  ["Deadweight", ship.dwt > 0 ? `${ship.dwt.toLocaleString()} DWT` : "—"],
                  ["Length", ship.length > 0 ? `${ship.length} m` : "—"],
                  ["Beam", ship.beam > 0 ? `${ship.beam} m` : "—"],
                  ["Draft", ship.draft > 0 ? `${ship.draft} m` : "—"],
                  ["Year Built", ship.yearBuilt > 0 ? `${ship.yearBuilt}` : "—"],
                  ["Flag", ship.flag],
                  ["Builder", ship.builder || "—"],
                  ["Operator", ship.operator || "—"],
                  ...(ship.grossTonnage > 0 ? [["Gross Tonnage", `${ship.grossTonnage.toLocaleString()} GT`]] : []),
                  ...(ship.engineType ? [["Engine", ship.engineType]] : []),
                  ...(ship.enginePowerKw > 0 ? [["Power", `${(ship.enginePowerKw/1000).toFixed(0)} MW`]] : []),
                  ...(ship.speedKnots > 0 ? [["Speed", `${ship.speedKnots} kn`]] : []),
                  ...(ship.fuelConsumption > 0 ? [["Fuel", `${ship.fuelConsumption} t/day`]] : []),
                  ...(ship.fuelType ? [["Fuel Type", ship.fuelType]] : []),
                  ...(ship.crewSize > 0 ? [["Crew", `${ship.crewSize}`]] : []),
                  ...(ship.holds > 0 ? [["Holds/Hatches", `${ship.holds}/${ship.hatches}`]] : []),
                  ...(ship.grainCapacity > 0 ? [["Grain Cap.", `${ship.grainCapacity.toLocaleString()} m\u00b3`]] : []),
                  ...(ship.teu > 0 ? [["TEU", `${ship.teu.toLocaleString()}`]] : []),
                  ...(ship.cranes ? [["Cranes", ship.cranes]] : []),
                ].map(([label, value], i) => (
                  <div key={i} className="flex justify-between items-baseline border-b border-slate-100 dark:border-white/5 pb-1">
                    <span className="text-xs text-slate-500 dark:text-white/40">{label}</span>
                    <span className="text-sm font-semibold text-right">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ownership & Classification */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-slate-700 dark:text-slate-300" /> Ownership & Classification</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  ["Registered Owner", (ship as any).owner],
                  ["Ship Manager", (ship as any).manager],
                  ["ISM Manager", (ship as any).ismManager],
                  ["Classification", (ship as any).classification],
                  ["P&I Insurance", (ship as any).pAndI],
                  ["Call Sign", (ship as any).callSign],
                  ["Home Port", ship.homePort],
                  ["Paris MOU", (ship as any).flagParisMou],
                  ["Tokyo MOU", (ship as any).flagTokyoMou],
                  ...((ship as any).detentionPct != null ? [["Detention Rate", `${(ship as any).detentionPct}%`]] : []),
                ].filter(([, v]) => v).map(([label, value], i) => (
                  <div key={i} className="flex justify-between items-baseline border-b border-slate-100 dark:border-white/5 pb-2">
                    <span className="text-xs text-slate-500 dark:text-white/40">{label}</span>
                    <span className="text-sm font-semibold text-right max-w-[60%] truncate">{value}</span>
                  </div>
                ))}
                {(ship as any).operatorDetails && (
                  <div className="flex flex-wrap gap-3 pt-2 text-xs">
                    {(ship as any).operatorDetails.website && <a href={(ship as any).operatorDetails.website} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300">🌐 Website</a>}
                    {(ship as any).operatorDetails.email && <a href={`mailto:${(ship as any).operatorDetails.email}`} className="text-blue-400 hover:text-blue-300">✉ {(ship as any).operatorDetails.email}</a>}
                    {(ship as any).operatorDetails.city && <span className="text-slate-400">📍 {(ship as any).operatorDetails.city}{(ship as any).operatorDetails.country ? `, ${(ship as any).operatorDetails.country}` : ""}</span>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ PRICE FACTORS & HISTORY ═══ */}
        {ship.dwt > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Price Factors */}
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-slate-700 dark:text-slate-300" /> Value Factors</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {price.factors.map((f, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-white/60">{f.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-right">{f.value}</span>
                      <div className={`w-2 h-2 rounded-full ${f.impact === "positive" ? "bg-emerald-500" : f.impact === "negative" ? "bg-rose-500" : "bg-slate-400"}`} />
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 pt-2">{price.reasoning}</p>
              </CardContent>
            </Card>

            {/* Price History */}
            {priceHistory?.history?.length > 0 ? (
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" /> Price History (30mo)</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-[9px] text-slate-500 dark:text-white/40 uppercase">30d</p>
                      <p className={`text-sm font-bold ${priceHistory.change30dPct > 0 ? "text-green-400" : priceHistory.change30dPct < 0 ? "text-red-400" : "text-slate-500"}`}>{priceHistory.change30dPct > 0 ? "+" : ""}{priceHistory.change30dPct}%</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-[9px] text-slate-500 dark:text-white/40 uppercase">1Y</p>
                      <p className={`text-sm font-bold ${priceHistory.change1yPct > 0 ? "text-green-400" : priceHistory.change1yPct < 0 ? "text-red-400" : "text-slate-500"}`}>{priceHistory.change1yPct > 0 ? "+" : ""}{priceHistory.change1yPct}%</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-[9px] text-slate-500 dark:text-white/40 uppercase">Range</p>
                      <p className="text-[10px] font-semibold">${(priceHistory.min/1e6).toFixed(1)}M—${(priceHistory.max/1e6).toFixed(1)}M</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-blue-400">${(priceHistory.history[priceHistory.history.length-1]?.value/1e6).toFixed(1)}M</span>
                    <div className="flex gap-3 text-xs">
                      <span className="text-red-400">▼ ${(priceHistory.min/1e6).toFixed(1)}M</span>
                      <span className="text-emerald-400">▲ ${(priceHistory.max/1e6).toFixed(1)}M</span>
                    </div>
                  </div>
                  <div style={{ height: 140 }}>
                    <svg viewBox="0 0 500 140" className="w-full h-full">
                      {(() => {
                        const h = priceHistory.history;
                        const vals = h.map((p: any) => p.value);
                        const minV = Math.min(...vals) * 0.95, maxV = Math.max(...vals) * 1.05;
                        const range = maxV - minV || 1;
                        const pts = h.map((p: any, i: number) => `${50 + (i/(h.length-1))*440},${130 - ((p.value-minV)/range)*120}`).join(" ");
                        const lastVal = vals[vals.length-1], firstVal = vals[0];
                        const color = lastVal >= firstVal ? "#10b981" : "#ef4444";
                        return (<>
                          <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient></defs>
                          {[0,.25,.5,.75,1].map((pct,i) => <line key={i} x1={50} y1={130-pct*120} x2={490} y2={130-pct*120} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3"/>)}
                          <polygon points={pts + " 490,135 50,135"} fill="url(#pg)"/>
                          <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                          <circle cx={490} cy={130-((lastVal-minV)/range)*120} r="4" fill={color} stroke="#0f172a" strokeWidth="2"/>
                        </>);
                      })()}
                    </svg>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800 ">
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4 text-slate-300" /> Nearby Survey Ports</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {nearbySurveyPorts.length === 0 ? <p className="text-xs text-slate-500">No survey ports in range.</p> : nearbySurveyPorts.map(({ port, distanceNm }) => (
                    <div key={port.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-900/50">
                      <span className="text-xl">{port.countryFlag}</span>
                      <div className="flex-1">
                        <div className="flex justify-between"><p className="font-semibold text-sm">{port.name}</p><Badge variant="outline" className="text-[10px] border-slate-200 dark:border-slate-800">\u2B50 {port.rating}</Badge></div>
                        <div className="flex justify-between text-xs text-slate-500"><span>{Math.round(distanceNm)} nm</span><span className="text-slate-400 font-medium">{formatSurveyCost(port.typicalSurveyCost)}</span></div>
                      </div>
                    </div>
                  ))}
                  <Link href="/survey-haefen"><Button variant="outline" size="sm" className="w-full border-slate-200 dark:border-slate-800 text-slate-300">All Survey Ports</Button></Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* \u2550\u2550\u2550 VOYAGE \u2550\u2550\u2550 */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Navigation className="h-5 w-5 text-slate-700 dark:text-slate-300" /> {ship.position ? "Current Voyage" : "Estimated Voyage"} <Badge className={`${getStatusColor(voyage.currentStatus)} border ml-auto`}>{getStatusLabel(voyage.currentStatus)}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left: Route info */}
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl flex-shrink-0">{voyage.from.countryFlag}</div>
                    <div className="min-w-0"><p className="text-[10px] text-slate-500 uppercase">From</p><p className="font-semibold text-sm truncate">{voyage.from.name}</p><p className="text-[10px] text-slate-400">{voyage.from.country}</p></div>
                  </div>
                  <div className="flex flex-col items-center px-2">
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-bold text-slate-300 mt-1">{voyage.durationDays} days</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl flex-shrink-0">{voyage.to.countryFlag}</div>
                    <div className="min-w-0"><p className="text-[10px] text-slate-500 uppercase">To</p><p className="font-semibold text-sm truncate">{voyage.to.name}</p><p className="text-[10px] text-slate-400">{voyage.to.country}</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[["Cargo", voyage.cargoDescription], ["Load", voyage.cargoLoadPercent + "%"], ["Speed", voyage.speedKnots + " kn"], ["Distance", voyage.distanceNm + " nm"]].map(([l, v]) => (
                    <div key={l} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50"><p className="text-[10px] text-slate-500 uppercase">{l}</p><p className="text-sm font-semibold tabular-nums">{v}</p></div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-500">Progress</span><span className="font-semibold tabular-nums">{voyage.progressPercent}%</span></div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${voyage.progressPercent}%` }} /></div>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Dep: {voyage.departureDate.toLocaleDateString("en-GB")}</span>
                  <span className="font-semibold">ETA: {voyage.eta.toLocaleDateString("en-GB")} {voyage.eta.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {!ship.position && <p className="text-[10px] text-slate-500 bg-slate-500/5 border border-slate-700 rounded px-2 py-1">Illustrative voyage — no live AIS data</p>}
              </div>
              {/* Right: Route map */}
              <RouteMap
                fromLat={voyage.from.lat} fromLon={voyage.from.lon} fromName={voyage.from.name}
                toLat={voyage.to.lat} toLon={voyage.to.lon} toName={voyage.to.name}
                shipName={ship.name}
                daysTotal={voyage.durationDays}
                daysRemaining={Math.round(voyage.durationDays * (100 - voyage.progressPercent) / 100)}
                distanceNm={voyage.distanceNm} progressPercent={voyage.progressPercent}
              />
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
