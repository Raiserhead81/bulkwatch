"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hammer, Calendar, Building2, Flag } from "lucide-react";

interface NewbuildShip {
  imo: string;
  name: string;
  type: string;
  dwt: number;
  length: number;
  beam: number;
  yearBuilt: number;
  builder?: string;
  operator?: string;
  operatorWebsite?: string;
  operatorEmail?: string;
  operatorPhone?: string;
  operatorCity?: string;
  operatorCountry?: string;
  flag: string;
  imageUrl?: string;
  status: string;
  deliveryDate?: string;
}

const SHIP_TYPES = [
  "All",
  "Bulk Carrier",
  "Tanker",
  "Container",
  "General Cargo",
  "LNG",
  "LPG",
  "VLCC",
  "Capesize",
  "Panamax",
];

function formatDWT(dwt: number): string {
  if (!dwt) return "—";
  return dwt.toLocaleString() + " DWT";
}

function formatDeliveryDate(dateStr?: string): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function groupByDeliveryDate(ships: NewbuildShip[]): Record<string, NewbuildShip[]> {
  const groups: Record<string, NewbuildShip[]> = {};
  for (const ship of ships) {
    const key = ship.deliveryDate
      ? new Date(ship.deliveryDate).getFullYear().toString()
      : "TBD";
    if (!groups[key]) groups[key] = [];
    groups[key].push(ship);
  }
  // Sort groups chronologically, TBD last
  const sorted: Record<string, NewbuildShip[]> = {};
  const keys = Object.keys(groups).sort((a, b) => {
    if (a === "TBD") return 1;
    if (b === "TBD") return -1;
    return Number(a) - Number(b);
  });
  for (const k of keys) sorted[k] = groups[k];
  return sorted;
}

function AnimatedCount({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const step = Math.ceil(value / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        setDisplayed(start);
      }
    }, 20);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
      {displayed}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "sky",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "sky" | "violet" | "emerald" | "amber";
}) {
  const gradients: Record<string, string> = {
    sky: "from-sky-500/10 to-sky-500/5 border-sky-500/10",
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/10",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/10",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/10",
  };
  const textColors: Record<string, string> = {
    sky: "from-sky-500 to-blue-600",
    violet: "from-violet-500 to-purple-600",
    emerald: "from-emerald-500 to-green-600",
    amber: "from-amber-500 to-orange-500",
  };

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-4 ${gradients[color]}`}
    >
      <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </p>
      <p
        className={`text-2xl font-bold bg-gradient-to-r ${textColors[color]} bg-clip-text text-transparent`}
      >
        {typeof value === "number" ? <AnimatedCount value={value} /> : value}
      </p>
      {sub && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

function ShipCard({ ship }: { ship: NewbuildShip }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className="group cursor-pointer border border-slate-300/60 dark:border-slate-700/40 bg-slate-100 dark:bg-slate-900/60 hover:border-sky-500/30 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
      onClick={() => setExpanded((v) => !v)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {ship.name || "Unnamed"}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              IMO {ship.imo}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-widest border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5 flex items-center gap-1"
            >
              <Hammer className="w-2.5 h-2.5" />
              Under Construction
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-widest border-slate-300/50 dark:border-slate-600/50 text-slate-500 dark:text-slate-400"
            >
              {ship.type}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              DWT
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {ship.dwt ? ship.dwt.toLocaleString() : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              LOA
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {ship.length ? `${ship.length}m` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Beam
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
              {ship.beam ? `${ship.beam}m` : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {ship.builder && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              {ship.builder}
            </span>
          )}
          {ship.flag && (
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3 text-slate-400" />
              {ship.flag}
            </span>
          )}
          {ship.deliveryDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formatDeliveryDate(ship.deliveryDate)}
            </span>
          )}
        </div>

        {expanded && ship.operator && (
          <div className="mt-3 rounded-xl border border-slate-300/60 dark:border-slate-700/40 bg-slate-50 dark:bg-slate-800/40 p-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
              Operator
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {ship.operator}
            </p>
            {(ship.operatorCity || ship.operatorCountry) && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {[ship.operatorCity, ship.operatorCountry]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {ship.operatorWebsite && (
                <a
                  href={
                    ship.operatorWebsite.startsWith("http")
                      ? ship.operatorWebsite
                      : `https://${ship.operatorWebsite}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {ship.operatorWebsite}
                </a>
              )}
              {ship.operatorEmail && (
                <a
                  href={`mailto:${ship.operatorEmail}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {ship.operatorEmail}
                </a>
              )}
              {ship.operatorPhone && (
                <a
                  href={`tel:${ship.operatorPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {ship.operatorPhone}
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NewbuildsPage() {
  const [ships, setShips] = useState<NewbuildShip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState("All");

  useEffect(() => {
    fetch("/api/ships?status=under_construction&limit=200&sort=year")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setShips(Array.isArray(data) ? data : data.ships ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered =
    activeType === "All"
      ? ships
      : ships.filter((s) =>
          s.type?.toLowerCase().includes(activeType.toLowerCase())
        );

  const grouped = groupByDeliveryDate(filtered);

  const uniqueTypes = Array.from(new Set(ships.map((s) => s.type).filter(Boolean)));
  const availableTypes = ["All", ...uniqueTypes];

  const totalDWT = filtered.reduce((acc, s) => acc + (s.dwt || 0), 0);
  const uniqueBuilders = new Set(filtered.map((s) => s.builder).filter(Boolean))
    .size;
  const nearestYear = Object.keys(grouped).filter((k) => k !== "TBD")[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-slate-200 to-slate-100 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* Page header */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
            BulkWatch / Orderbook
          </p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Newbuilds
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vessels under construction, grouped by delivery year
          </p>
        </div>

        {/* Stats */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total Vessels"
              value={filtered.length}
              color="sky"
            />
            <StatCard
              label="Total DWT"
              value={
                totalDWT >= 1_000_000
                  ? `${(totalDWT / 1_000_000).toFixed(1)}M`
                  : totalDWT.toLocaleString()
              }
              color="violet"
            />
            <StatCard
              label="Shipyards"
              value={uniqueBuilders}
              color="emerald"
            />
            <StatCard
              label="Earliest Delivery"
              value={nearestYear ?? "—"}
              color="amber"
            />
          </div>
        )}

        {/* Type filter chips */}
        {!loading && !error && availableTypes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {availableTypes.map((type) => {
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`
                    rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200
                    ${
                      isActive
                        ? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                        : "bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-slate-700/40 hover:border-sky-500/30 hover:text-sky-600 dark:hover:text-sky-400"
                    }
                  `}
                >
                  {type}
                  {type !== "All" && (
                    <span
                      className={`ml-1.5 text-[10px] ${isActive ? "opacity-70" : "text-slate-400"}`}
                    >
                      {ships.filter((s) =>
                        s.type?.toLowerCase().includes(type.toLowerCase())
                      ).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-sky-500/20 border-t-sky-500 animate-spin" />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Loading orderbook…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10 p-6 text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              Failed to load newbuilds
            </p>
            <p className="text-xs text-red-400 dark:text-red-500 mt-1">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Hammer className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              No newbuilds found
              {activeType !== "All" ? ` for type "${activeType}"` : ""}.
            </p>
          </div>
        )}

        {/* Grouped ship cards */}
        {!loading &&
          !error &&
          Object.entries(grouped).map(([year, yearShips]) => (
            <section key={year} className="space-y-4">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-sky-500" />
                <h2 className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold">
                  Delivery {year}
                </h2>
                <div className="flex-1 h-px bg-slate-200/60 dark:bg-slate-700/40" />
                <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {yearShips.length} vessel{yearShips.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearShips.map((ship) => (
                  <ShipCard key={ship.imo} ship={ship} />
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
