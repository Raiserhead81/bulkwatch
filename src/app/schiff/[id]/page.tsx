"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Anchor,
  Ship as ShipIcon,
  MapPin,
  Calendar,
  Ruler,
  Weight,
  Flag,
  Building2,
  Home,
  Gauge,
  Navigation,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  StarOff,
  Download,
  ArrowRight,
  Stethoscope,
  Fuel,
  Users,
  Cog,
  Box,
} from "lucide-react";
import { type Ship } from "@/data/ships";
import {
  estimatePrice,
  formatPrice,
  getRecommendationColor,
  getRecommendationEmoji,
  getRecommendationLabel,
} from "@/lib/priceEstimator";
import {
  generateMockVoyage,
  getStatusColor,
  getStatusLabel,
} from "@/lib/mockVoyages";
import { getNearbySurveyPorts, formatSurveyCost } from "@/lib/surveyPorts";
import { useWatchlist, toggleWatch } from "@/lib/useWatchlist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ShipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [ship, setShip] = useState<Ship | null>(null);
  const [loading, setLoading] = useState(true);
  const watchlist = useWatchlist();

  useEffect(() => {
    fetch(`/api/ships/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setShip(data); setLoading(false); })
      .catch(() => setLoading(false));
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
          <Link href="/">
            <Button>Back to Overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  const price = estimatePrice(ship);
  const voyage = generateMockVoyage(ship);
  const nearbySurveyPorts = getNearbySurveyPorts(
    voyage.currentPosition.lat,
    voyage.currentPosition.lon,
    3000,
  ).slice(0, 3);

  const specs = [
    { icon: Weight, label: "Deadweight", value: ship.dwt > 0 ? `${ship.dwt.toLocaleString("en-US")} DWT` : "—" },
    { icon: Ruler, label: "Length Overall", value: ship.length > 0 ? `${ship.length} m` : "—" },
    { icon: Ruler, label: "Beam", value: ship.beam > 0 ? `${ship.beam} m` : "—" },
    { icon: Ruler, label: "Draft", value: ship.draft > 0 ? `${ship.draft} m` : "—" },
    { icon: Calendar, label: "Year Built", value: ship.yearBuilt > 0 ? ship.yearBuilt.toString() : "—" },
    { icon: Flag, label: "Flag", value: ship.flag },
    { icon: Building2, label: "Operator", value: ship.operator || "—" },
    { icon: Home, label: "Home Port", value: ship.homePort || "—" },
    ...(ship.grossTonnage > 0 ? [{ icon: Gauge, label: "Gross Tonnage", value: ship.grossTonnage.toLocaleString("en-US") + " GT" }] : []),
    ...(ship.engineType ? [{ icon: Cog, label: "Engine", value: ship.engineType }] : []),
    ...(ship.enginePowerKw > 0 ? [{ icon: Cog, label: "Engine Power", value: (ship.enginePowerKw / 1000).toFixed(0) + " MW" }] : []),
    ...(ship.speedKnots > 0 ? [{ icon: Gauge, label: "Service Speed", value: ship.speedKnots + " knots" }] : []),
    ...(ship.fuelConsumption > 0 ? [{ icon: Fuel, label: "Fuel Consumption", value: ship.fuelConsumption + " t/day" }] : []),
    ...(ship.fuelType ? [{ icon: Fuel, label: "Fuel Type", value: ship.fuelType }] : []),
    ...(ship.crewSize > 0 ? [{ icon: Users, label: "Crew", value: ship.crewSize.toString() }] : []),
    ...(ship.holds > 0 ? [{ icon: Box, label: "Cargo Holds", value: ship.holds + " holds / " + ship.hatches + " hatches" }] : []),
    ...(ship.grainCapacity > 0 ? [{ icon: Box, label: "Grain Capacity", value: ship.grainCapacity.toLocaleString("en-US") + " m³" }] : []),
    ...(ship.teu > 0 ? [{ icon: Box, label: "TEU Capacity", value: ship.teu.toLocaleString("en-US") + " TEU" }] : []),
    ...(ship.cranes ? [{ icon: Cog, label: "Cranes", value: ship.cranes }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
          <div className="flex items-center gap-1.5">
            <Badge className={`${getRecommendationColor(price.recommendation)} border`}>
              {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleWatch(ship.imo)}
              className="border-amber-500/30"
            >
              {isWatched ? (
                <>
                  <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                  Watchlist
                </>
              ) : (
                <>
                  <StarOff className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Title Section */}
        <section>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0">
              {ship.type}
            </Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-cyan-400">
              IMO: {ship.imo}
            </Badge>
            {ship.mmsi && (
              <Badge variant="outline" className="border-slate-500/30">
                MMSI: {ship.mmsi}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
            {ship.name}
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/50">
            {ship.operator || "Unknown Operator"} · 🇺🇳 {ship.flag} · {ship.homePort || "Home Port Unknown"}
          </p>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Ship Image + Specs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ship Image */}
            <Card className="overflow-hidden border-blue-500/20">
              <div className="aspect-video bg-slate-200 dark:bg-slate-800">
                {ship.imageUrl ? (
                  <img
                    src={ship.imageUrl}
                    alt={ship.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
                    style={{ background: ship.status === "under_construction"
                      ? "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)"
                      : "linear-gradient(135deg, #1e293b, #0f172a)" }}>
                    {/* Animated construction lines for newbuilds */}
                    {ship.status === "under_construction" && (
                      <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, #fbbf24 20px, #fbbf24 22px)",
                        animation: "stripe-scroll 3s linear infinite",
                      }} />
                    )}
                    <div className="relative z-10 text-center">
                      <div className="text-5xl mb-3">
                        {ship.status === "under_construction" ? "🏗️" :
                         ship.type.includes("Tanker") || ship.type.includes("VLCC") || ship.type.includes("Crude") ? "🛢️" :
                         ship.type.includes("Container") || ship.type.includes("ULCV") ? "📦" :
                         ship.type.includes("LNG") || ship.type.includes("LPG") ? "⛽" :
                         ship.type.includes("Cruise") || ship.type.includes("Passenger") ? "🚢" :
                         ship.type.includes("Car") || ship.type.includes("RoRo") ? "🚗" :
                         ship.type.includes("Tug") ? "⚓" : "🚢"}
                      </div>
                      <p className="text-sm font-semibold text-white/60">{ship.type}</p>
                      {ship.status === "under_construction" && ship.deliveryDate && (
                        <p className="text-xs text-amber-400/80 mt-1 font-medium">ETA {ship.deliveryDate}</p>
                      )}
                      {ship.builder && ship.status === "under_construction" && (
                        <p className="text-xs text-white/40 mt-0.5">{ship.builder}</p>
                      )}
                    </div>
                    <style>{"@keyframes stripe-scroll { to { background-position: 60px 0 } }"}</style>
                  </div>
                )}
              </div>
              {ship.imageAttribution && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-500 dark:text-white/40 font-mono">
                  Photo: {ship.imageAttribution}
                </div>
              )}
            </Card>

            {/* Specs */}
            <Card className="border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShipIcon className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                  Technical Specifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {specs.map((spec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <spec.icon className="h-4 w-4 text-blue-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-wider">
                          {spec.label}
                        </p>
                        <p className="text-sm font-semibold">{spec.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Live Route / Voyage */}
            <Card className={ship.position ? "border-emerald-500/30" : "border-blue-500/20"}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                  {ship.position ? "Current Voyage" : "Estimated Voyage"}
                  <Badge className={`${getStatusColor(voyage.currentStatus)} border ml-auto`}>
                    {getStatusLabel(voyage.currentStatus)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-2xl">{voyage.from.countryFlag}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">From</p>
                    <p className="font-semibold text-sm truncate">{voyage.from.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/40">{voyage.from.country}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="text-2xl">{voyage.to.countryFlag}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">To</p>
                    <p className="font-semibold text-sm truncate">{voyage.to.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/40">{voyage.to.country}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Cargo</p>
                    <p className="text-sm font-semibold">{voyage.cargoDescription}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Load</p>
                    <p className="text-sm font-semibold">{voyage.cargoLoadPercent}%</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Speed</p>
                    <p className="text-sm font-semibold tabular-nums">{voyage.speedKnots} kn</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Distance</p>
                    <p className="text-sm font-semibold tabular-nums">{voyage.distanceNm} sm</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-white/40">Progress</span>
                    <span className="font-semibold tabular-nums">{voyage.progressPercent}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${voyage.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-white/60 pt-2 border-t border-slate-200 dark:border-white/10">
                  <span>Departure: {voyage.departureDate.toLocaleDateString("en-US")}</span>
                  <span className="font-semibold">
                    ETA: {voyage.eta.toLocaleDateString("en-US")} ·{" "}
                    {voyage.eta.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {ship.position ? (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded px-2 py-1">
                    ✓ Live AIS Position · {ship.position.lat.toFixed(4)}°N {ship.position.lon.toFixed(4)}°E
                    {ship.lastSeen ? ` · ${new Date(ship.lastSeen * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 dark:text-white/30 bg-slate-500/5 border border-slate-500/20 rounded px-2 py-1">
                    ⚠ Illustrative voyage — no live AIS position available for IMO {ship.imo}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Price + Recommendation */}
          <div className="space-y-6">
            {ship.dwt > 0 && (
              <>
                {/* Price Estimation */}
                <Card className="border-blue-500/20 overflow-hidden">
                  <div className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white p-5">
                    <p className="text-xs uppercase tracking-wider text-white/70 mb-1">Estimated Value</p>
                    <p className="text-4xl font-bold tabular-nums">{formatPrice(price.estimatedValueUSD)}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span>Confidence:</span>
                      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${price.confidenceScore}%` }} />
                      </div>
                      <span className="font-semibold">{price.confidenceScore}%</span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">{price.reasoning}</p>
                  </CardContent>
                </Card>

                {/* Recommendation */}
                <Card className={`border-2 ${getRecommendationColor(price.recommendation).split(" ").find((c) => c.startsWith("border-"))}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40">Recommendation</p>
                        <p className="text-2xl font-bold flex items-center gap-2">
                          {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">{price.recommendationReasoning}</p>
                  </CardContent>
                </Card>

                {/* Price Factors */}
                <Card className="border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                      Value Factors
                    </CardTitle>
                  </CardHeader>
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
                  </CardContent>
                </Card>
              </>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Link href={`/vergleich?ships=${ship.imo}`}>
                <Button variant="outline" className="w-full border-blue-500/30 text-blue-700 dark:text-cyan-400">
                  ⚖️ Compare with other ships
                </Button>
              </Link>
              {ship.imageUrl && (
                <a href={ship.imageUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full border-slate-500/30">
                    <Download className="h-4 w-4 mr-1.5" />
                    Download Image
                  </Button>
                </a>
              )}
            </div>

            {/* Nearby Survey Ports */}
            <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                  Nearby Survey Ports
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  Recommended ports for a pre-purchase inspection — based on current position:
                </p>
                {nearbySurveyPorts.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-white/40">No survey ports within range.</p>
                ) : (
                  <div className="space-y-2">
                    {nearbySurveyPorts.map(({ port, distanceNm }) => (
                      <div key={port.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-900/50 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors">
                        <span className="text-2xl flex-shrink-0">{port.countryFlag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm truncate">{port.name}</p>
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/5 flex-shrink-0">
                              ⭐ {port.rating}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-white/40">
                            <span>{Math.round(distanceNm)} nm away</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium">{formatSurveyCost(port.typicalSurveyCost)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/survey-haefen">
                  <Button variant="outline" size="sm" className="w-full border-purple-500/30 text-purple-700 dark:text-purple-300">
                    View All Survey Ports
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
