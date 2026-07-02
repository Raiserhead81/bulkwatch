"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Ship as ShipIcon, MapPin, Download, ArrowRight,
  Stethoscope, Shield, Building2, Navigation, TrendingUp, BarChart3,
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
import { calculateOpex, formatUSD, fetchLiveRates } from "@/lib/opex";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false, loading: () => <div className="bg-slate-900 rounded-lg animate-pulse" style={{ height: 280 }} /> });
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── helpers ──────────────────────────────────────────────────────────────────

function getMouBadge(value: string | undefined | null) {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "white") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-0 text-[10px]">White</Badge>;
  if (v === "grey" || v === "gray") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0 text-[10px]">Grey</Badge>;
  if (v === "black") return <Badge className="bg-red-600 hover:bg-red-600 text-white border-0 text-[10px]">Black</Badge>;
  return <Badge variant="outline" className="text-[10px]">{value}</Badge>;
}

function getDetentionColor(pct: number | null | undefined) {
  if (pct == null) return "text-slate-400";
  if (pct < 5) return "text-emerald-400";
  if (pct < 15) return "text-amber-400";
  return "text-red-400";
}

function getAgeBadge(age: number | null) {
  if (age == null) return null;
  const label = `${age}y`;
  if (age <= 5) return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white border-0 text-[10px]">{label}</Badge>;
  if (age <= 15) return <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0 text-[10px]">{label}</Badge>;
  if (age <= 25) return <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0 text-[10px]">{label}</Badge>;
  return <Badge className="bg-red-600 hover:bg-red-600 text-white border-0 text-[10px]">{label}</Badge>;
}

function getStatusDot(status: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-500",
    scrapped: "bg-slate-500",
    lost: "bg-red-500",
    under_construction: "bg-blue-500",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status] ?? "bg-slate-400"} flex-shrink-0`} />;
}

function getSurveyAlert(dateStr: string | undefined | null): { color: string; label: string } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { color: "text-red-400", label: "OVERDUE" };
  if (diffDays < 90) return { color: "text-amber-400", label: "< 3mo" };
  return null;
}

function fmtDate(dateStr: string | undefined | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const SECTION_LABEL = "text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold mb-2";

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline py-0.5 border-b border-slate-100 dark:border-white/5 last:border-0">
      <span className="text-[11px] text-slate-500 dark:text-white/40 shrink-0 mr-2">{label}</span>
      <span className="text-[12px] font-semibold text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}



// ── component ─────────────────────────────────────────────────────────────────

export default function ShipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ship, setShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(true);
  const watchlist = useWatchlist();
  const [priceHistory, setPriceHistory] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [realDistanceNm, setRealDistanceNm] = useState<number>(0);
  const [liveRates, setLiveRates] = useState<any>(null);

  useEffect(() => {
    if (ship?.imo) {
      fetch(`/api/ships/${ship.imo}/history`).then(r => r.ok ? r.json() : null).then(data => setPriceHistory(data)).catch(() => {});
    }
  }, [ship?.imo]);

  useEffect(() => {
    fetchLiveRates().then(r => setLiveRates(r)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/ships/${id}`).then(r => r.ok ? r.json() : null).then(data => { setShip(data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!ship) return;
    const v = generateMockVoyage(ship);
    fetch(`/api/weather/route?fromLat=${v.from.lat}&fromLon=${v.from.lon}&toLat=${v.to.lat}&toLon=${v.to.lon}`)
      .then(r => r.ok ? r.json() : null).then(d => setWeather(d)).catch(() => {});
    fetch(`/api/searoute?fromLat=${v.from.lat}&fromLon=${v.from.lon}&toLat=${v.to.lat}&toLon=${v.to.lon}`)
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.distanceNm) setRealDistanceNm(d.distanceNm); }).catch(() => {});
  }, [ship?.imo]);

  const isWatched = ship ? watchlist.includes(ship.imo) : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center text-slate-900 dark:text-white">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500">Loading ship data...</p>
        </div>
      </div>
    );
  }

  if (!ship) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center text-slate-900 dark:text-white">
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
  const ismMgr = ((ship as any).ismManager || "").toLowerCase();
  const oper = (ship.operator || "").toLowerCase();
  const mgmtType = (ismMgr && oper && (ismMgr.includes(oper.split(" ")[0]) || oper.includes(ismMgr.split(" ")[0]))) ? "own" as const : "third-party" as const;
  const s = ship as any;
  const opex = ship.dwt > 0 ? calculateOpex(ship.dwt, ship.yearBuilt, ship.type, price.estimatedValueUSD, ship.flag, ship.fuelConsumption, ship.crewSize, ship.grossTonnage, mgmtType, !!(s.hasScrubber)) : null;
  const nearbySurveyPorts = getNearbySurveyPorts(voyage.currentPosition.lat, voyage.currentPosition.lon, 3000).slice(0, 3);
  const age = ship.yearBuilt > 1900 ? new Date().getFullYear() - ship.yearBuilt : null;
  const nextSurveyAlert = getSurveyAlert(s.nextSurvey);
  const daysTotal = realDistanceNm ? Math.max(1, Math.round(realDistanceNm / (12 * 24))) : (voyage.durationDays || Math.max(1, Math.round(voyage.distanceNm / (12 * 24))));
  const daysRemaining = Math.round(daysTotal * (100 - voyage.progressPercent) / 100);

  // Technical specs — skip empty/zero
  const techSpecs: [string, string][] = [
    ship.dwt > 0 ? ["DWT", `${ship.dwt.toLocaleString()}`] : null,
    ship.length > 0 ? ["Length", `${ship.length} m`] : null,
    ship.beam > 0 ? ["Beam", `${ship.beam} m`] : null,
    ship.draft > 0 ? ["Draft", `${ship.draft} m`] : null,
    ship.grossTonnage > 0 ? ["GT", `${ship.grossTonnage.toLocaleString()}`] : null,
    ship.engineType ? ["Engine", ship.engineType] : null,
    ship.enginePowerKw > 0 ? ["Power", `${(ship.enginePowerKw/1000).toFixed(0)} MW`] : null,
    ship.speedKnots > 0 ? ["Speed", `${ship.speedKnots} kn`] : null,
    ship.fuelConsumption > 0 ? ["Fuel", `${ship.fuelConsumption} t/d`] : null,
    ship.crewSize > 0 ? ["Crew", `${ship.crewSize}`] : null,
    ship.holds > 0 ? ["Holds/Hatches", `${ship.holds}/${ship.hatches}`] : null,
    ship.grainCapacity > 0 ? ["Grain Cap.", `${ship.grainCapacity.toLocaleString()} m\u00b3`] : null,
    ship.teu > 0 ? ["TEU", `${ship.teu.toLocaleString()}`] : null,
    ship.cranes ? ["Cranes", ship.cranes] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-white">
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 py-4 space-y-3">

        {/* === SECTION 1: HERO STRIP === */}
        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start gap-4 p-4">
            {/* Thumbnail */}
            <div className="w-full sm:w-auto flex-shrink-0">
              <div className="rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800" style={{ height: 120, width: 180 }}>
                {ship.imageUrl ? (
                  <img src={ship.imageUrl} alt={ship.name} className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)" }}>
                    <div className="text-3xl">{ship.status === "under_construction" ? "\uD83C\uDFD7" : "\uD83D\uDEA2"}</div>
                    <p className="text-[10px] text-white/50 mt-1">{ship.type}</p>
                  </div>
                )}
              </div>
              {ship.imageAttribution && (
                <p className="text-[9px] text-slate-400 mt-0.5 font-mono truncate" style={{ maxWidth: 180 }}>Photo: {ship.imageAttribution}</p>
              )}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                {getStatusDot(ship.status)}
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{ship.name}</h1>
                <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0 text-[10px]">{ship.type}</Badge>
                {age != null && getAgeBadge(age)}
              </div>
              <p className="text-xs text-slate-500 dark:text-white/50 mb-1">
                {ship.operator || "Unknown Operator"} &middot; {s.flagEmoji} {ship.flag}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/30 mb-2">
                IMO {ship.imo}{ship.mmsi ? ` \u00b7 MMSI ${ship.mmsi}` : ""}
                {ship.homePort ? ` \u00b7 ${ship.homePort}` : ""}
              </p>
              {/* Action buttons */}
              <div className="flex gap-1.5 flex-wrap">
                <Link href={`/vergleich?ships=${ship.imo}`}>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-blue-500/30">Compare</Button>
                </Link>
                <a href={`/api/ships/${ship.imo}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-slate-200 dark:border-slate-700">
                    <Download className="h-3 w-3 mr-1" />PDF
                  </Button>
                </a>
                {ship.position && (
                  <Link href={`/karte?lat=${ship.position.lat}&lon=${ship.position.lon}&zoom=8&imo=${ship.imo}`}>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                      <MapPin className="h-3 w-3 mr-1" />Map
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Key metrics */}
            {ship.dwt > 0 && (
              <div className="flex sm:flex-col gap-2 sm:gap-1 flex-wrap sm:flex-nowrap sm:items-end shrink-0">
                <div className="flex gap-2">
                  {[
                    ["DWT", `${(ship.dwt/1000).toFixed(0)}K`],
                    ["Value", formatPrice(price.estimatedValueUSD)],
                    ["$/DWT", `$${(price.estimatedValueUSD/ship.dwt).toFixed(0)}`],
                    ["Built", ship.yearBuilt > 0 ? `${ship.yearBuilt}` : "\u2014"],
                  ].map(([l, v]) => (
                    <div key={l} className="text-center px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800/80">
                      <p className="text-[9px] text-slate-500 dark:text-white/30 uppercase tracking-wide">{l}</p>
                      <p className="text-sm font-bold tabular-nums">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span>Conf.</span>
                  <div className="w-16 h-1 bg-slate-300 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${price.confidenceScore}%` }} />
                  </div>
                  <span>{price.confidenceScore}%</span>
                </div>
              </div>
            )}
          </div>

          {/* AIS bar inline in hero */}
          {ship.position && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-emerald-500/5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <span>
                {"\u2713"} Live AIS &middot; {ship.position.lat.toFixed(4)}&deg;N {ship.position.lon.toFixed(4)}&deg;E
                {ship.lastSeen ? ` \u00b7 ${new Date(ship.lastSeen * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
              <Link href={`/karte?lat=${ship.position.lat}&lon=${ship.position.lon}&zoom=8&imo=${ship.imo}`}
                className="flex items-center gap-1 font-semibold hover:text-emerald-300">
                <MapPin className="h-3 w-3" /> Show on Map
              </Link>
            </div>
          )}
        </Card>

        {/* === SECTION 2: OVERVIEW GRID (one card, 4 columns) === */}
        <Card className="border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-white/5">

            {/* Col 1: Financial */}
            <div className="p-4">
              <p className={SECTION_LABEL}>Financial</p>
              {ship.dwt > 0 && opex ? (
                <div className="space-y-1">
                  <div className={`text-base font-bold mb-1 ${getRecommendationColor(price.recommendation).split(" ").find((c: string) => c.startsWith("text-")) ?? ""}`}>
                    {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                  </div>
                  <KV label="Net Earnings" value={<span className={opex.netEarningsPerDay > 0 ? "text-emerald-400" : "text-red-400"}>{opex.netEarningsPerDay > 0 ? "+" : ""}${opex.netEarningsPerDay.toLocaleString()}/d</span>} />
                  <KV label="ROI / Payback" value={`${opex.roiPercent}% \u00b7 ${opex.paybackYears ?? "\u2014"}yr`} />
                  <KV label="Charter" value={`$${opex.charterRatePerDay.toLocaleString()}/d`} />
                  <KV label="OPEX" value={`$${opex.totalFixedOpex.toLocaleString()}/d`} />
                  <p className="text-[9px] text-slate-400 pt-1 leading-relaxed">{price.recommendationReasoning}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">DWT required for financials.</p>
              )}
            </div>

            {/* Col 2: Technical */}
            <div className="p-4">
              <p className={SECTION_LABEL}>Technical</p>
              {techSpecs.length > 0 ? (
                <div>
                  {techSpecs.map(([label, value]) => (
                    <KV key={label} label={label} value={value} />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No technical data.</p>
              )}
            </div>

            {/* Col 3: Safety */}
            <div className="p-4">
              <p className={SECTION_LABEL}>Safety</p>
              {(s.classSociety || s.classification || s.pAndI || s.flagParisMou || s.flagTokyoMou || s.detentionPct != null || s.inspectionsCount > 0 || s.lastSurvey || s.nextSurvey) ? (
                <div>
                  {(s.classSociety || s.classification) && <KV label="Class" value={s.classSociety || s.classification} />}
                  {s.pAndI && <KV label="P&amp;I" value={s.pAndI} />}
                  {(s.flagParisMou || s.flagTokyoMou) && (
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 dark:text-white/40">MOU</span>
                      <div className="flex gap-1">
                        {s.flagParisMou && getMouBadge(s.flagParisMou)}
                        {s.flagTokyoMou && getMouBadge(s.flagTokyoMou)}
                      </div>
                    </div>
                  )}
                  {s.detentionPct != null && (
                    <div className="flex justify-between items-baseline py-0.5 border-b border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 dark:text-white/40">Detention</span>
                      <span className={`text-[12px] font-bold ${getDetentionColor(s.detentionPct)}`}>{s.detentionPct}%</span>
                    </div>
                  )}
                  {s.inspectionsCount > 0 && <KV label="Inspections" value={s.inspectionsCount} />}
                  {s.lastSurvey && <KV label="Last Survey" value={fmtDate(s.lastSurvey)} />}
                  {s.nextSurvey && (
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-100 dark:border-white/5 last:border-0">
                      <span className="text-[11px] text-slate-500 dark:text-white/40 shrink-0 mr-2">Next Survey</span>
                      <div className="flex items-center gap-1">
                        {nextSurveyAlert && (
                          <Badge className={`text-[9px] border-0 ${nextSurveyAlert.color === "text-red-400" ? "bg-red-600/80 text-white" : "bg-amber-500/80 text-white"}`}>
                            {nextSurveyAlert.label}
                          </Badge>
                        )}
                        <span className={`text-[12px] font-semibold ${nextSurveyAlert ? nextSurveyAlert.color : ""}`}>{fmtDate(s.nextSurvey)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No compliance data.</p>
              )}
            </div>

            {/* Col 4: Management */}
            <div className="p-4">
              <p className={SECTION_LABEL}>Management</p>
              {s.owner && (
                <div className="mb-2">
                  <p className="text-[9px] text-slate-500 dark:text-white/30 uppercase tracking-wide">Owner</p>
                  <p className="text-sm font-bold truncate">{s.owner}</p>
                </div>
              )}
              {[
                ["Ship Manager", s.manager],
                ["ISM Manager", s.ismManager],
                ["Operator", ship.operator],
                ["Call Sign", s.callSign],
                ["Home Port", ship.homePort],
                ["Flag", `${s.flagEmoji} ${ship.flag}`],
              ].filter(([, v]) => v).map(([label, value]) => (
                <KV key={label as string} label={label as string} value={value as string} />
              ))}
              {s.operatorDetails && (
                <div className="flex flex-wrap gap-2 pt-2 text-[11px]">
                  {s.operatorDetails.website && <a href={s.operatorDetails.website} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300">{"\uD83C\uDF10"} Web</a>}
                  {s.operatorDetails.email && <a href={`mailto:${s.operatorDetails.email}`} className="text-blue-400 hover:text-blue-300">{"\u2709"} Email</a>}
                  {s.operatorDetails.city && <span className="text-slate-400">{"\uD83D\uDCCD"} {s.operatorDetails.city}{s.operatorDetails.country ? `, ${s.operatorDetails.country}` : ""}</span>}
                  {s.operatorDetails.fleetSize && <span className="text-slate-400">Fleet: {s.operatorDetails.fleetSize}</span>}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* === SECTION 3: VALUATION === */}
        {ship.dwt > 0 && (
          <Card className="border-slate-200 dark:border-slate-800">
            <div className="p-5">
              <p className={SECTION_LABEL}>Valuation</p>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                {/* Left: Price + Chart (3 cols) */}
                <div className="lg:col-span-3">
                  {/* Current price + trend badges */}
                  <div className="flex items-end gap-4 mb-4">
                    <span className="text-2xl font-bold font-mono tracking-tight">
                      {formatPrice(priceHistory?.history?.length > 0 ? priceHistory.history[priceHistory.history.length-1].value : price.estimatedValueUSD)}
                    </span>
                    {priceHistory?.history?.length > 0 && (
                      <div className="flex gap-2 mb-0.5">
                        {[
                          { label: "30d", pct: priceHistory.change30dPct },
                          { label: "1Y", pct: priceHistory.change1yPct },
                        ].map(({ label, pct }) => (
                          <span key={label} className={`text-xs font-mono font-semibold ${pct > 0 ? "text-emerald-400" : pct < 0 ? "text-rose-400" : "text-slate-500"}`}>
                            {pct > 0 ? "\u25B2" : pct < 0 ? "\u25BC" : "\u2014"} {pct > 0 ? "+" : ""}{pct}% <span className="text-slate-500 font-normal">{label}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chart */}
                  {priceHistory?.history?.length > 0 && (() => {
                    const h = priceHistory.history;
                    const vals = h.map((p: any) => p.value);
                    const uniqueVals = new Set(vals).size;
                    if (uniqueVals <= 1) return (
                      <div className="h-20 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                        No price variation in {h.length} data points — stable at {formatPrice(vals[0])}
                      </div>
                    );
                    const minV = Math.min(...vals) * 0.95, maxV = Math.max(...vals) * 1.05;
                    const range = maxV - minV || 1;
                    const lastVal = vals[vals.length-1], firstVal = vals[0];
                    const lineColor = lastVal >= firstVal ? "#10b981" : "#ef4444";
                    const cxF = (i: number) => 48 + (i / (h.length - 1)) * 442;
                    const cyF = (v: number) => 130 - ((v - minV) / range) * 120;
                    const pts = vals.map((v: number, i: number) => `${cxF(i)},${cyF(v)}`).join(" ");
                    const yTicks = [0, 0.5, 1].map(pct => ({ y: 130 - pct * 120, label: "$" + ((minV + pct * range) / 1e6).toFixed(1) + "M" }));
                    const xLabels: {x: number; label: string}[] = [];
                    const step = Math.max(1, Math.floor(h.length / 5));
                    for (let i = 0; i < h.length; i += step) {
                      const d = new Date(h[i].date);
                      xLabels.push({ x: cxF(i), label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) });
                    }
                    return (
                      <div style={{ height: 160 }}>
                        <svg viewBox="0 0 500 160" className="w-full h-full">
                          <defs>
                            <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={lineColor} stopOpacity="0.15"/>
                              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01"/>
                            </linearGradient>
                          </defs>
                          {yTicks.map((t, i) => (
                            <g key={i}>
                              <line x1={48} y1={t.y} x2={490} y2={t.y} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4"/>
                              <text x={44} y={t.y + 3} textAnchor="end" fill="#64748b" fontSize="8" fontFamily="ui-monospace, monospace">{t.label}</text>
                            </g>
                          ))}
                          {xLabels.map((t, i) => (
                            <text key={i} x={t.x} y={150} textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="ui-monospace, monospace">{t.label}</text>
                          ))}
                          <polygon points={pts + " 490,135 48,135"} fill="url(#vg)"/>
                          <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
                          <circle cx={cxF(h.length-1)} cy={cyF(lastVal)} r="3.5" fill={lineColor} stroke="#1e293b" strokeWidth="2"/>
                        </svg>
                      </div>
                    );
                  })()}

                  {/* Summary stats below chart */}
                  <div className="flex gap-6 mt-3 text-xs">
                    {[
                      ["$/DWT", `$${(price.estimatedValueUSD / Math.max(ship.dwt, 1)).toFixed(0)}`],
                      ["Confidence", `${price.confidenceScore}%`],
                      ...(priceHistory?.history?.length > 0 ? [["Range", `${formatPrice(priceHistory.min)} \u2013 ${formatPrice(priceHistory.max)}`]] : []),
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="text-slate-500 dark:text-white/40">{label}: </span>
                        <span className="font-mono font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Value Factors (2 cols) */}
                <div className="lg:col-span-2 lg:border-l lg:border-slate-100 lg:dark:border-white/5 lg:pl-6">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-semibold mb-2">Value Factors</p>
                  <div className="space-y-0">
                    {price.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-white/5">
                        <span className="text-xs text-slate-500 dark:text-white/50">{f.label}</span>
                        <span className={`text-xs font-mono font-medium ${f.impact === "positive" ? "text-emerald-400" : f.impact === "negative" ? "text-rose-400" : "text-slate-400"}`}>
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-white/30 mt-2 leading-relaxed">{price.reasoning}</p>
                </div>

              </div>
            </div>
          </Card>
        )}

        {/* === SECTION 4: VOYAGE + WEATHER === */}
        <Card className="border-slate-200 dark:border-slate-800">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold">
                Estimated Voyage
              </p>
              <Badge className={`${getStatusColor(voyage.currentStatus)} border text-[10px] ml-auto`}>{getStatusLabel(voyage.currentStatus)}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: route + weather */}
              <div className="space-y-3">
                {/* From/To strip */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-3xl flex-shrink-0">{voyage.from.countryFlag}</span>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-500 uppercase">From</p>
                      <p className="font-semibold text-xs truncate">{voyage.from.name}</p>
                      <p className="text-[9px] text-slate-400">{voyage.from.country}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center px-1 shrink-0">
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-300">{daysTotal}d</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-3xl flex-shrink-0">{voyage.to.countryFlag}</span>
                    <div className="min-w-0">
                      <p className="text-[9px] text-slate-500 uppercase">To</p>
                      <p className="font-semibold text-xs truncate">{voyage.to.name}</p>
                      <p className="text-[9px] text-slate-400">{voyage.to.country}</p>
                    </div>
                  </div>
                </div>
                {/* Inline stat badges */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ["Cargo", voyage.cargoDescription],
                    ["Load", voyage.cargoLoadPercent + "%"],
                    ["Speed", voyage.speedKnots + " kn"],
                    ["Distance", (realDistanceNm || voyage.distanceNm) + " nm"],
                  ].map(([l, v]) => (
                    <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">{l}: </span>{v}
                    </span>
                  ))}
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-semibold">{voyage.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${voyage.progressPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Dep: {voyage.departureDate.toLocaleDateString("en-GB")}</span>
                    <span>ETA: {voyage.eta.toLocaleDateString("en-GB")} {voyage.eta.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                {!ship.position && <p className="text-[10px] text-slate-500 bg-slate-500/5 border border-slate-700 rounded px-2 py-1">Illustrative voyage &mdash; no live AIS data</p>}

                {/* Weather strip */}
                {weather?.current && (
                  <div className="pt-1 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold mb-1.5">Weather</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        ["Cond.", weather.current.condition],
                        ["Waves", `${weather.current.avgWaveHeight}m / ${weather.current.maxWaveHeight}m max`],
                        ["Wind", `Bft ${weather.current.avgBeaufort.scale}`],
                        ["Loss", `-${weather.current.estimatedSpeedLoss}%`],
                      ].map(([l, v]) => (
                        <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">{l}: </span>{v as string}
                        </span>
                      ))}
                    </div>
                    {/* 7-day dots */}
                    {weather.forecast?.days?.length > 0 && (
                      <div className="flex gap-1 items-end">
                        {weather.forecast.days.map((d: any) => (
                          <div key={d.date} className="flex flex-col items-center gap-0.5">
                            <span className="text-[8px] text-slate-500">{new Date(d.date).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${d.condition === "good" ? "border-emerald-400 bg-emerald-400/10" : d.condition === "moderate" ? "border-amber-400 bg-amber-400/10" : "border-red-400 bg-red-400/10"}`}>
                              <span className="text-[8px] font-bold">{d.waveHeightMax.toFixed(0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: map */}
              <RouteMap
                fromLat={voyage.from.lat} fromLon={voyage.from.lon} fromName={voyage.from.name}
                toLat={voyage.to.lat} toLon={voyage.to.lon} toName={voyage.to.name}
                shipName={ship.name}
                daysTotal={daysTotal}
                daysRemaining={daysRemaining}
                distanceNm={voyage.distanceNm} progressPercent={voyage.progressPercent}
              />
            </div>
          </div>
        </Card>

        

      </main>
    </div>
  );
}
