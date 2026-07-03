"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Animated counter hook ──────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef(false);
  useEffect(() => {
    if (target <= 0) return;
    if (ref.current && value === target) return;
    ref.current = true;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

const SHIP_TYPES = [
  "Capesize","Newcastlemax","VLOC","Kamsarmax","Panamax","Ultramax","Supramax",
  "Handymax","Handysize","Mini-Bulker","Geared","Gearless",
  "General Cargo","Container Ship","Tanker","Crude Oil Tanker","Product Tanker",
  "Chemical Tanker","LNG Tanker","LPG Tanker","RoRo","Car Carrier",
  "Ferry","Passenger","Offshore","Tug","Other"
];

const AGE_RANGES = [
  { label: "All Ages", min: "", max: "" },
  { label: "0–5 yr", min: "0", max: "5" },
  { label: "5–10 yr", min: "5", max: "10" },
  { label: "10–15 yr", min: "10", max: "15" },
  { label: "15–20 yr", min: "15", max: "20" },
  { label: "20+ yr", min: "20", max: "" },
];

const DWT_RANGES = [
  { label: "All DWT", min: "", max: "" },
  { label: "Handysize <40k", min: "", max: "40000" },
  { label: "Handymax 40–60k", min: "40000", max: "60000" },
  { label: "Panamax 60–80k", min: "60000", max: "80000" },
  { label: "Capesize 80–200k", min: "80000", max: "200000" },
  { label: "VLOC 200k+", min: "200000", max: "" },
];

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Under Construction", value: "under_construction" },
  { label: "Scrapped", value: "scrapped" },
  { label: "Lost", value: "lost" },
];

interface Ship {
  id: string; imo: string; name: string; type: string;
  dwt: number; yearBuilt: number; flag: string;
  operator?: string; imageUrl?: string; status: string;
  lat?: number; lon?: number; estimatedValue?: number;
}

interface Stats { total: number; withImage: number; withPosition: number; totalDwt: number; }
interface MarketData {
  bdi: number; bunkerVLSFO: number; bunkerHSFO: number; bunkerMGO: number;
  scrapLDT: number; charterRates: Record<string, number>; date: string;
}

const LIMIT = 24;

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{username:string;company:string;role:string}|null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, withImage: 0, withPosition: 0, totalDwt: 0 });
  const [market, setMarket] = useState<MarketData | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [flagFilter, setFlagFilter] = useState("");
  const [ageRange, setAgeRange] = useState(0);
  const [dwtRange, setDwtRange] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<string[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Animated counters
  const animTotal = useCountUp(stats.total);
  const animPhotos = useCountUp(stats.withImage);
  const animGps = useCountUp(stats.withPosition);
  const animDwt = useCountUp(Math.round(stats.totalDwt / 1e6));

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{if(d.user) setCurrentUser(d.user)}).catch(()=>{});
    fetch("/api/ships/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
    fetch("/api/ships/flags").then(r => r.ok ? r.json() : null).then(d => { if (d?.flags) setFlags(d.flags.slice(0, 100)); }).catch(() => {});
    fetch("/api/ships/operators").then(r => r.ok ? r.json() : null).then(d => { if (d?.operators) setOperators(d.operators); }).catch(() => {});
    fetch("/api/market").then(r => r.ok ? r.json() : null).then(d => { if (d) setMarket(d); }).catch(() => {});
  }, []);

  const fetchShips = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort: sortBy });
    if (search) p.set("search", search);
    if (typeFilter) p.set("type", typeFilter);
    if (flagFilter) p.set("flag", flagFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (operatorFilter) p.set("operator", operatorFilter);
    const age = AGE_RANGES[ageRange];
    if (age.min) p.set("age_min", age.min);
    if (age.max) p.set("age_max", age.max);
    const dwt = DWT_RANGES[dwtRange];
    if (dwt.min) p.set("dwt_min", dwt.min);
    if (dwt.max) p.set("dwt_max", dwt.max);
    fetch(`/api/ships?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setShips(d.ships || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 0); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, search, typeFilter, flagFilter, sortBy, ageRange, dwtRange, statusFilter, operatorFilter]);

  useEffect(() => { const t = setTimeout(fetchShips, search ? 300 : 0); return () => clearTimeout(t); }, [fetchShips]);
  useEffect(() => { setPage(1); }, [search, typeFilter, flagFilter, sortBy, ageRange, dwtRange, statusFilter, operatorFilter]);

  const activeFilterCount = [typeFilter, flagFilter, statusFilter, operatorFilter, ageRange > 0 ? "x" : "", dwtRange > 0 ? "x" : ""].filter(Boolean).length;
  const fmtDwt = (d: number) => d > 0 ? `${(d/1000).toFixed(0)}k` : "";
  const fmtVal = (v?: number) => v && v > 0 ? `$${(v/1e6).toFixed(1)}M` : null;

  const inputCls = "px-3 py-2.5 text-sm bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/50 rounded-lg focus:ring-2 focus:ring-sky-500/40 outline-none backdrop-blur-sm transition-colors";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-slate-200 to-slate-100 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a] text-slate-900 dark:text-white">

      {/* ═══ HERO ═══ */}
      <div className="relative border-b border-slate-300/80 dark:border-white/[0.04] overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/[0.03] via-violet-500/[0.03] to-emerald-500/[0.03] dark:from-sky-500/[0.06] dark:via-violet-500/[0.04] dark:to-emerald-500/[0.06] animate-gradient-shift" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-400/[0.05] via-transparent to-transparent" />

        <div className="relative max-w-[95%] mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              {currentUser && currentUser.username !== "kay" && currentUser.username !== "admin" ? (
                <div className="flex items-center gap-3">
                  <img src="/logos/arklow-crest.png" alt="" className="h-8" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  <span className="text-lg font-bold">{currentUser.company}</span>
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">Global Fleet Intelligence</span>
                  </h1>
                  <p className="text-[11px] text-slate-400 dark:text-white/20 mt-0.5 tracking-wide">Real-time vessel tracking, valuation & market data</p>
                </div>
              )}
            </div>
            {market && (
              <div className="hidden md:flex items-center gap-2">
                <Badge className="bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/20 text-[10px] font-mono">BDI {market.bdi.toLocaleString()}</Badge>
                <Badge className="bg-slate-200 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-300 dark:border-white/[0.04] text-[10px]">{market.date}</Badge>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Vessels Tracked", value: animTotal.toLocaleString(), sub: "worldwide fleet coverage", icon: "M", gradient: "from-sky-500 to-blue-600", glow: "shadow-sky-500/20" },
              { label: "With Photography", value: animPhotos.toLocaleString(), sub: `${stats.total > 0 ? Math.round(stats.withImage/stats.total*100) : 0}% identified`, icon: "P", gradient: "from-violet-500 to-purple-600", glow: "shadow-violet-500/20" },
              { label: "AIS Tracking", value: animGps.toLocaleString(), sub: "live positions", icon: "A", gradient: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/20" },
              { label: "Total Deadweight", value: `${animDwt}M`, sub: "metric tonnes", icon: "T", gradient: "from-amber-500 to-orange-600", glow: "shadow-amber-500/20" },
            ].map(s => (
              <div key={s.label} className="group relative overflow-hidden rounded-xl bg-slate-200/60 dark:bg-white/[0.03] border border-slate-300/80 dark:border-white/[0.05] p-4 backdrop-blur-sm hover:border-slate-300 dark:hover:border-white/[0.08] transition-all duration-300">
                {/* Subtle corner glow */}
                <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${s.gradient} rounded-full opacity-[0.07] group-hover:opacity-[0.12] blur-2xl transition-opacity duration-500`} />

                <div className="relative">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 dark:text-white/25 font-medium">{s.label}</p>
                  <p className={`text-3xl font-bold tracking-tight mt-1.5 bg-gradient-to-r ${s.gradient} bg-clip-text text-transparent`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/15 mt-1">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charter Rate Mini Cards */}
          {market && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
              {[
                { label: "Capesize", rate: market.charterRates.capesize },
                { label: "Panamax", rate: market.charterRates.panamax },
                { label: "Supramax", rate: market.charterRates.supramax },
                { label: "Handysize", rate: market.charterRates.handysize },
              ].map(c => (
                <div key={c.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-200/40 dark:bg-white/[0.02] border border-slate-300/60 dark:border-white/[0.03]">
                  <span className="text-[10px] text-slate-400 dark:text-white/20 uppercase tracking-wider">{c.label}</span>
                  <span className="text-xs font-mono font-semibold text-slate-600 dark:text-white/50">${c.rate?.toLocaleString()}<span className="text-[9px] text-slate-400 dark:text-white/15">/day</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SEARCH + FILTERS ═══ */}
      <div className="max-w-[95%] mx-auto px-4 pt-5">
        <div className="flex gap-2 flex-wrap mb-2">
          <div className="relative flex-1 min-w-[240px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search ships, IMO, operator..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off"
              className={`${inputCls} w-full !pl-10`} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputCls}>
            <option value="">All Types</option>
            {SHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} className={`${inputCls} max-w-[170px]`}>
            <option value="">All Flags</option>
            {flags.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={inputCls}>
            <option value="name">Name</option>
            <option value="dwt">DWT</option>
            <option value="year">Year</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`${inputCls} cursor-pointer flex items-center gap-2 ${showFilters ? "!bg-sky-500 !text-white !border-sky-500" : ""}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filters
            {activeFilterCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">{activeFilterCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-2 flex-wrap mb-3 p-3 rounded-xl bg-slate-300/50 dark:bg-white/[0.03] border border-slate-300/80 dark:border-white/[0.04] backdrop-blur-sm">
            <select value={ageRange} onChange={e => setAgeRange(Number(e.target.value))} className={inputCls}>
              {AGE_RANGES.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
            </select>
            <select value={dwtRange} onChange={e => setDwtRange(Number(e.target.value))} className={inputCls}>
              {DWT_RANGES.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className={`${inputCls} min-w-[180px]`}>
              <option value="">All Operators</option>
              {operators.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={() => { setAgeRange(0); setDwtRange(0); setStatusFilter(""); setOperatorFilter(""); setTypeFilter(""); setFlagFilter(""); }}
                className="px-3 py-2 text-sm text-red-400 border border-red-400/30 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer">
                Clear All
              </button>
            )}
          </div>
        )}

        {/* Quick operator chips */}
        <div className="flex gap-1.5 flex-wrap items-center mb-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/20 font-medium mr-1">Quick</span>
          {[["Arklow","Arklow Shipping"],["Oldendorff","Oldendorff Carriers"],["Maersk","Maersk"],["MSC","MSC"],["CMA CGM","CMA CGM"],["Hapag-Lloyd","Hapag-Lloyd"],["Evergreen","Evergreen"]].map(([label, q]) => (
            <button key={q} onClick={() => { setOperatorFilter(operatorFilter === q ? "" : q); setSearch(""); setPage(1); }}
              className={`px-3 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                operatorFilter === q
                  ? "bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/20"
                  : "bg-slate-200/50 dark:bg-white/[0.03] border-slate-300 dark:border-white/[0.06] text-slate-500 dark:text-white/40 hover:border-sky-500/30 hover:text-sky-500"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400 dark:text-white/30">
            {loading ? <span className="animate-pulse">Loading...</span> : <>{total.toLocaleString()} vessels &middot; Page {page} of {totalPages.toLocaleString()}</>}
          </p>
        </div>

        {/* ═══ SHIP GRID ═══ */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-300 dark:border-white/[0.04] overflow-hidden">
                <div className="h-44 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-white/[0.03] dark:via-white/[0.06] dark:to-white/[0.03] animate-shimmer bg-[length:200%_100%]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded-full w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-white/[0.04] rounded-full w-1/2" />
                  <div className="flex gap-2">
                    <div className="h-5 bg-slate-200 dark:bg-white/[0.04] rounded-full w-16" />
                    <div className="h-5 bg-slate-200 dark:bg-white/[0.04] rounded-full w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : ships.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-200 dark:bg-white/[0.03] mb-4">
              <span className="text-3xl opacity-40">&#9875;</span>
            </div>
            <p className="text-sm text-slate-400 dark:text-white/30">No vessels found</p>
            <p className="text-xs text-slate-300 dark:text-white/15 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ships.map(ship => {
              const val = fmtVal(ship.estimatedValue);
              return (
                <a key={ship.imo} href={`/schiff/${ship.imo}`}
                  className="group block rounded-xl border border-slate-300/80 dark:border-white/[0.04] overflow-hidden bg-slate-200/60 dark:bg-white/[0.02] backdrop-blur-sm hover:border-sky-500/30 dark:hover:border-sky-400/20 hover:shadow-2xl hover:shadow-sky-500/[0.08] hover:-translate-y-0.5 transition-all duration-300">

                  {ship.imageUrl ? (
                    <div className="relative h-44 overflow-hidden bg-slate-200 dark:bg-white/[0.02]">
                      <img src={ship.imageUrl} alt={ship.name}
                        className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                      {/* Live badge */}
                      {ship.lat && (
                        <div className="absolute top-3 right-3">
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-md rounded-full text-[10px] text-white font-semibold shadow-lg shadow-emerald-500/30">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>
                            LIVE
                          </span>
                        </div>
                      )}

                      {/* Value badge */}
                      {val && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-[10px] text-white/80 font-mono">{val}</span>
                        </div>
                      )}

                      {/* Ship name overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-bold text-sm truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">{ship.name}</p>
                        <p className="text-white/50 text-[10px] font-mono">IMO {ship.imo}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-28 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-white/[0.03] dark:via-white/[0.015] dark:to-white/[0.03] flex items-center justify-center">
                      <span className="text-4xl opacity-[0.08] group-hover:opacity-[0.15] transition-opacity duration-500">&#9875;</span>
                      {ship.lat && (
                        <div className="absolute top-3 right-3">
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-md rounded-full text-[10px] text-white font-semibold shadow-lg shadow-emerald-500/30">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>
                            LIVE
                          </span>
                        </div>
                      )}
                      {val && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-white/[0.06] rounded-full text-[10px] text-slate-500 dark:text-white/30 font-mono">{val}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-3.5">
                    {!ship.imageUrl && (
                      <>
                        <p className="font-bold text-sm truncate mb-0.5">{ship.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-white/20 font-mono mb-2">IMO {ship.imo}</p>
                      </>
                    )}

                    <div className="flex gap-1.5 flex-wrap">
                      <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/15 text-[10px] font-medium">{ship.type}</Badge>
                      {ship.dwt > 0 && <Badge className="bg-slate-200 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-300 dark:border-white/[0.04] text-[10px]">{fmtDwt(ship.dwt)} DWT</Badge>}
                      {ship.yearBuilt > 0 && <Badge className="bg-slate-200 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-300 dark:border-white/[0.04] text-[10px]">{ship.yearBuilt}</Badge>}
                      {ship.flag && <Badge className="bg-slate-200 dark:bg-white/[0.04] text-slate-500 dark:text-white/30 border-slate-300 dark:border-white/[0.04] text-[10px]">{ship.flag}</Badge>}
                    </div>

                    {ship.operator && (
                      <p className="text-[10px] text-slate-400 dark:text-white/15 mt-2 truncate">{ship.operator}</p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* ═══ PAGINATION ═══ */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-8 mb-8">
            <button onClick={() => setPage(1)} disabled={page===1}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.06] bg-slate-200/50 dark:bg-white/[0.02] text-slate-500 dark:text-white/40 hover:border-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">&laquo;</button>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.06] bg-slate-200/50 dark:bg-white/[0.02] text-slate-500 dark:text-white/40 hover:border-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">&lsaquo; Prev</button>
            <span className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.06] bg-slate-200/50 dark:bg-white/[0.02] text-slate-500 dark:text-white/40 hover:border-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">Next &rsaquo;</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/[0.06] bg-slate-200/50 dark:bg-white/[0.02] text-slate-500 dark:text-white/40 hover:border-sky-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">&raquo;</button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .animate-gradient-shift {
          animation: gradient-shift 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
