"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { estimatePrice } from "@/lib/priceEstimator";

interface Ship {
  imo: string;
  name: string;
  type: string;
  dwt: number;
  length: number;
  beam: number;
  draft: number;
  yearBuilt: number;
  flag: string;
  operator?: string;
  imageUrl?: string;
  grossTonnage: number;
  engineType?: string;
  enginePowerKw: number;
  speedKnots: number;
  fuelConsumption: number;
  fuelType?: string;
  crewSize: number;
}

type SpecRow = {
  label: string;
  key: keyof Ship | "estimatedValue" | "dollarPerDwt";
  format: (ship: Ship) => string | number;
  unit?: string;
  compareMode?: "higher" | "lower";
};

const SPEC_ROWS: SpecRow[] = [
  { label: "Type", key: "type", format: (s) => s.type },
  { label: "DWT", key: "dwt", format: (s) => s.dwt.toLocaleString(), unit: "t", compareMode: "higher" },
  { label: "Year Built", key: "yearBuilt", format: (s) => s.yearBuilt, compareMode: "higher" },
  { label: "Length", key: "length", format: (s) => s.length.toFixed(1), unit: "m" },
  { label: "Beam", key: "beam", format: (s) => s.beam.toFixed(1), unit: "m" },
  { label: "Draft", key: "draft", format: (s) => s.draft.toFixed(1), unit: "m" },
  { label: "Flag", key: "flag", format: (s) => s.flag },
  { label: "Gross Tonnage", key: "grossTonnage", format: (s) => s.grossTonnage.toLocaleString(), unit: "GT", compareMode: "higher" },
  { label: "Engine", key: "engineType", format: (s) => s.engineType ?? "—" },
  { label: "Power", key: "enginePowerKw", format: (s) => s.enginePowerKw.toLocaleString(), unit: "kW", compareMode: "higher" },
  { label: "Speed", key: "speedKnots", format: (s) => s.speedKnots.toFixed(1), unit: "kn", compareMode: "higher" },
  { label: "Fuel Consumption", key: "fuelConsumption", format: (s) => s.fuelConsumption.toFixed(1), unit: "t/day", compareMode: "lower" },
  { label: "Fuel Type", key: "fuelType", format: (s) => s.fuelType ?? "—" },
  { label: "Crew", key: "crewSize", format: (s) => s.crewSize, compareMode: "lower" },
  { label: "Operator", key: "operator", format: (s) => s.operator ?? "—" },
  {
    label: "Est. Value",
    key: "estimatedValue",
    format: (s) => {
      const val = estimatePrice(s).estimatedValueUSD;
      return "$" + (val / 1_000_000).toFixed(1) + "M";
    },
    compareMode: "higher",
  },
  {
    label: "$/DWT",
    key: "dollarPerDwt",
    format: (s) => {
      const val = estimatePrice(s).estimatedValueUSD;
      return "$" + (val / s.dwt).toFixed(0);
    },
    compareMode: "lower",
  },
];

function getNumericValue(ship: Ship, row: SpecRow): number | null {
  if (row.key === "estimatedValue") {
    return estimatePrice(ship).estimatedValueUSD;
  }
  if (row.key === "dollarPerDwt") {
    return estimatePrice(ship).estimatedValueUSD / ship.dwt;
  }
  const v = ship[row.key as keyof Ship];
  return typeof v === "number" ? v : null;
}

function getBestIndex(ships: Ship[], row: SpecRow): number | null {
  if (!row.compareMode) return null;
  const values = ships.map((s) => getNumericValue(s, row));
  const allNull = values.every((v) => v === null);
  if (allNull) return null;
  let bestIdx = -1;
  let bestVal: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    if (
      bestVal === null ||
      (row.compareMode === "higher" && v > bestVal) ||
      (row.compareMode === "lower" && v < bestVal)
    ) {
      bestVal = v;
      bestIdx = i;
    }
  });
  return bestIdx >= 0 ? bestIdx : null;
}

export default function BulkwatchVergleich() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Ship[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchShips = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/ships?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setResults(data);
      setDropdownOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchShips(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchShips]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addShip(ship: Ship) {
    if (ships.length >= 5) return;
    if (ships.find((s) => s.imo === ship.imo)) return;
    setShips((prev) => [...prev, ship]);
    setQuery("");
    setResults([]);
    setDropdownOpen(false);
  }

  function removeShip(imo: string) {
    setShips((prev) => prev.filter((s) => s.imo !== imo));
  }

  function clearAll() {
    setShips([]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-300 via-slate-300 to-slate-200 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page Header */}
        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-2">
            BulkWatch · Fleet Intelligence
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                Ship Comparison
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Compare up to 5 vessels side-by-side across all specifications
              </p>
            </div>
            {ships.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-400 hover:text-red-400 dark:hover:text-red-400 transition-colors border border-slate-400 dark:border-white/10 hover:border-red-200 dark:hover:border-red-400/20 rounded-lg px-3 py-1.5"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div ref={searchRef} className="relative mb-8 max-w-lg">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              {loadingSearch ? (
                <svg className="h-4 w-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ships.length >= 5 ? "Maximum 5 ships reached" : "Search by name or IMO…"}
              disabled={ships.length >= 5}
              className="w-full rounded-xl border border-slate-400 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 dark:focus:border-blue-500/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); setDropdownOpen(false); }}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && results.length > 0 && (
            <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-400 dark:border-white/10 bg-white dark:bg-[#111126] shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
              {results.map((ship) => {
                const already = !!ships.find((s) => s.imo === ship.imo);
                return (
                  <button
                    key={ship.imo}
                    onClick={() => !already && addShip(ship)}
                    disabled={already}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      already
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-300 dark:bg-white/[0.06] flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l2-8h14l2 8M5 17h14M12 3v6m-4-3h8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{ship.name}</p>
                      <p className="text-xs text-slate-400 truncate">IMO {ship.imo} · {ship.type}</p>
                    </div>
                    {already && (
                      <Badge variant="secondary" className="text-[10px]">Added</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {dropdownOpen && results.length === 0 && !loadingSearch && query.trim() && (
            <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-400 dark:border-white/10 bg-white dark:bg-[#111126] shadow-xl shadow-black/10 dark:shadow-black/40 px-4 py-3 text-sm text-slate-400 text-center">
              No vessels found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Empty State */}
        {ships.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-300 dark:bg-white/[0.04] border border-slate-400 dark:border-white/[0.06] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l2-8h14l2 8M5 17h14M12 3v6m-4-3h8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No ships selected</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Search above to add up to 5 vessels for comparison</p>
          </div>
        )}

        {/* Comparison Table */}
        {ships.length > 0 && (
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{ gridTemplateColumns: `220px repeat(${ships.length}, minmax(180px, 1fr))` }}
            >
              {/* Ship Header Cards */}
              <div className="sticky left-0 z-10 bg-slate-50/80 dark:bg-[#060610]/80 backdrop-blur-md" />
              {ships.map((ship) => (
                <div key={ship.imo} className="px-2 pb-4">
                  <Card className="relative overflow-hidden bg-slate-300/70 dark:bg-white/[0.03] backdrop-blur-xl border border-slate-400/40 dark:border-white/[0.07] shadow-sm">
                    {/* Ship image */}
                    <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.04] dark:to-white/[0.02] overflow-hidden">
                      {ship.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ship.imageUrl}
                          alt={ship.name}
                          className="w-full h-full object-cover opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l2-8h14l2 8M5 17h14M12 3v6m-4-3h8" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeShip(ship.imo)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/20 dark:bg-black/40 hover:bg-red-500/80 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
                      title="Remove"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <div className="p-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight line-clamp-2">
                        {ship.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
                        IMO {ship.imo}
                      </p>
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {ship.type}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}

              {/* Spec Rows */}
              {SPEC_ROWS.map((row, rowIdx) => {
                const bestIdx = getBestIndex(ships, row);
                const isEven = rowIdx % 2 === 0;

                return (
                  <>
                    {/* Label cell */}
                    <div
                      key={`label-${row.key}`}
                      className={[
                        "sticky left-0 z-10 flex items-center px-4 py-2.5 border-r",
                        isEven
                          ? "bg-slate-400/30 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.04]"
                          : "bg-slate-50 dark:bg-white/[0.01] border-slate-100/60 dark:border-white/[0.03]",
                      ].join(" ")}
                    >
                      <span className="text-[10px] uppercase tracking-widest font-medium text-slate-500 dark:text-slate-500 whitespace-nowrap">
                        {row.label}
                      </span>
                    </div>

                    {/* Value cells */}
                    {ships.map((ship, shipIdx) => {
                      const isBest = bestIdx === shipIdx && ships.length > 1;
                      return (
                        <div
                          key={`${row.key}-${ship.imo}`}
                          className={[
                            "flex items-center px-4 py-2.5",
                            isEven
                              ? "bg-slate-400/30 dark:bg-white/[0.02]"
                              : "bg-slate-50 dark:bg-white/[0.01]",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "text-sm font-medium",
                              isBest
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-700 dark:text-slate-300",
                            ].join(" ")}
                          >
                            {String(row.format(ship))}
                            {row.unit && (
                              <span className="ml-1 text-[10px] font-normal text-slate-500 dark:text-slate-500">
                                {row.unit}
                              </span>
                            )}
                            {isBest && (
                              <svg
                                className="inline-block ml-1 w-3 h-3 text-emerald-500 dark:text-emerald-400"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        {ships.length > 1 && (
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
            <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Best value in category</span>
          </div>
        )}
      </div>
    </div>
  );
}
