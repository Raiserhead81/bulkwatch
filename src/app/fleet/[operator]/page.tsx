"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { estimatePrice } from "@/lib/priceEstimator";

interface FleetShip {
  imo: string;
  name: string;
  type: string;
  dwt: number;
  length: number;
  beam: number;
  draft: number;
  yearBuilt: number;
  builder?: string;
  flag: string;
  operator?: string;
  imageUrl?: string;
  status: string;
  grossTonnage: number;
  engineType?: string;
  enginePowerKw: number;
  speedKnots: number;
  fuelConsumption: number;
  fuelType?: string;
  crewSize: number;
  lat?: number;
  lon?: number;
}

interface OperatorInfo {
  name: string;
  country: string;
  city: string;
  website: string;
  email: string;
  phone: string;
  fleetSize: number;
}

interface FleetStats {
  count: number;
  totalDwt: number;
  avgAge: number;
  types: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  "Bulk Carrier": "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
  "Tanker": "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
  "Container": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
  "General Cargo": "bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20",
  "LNG Carrier": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20",
  "LPG Carrier": "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
  "Ro-Ro": "bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20",
};

const TYPE_DOT: Record<string, string> = {
  "Bulk Carrier": "bg-blue-400",
  "Tanker": "bg-amber-400",
  "Container": "bg-emerald-400",
  "General Cargo": "bg-violet-400",
  "LNG Carrier": "bg-cyan-400",
  "LPG Carrier": "bg-orange-400",
  "Ro-Ro": "bg-pink-400",
};

function getTypeColor(type: string) {
  return TYPE_COLORS[type] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20";
}

function getTypeDot(type: string) {
  return TYPE_DOT[type] ?? "bg-slate-400";
}

function formatDwt(dwt: number) {
  if (dwt >= 1_000_000) return `${(dwt / 1_000_000).toFixed(1)}M`;
  if (dwt >= 1_000) return `${(dwt / 1_000).toFixed(0)}k`;
  return String(dwt);
}

function formatValue(usd: number) {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${usd}`;
}

function computeStats(ships: FleetShip[]): FleetStats {
  const currentYear = new Date().getFullYear();
  const types: Record<string, number> = {};
  let totalDwt = 0;
  let totalAge = 0;
  for (const s of ships) {
    totalDwt += s.dwt;
    totalAge += currentYear - s.yearBuilt;
    types[s.type] = (types[s.type] ?? 0) + 1;
  }
  return {
    count: ships.length,
    totalDwt,
    avgAge: ships.length > 0 ? Math.round(totalAge / ships.length) : 0,
    types,
  };
}

export default function FleetPage() {
  const params = useParams();
  const slug = typeof params?.operator === "string" ? params.operator : Array.isArray(params?.operator) ? params.operator[0] : "";

  const [ships, setShips] = useState<FleetShip[]>([]);
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"dwt" | "name" | "year">("dwt");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetch(`/api/ships/fleet?operator=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setShips(data.ships ?? []);
        setOperatorInfo(data.operator ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const stats = computeStats(ships);
  const fleetValue = ships.reduce(
    (sum, s) => sum + estimatePrice(s).estimatedValueUSD,
    0
  );

  const typeList = ["All", ...Object.keys(stats.types).sort()];

  const filtered = ships
    .filter((s) => activeType === "All" || s.type === activeType)
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "year") return b.yearBuilt - a.yearBuilt;
      return b.dwt - a.dwt;
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-white dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">

        {/* ── Operator Header ── */}
        {operatorInfo && !loading && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Fleet Overview
            </p>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {operatorInfo.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 pt-1">
              <span>
                {operatorInfo.city}, {operatorInfo.country}
              </span>
              {operatorInfo.website && (
                <a
                  href={operatorInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-500 transition-colors underline-offset-2 hover:underline"
                >
                  {operatorInfo.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {operatorInfo.email && (
                <a
                  href={`mailto:${operatorInfo.email}`}
                  className="hover:text-blue-500 transition-colors underline-offset-2 hover:underline"
                >
                  {operatorInfo.email}
                </a>
              )}
              {operatorInfo.phone && (
                <a
                  href={`tel:${operatorInfo.phone}`}
                  className="hover:text-blue-500 transition-colors underline-offset-2 hover:underline"
                >
                  {operatorInfo.phone}
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Loading / Error ── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-4 text-red-400 text-sm">
            Failed to load fleet data: {error}
          </div>
        )}

        {!loading && !error && ships.length > 0 && (
          <>
            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Ships",
                  value: stats.count.toLocaleString(),
                  gradient: "from-blue-600 to-blue-400",
                },
                {
                  label: "Total DWT",
                  value: formatDwt(stats.totalDwt),
                  gradient: "from-violet-600 to-violet-400",
                },
                {
                  label: "Avg Age",
                  value: `${stats.avgAge} yrs`,
                  gradient: "from-amber-600 to-amber-400",
                },
                {
                  label: "Est. Fleet Value",
                  value: formatValue(fleetValue),
                  gradient: "from-emerald-600 to-emerald-400",
                },
              ].map(({ label, value, gradient }) => (
                <Card
                  key={label}
                  className="relative overflow-hidden border-0 bg-white/60 dark:bg-white/[0.03] backdrop-blur-sm shadow-sm dark:shadow-none ring-1 ring-black/5 dark:ring-white/[0.06]"
                >
                  <div className="p-5 space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {label}
                    </p>
                    <p
                      className={`text-2xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
                    >
                      {value}
                    </p>
                  </div>
                  <div
                    className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] blur-xl`}
                  />
                </Card>
              ))}
            </div>

            {/* ── Filter + Sort Bar ── */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Type chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                {typeList.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveType(t)}
                    className={`
                      rounded-full px-3 py-1 text-xs font-medium border transition-all duration-150
                      ${
                        activeType === t
                          ? t === "All"
                            ? "bg-slate-800 text-white border-slate-700 dark:bg-white dark:text-slate-900 dark:border-white"
                            : `${getTypeColor(t)} border`
                          : t === "All"
                          ? "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:bg-white/10"
                          : `bg-transparent ${getTypeColor(t)} border opacity-60 hover:opacity-100`
                      }
                    `}
                  >
                    {t}
                    {t !== "All" && stats.types[t] != null && (
                      <span className="ml-1 opacity-60">({stats.types[t]})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "dwt" | "name" | "year")
                  }
                  className="text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer appearance-none"
                  style={{ backgroundImage: "none" }}
                >
                  <option value="dwt">Sort: DWT ↓</option>
                  <option value="name">Sort: Name A–Z</option>
                  <option value="year">Sort: Newest First</option>
                </select>
              </div>
            </div>

            {/* ── Ship Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((ship) => {
                const isLive =
                  ship.lat != null &&
                  ship.lon != null &&
                  ship.status?.toLowerCase() === "underway";
                const age = new Date().getFullYear() - ship.yearBuilt;

                return (
                  <a key={ship.imo} href={`/ships/${ship.imo}`} className="group block">
                    <Card className="overflow-hidden border-0 bg-white/70 dark:bg-white/[0.03] backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/[0.06] shadow-sm dark:shadow-none transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl dark:group-hover:ring-white/10">
                      {/* Image */}
                      <div className="relative h-44 bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                        {ship.imageUrl ? (
                          <img
                            src={ship.imageUrl}
                            alt={ship.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-16 h-16 text-slate-200 dark:text-white/10"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.37 0 2.74-.35 4-1.03 2.52 1.37 5.48 1.37 8 0 1.26.68 2.63 1.03 4 1.03h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.14.52-.06.78L3.95 19z" />
                            </svg>
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                        {/* Type dot */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${getTypeDot(ship.type)} shadow-sm`}
                          />
                          <span className="text-[10px] uppercase tracking-widest text-white/80">
                            {ship.type}
                          </span>
                        </div>

                        {/* LIVE badge */}
                        {isLive && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-green-400">
                              Live
                            </span>
                          </div>
                        )}

                        {/* Name on image */}
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
                          <p className="text-sm font-semibold text-white leading-tight truncate">
                            {ship.name}
                          </p>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="p-3 space-y-2.5">
                        {/* Specs row */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: "DWT", value: formatDwt(ship.dwt) },
                            { label: "Year", value: ship.yearBuilt },
                            { label: "Flag", value: ship.flag },
                          ].map(({ label, value }) => (
                            <div key={label} className="text-center">
                              <p className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                {label}
                              </p>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-100 dark:border-white/[0.05]" />

                        {/* Footer row */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {age} yrs · {ship.speedKnots} kn
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase tracking-widest border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 px-1.5 py-0"
                          >
                            IMO {ship.imo}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </a>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm">
                No ships match this filter.
              </div>
            )}
          </>
        )}

        {!loading && !error && ships.length === 0 && (
          <div className="text-center py-32 text-slate-400 dark:text-slate-500 text-sm">
            No fleet data found for this operator.
          </div>
        )}
      </div>
    </div>
  );
}
