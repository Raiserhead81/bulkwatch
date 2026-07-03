"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, Database, TrendingUp, Ship, FileText,
  Activity, AlertTriangle, CheckCircle, Clock, BarChart2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface FieldStat { filled: number; pct: number }

interface StatsPayload {
  enrichment: {
    total: number;
    equasisScraped: number;
    equasisPct: number;
    scrapedToday: number;
    scrapedLast7d: number;
    fields: {
      dwt: FieldStat; yearBuilt: FieldStat; classification: FieldStat;
      owner: FieldStat; manager: FieldStat; pAndI: FieldStat;
      mmsi: FieldStat; flagParisMou: FieldStat; inspectionsCount: FieldStat;
      hasScrubber: FieldStat;
    };
    daily: Array<{ date: string; count: number }>;
  };
  valuation: {
    shipsValued: number;
    totalFleetValue: number;
    avgConfidence: number;
    spTransactions: number;
    modelAccuracy: {
      meanAbsError: number; medianAbsError: number;
      within10pct: number; within15pct: number; within20pct: number;
      bias: number;
    } | null;
  };
  marketData: {
    lastUpdate: string; bdi: number; bunkerVLSFO: number; bunkerHSFO: number;
    bunkerMGO: number; scrapLDT: number; charterCape: number;
    sources: string[]; bunkerPorts: number;
  };
  pipelines: Array<{
    name: string; lastRun: string | null;
    status: "running" | "ok" | "stale" | "error"; detail: string;
  }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtB(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

// ── useCountUp hook ────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ── ProgressBar ────────────────────────────────────────────────────────────
function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`h-1.5 rounded-full bg-slate-300 dark:bg-white/[0.06] overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "running" | "ok" | "stale" | "error" }) {
  const styles: Record<string, string> = {
    running: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    ok:      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    stale:   "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    error:   "bg-red-500/20 text-red-400 border border-red-500/30",
  };
  const icons: Record<string, React.ReactNode> = {
    running: <Activity className="h-3 w-3 animate-pulse" />,
    ok:      <CheckCircle className="h-3 w-3" />,
    stale:   <Clock className="h-3 w-3" />,
    error:   <AlertTriangle className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]} {status}
    </span>
  );
}

// ── AccuracyIndicator ──────────────────────────────────────────────────────
function AccuracyIndicator({ pct }: { pct: number }) {
  if (pct <= 15) return <span className="text-emerald-400 font-bold">±{pct}%</span>;
  if (pct <= 25) return <span className="text-amber-400 font-bold">±{pct}%</span>;
  return <span className="text-red-400 font-bold">±{pct}%</span>;
}

// ── DailyChart SVG ─────────────────────────────────────────────────────────
function DailyChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data || data.length === 0) {
    return <p className="text-slate-500 text-sm">No enrichment data yet</p>;
  }
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const max = Math.max(...sorted.map(d => d.count), 1);
  const W = 400;
  const H = 120;
  const pad = 8;
  const barW = Math.floor((W - pad * 2) / sorted.length) - 2;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full text-xs" style={{ minWidth: "280px" }}>
        {sorted.map((d, i) => {
          const barH = Math.max(2, Math.round(((d.count / max) * (H - pad))));
          const x = pad + i * (barW + 2);
          const y = H - barH;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barW} height={barH}
                className="fill-sky-500 hover:fill-sky-400 transition-colors"
                rx="2"
              >
                <title>{d.date}: {d.count.toLocaleString()} ships</title>
              </rect>
              {i % 2 === 0 && (
                <text x={x + barW / 2} y={H + 14} textAnchor="middle"
                  className="fill-slate-400" fontSize="8">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Overview Card ──────────────────────────────────────────────────────────
function OverviewCard({
  icon, label, value, sub, glowColor, textGradient, children,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  glowColor: string;
  textGradient: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-slate-300/60 dark:bg-white/[0.03] backdrop-blur-sm border border-slate-400/50 dark:border-white/[0.05] rounded-2xl p-5 space-y-3">
      {/* Corner glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${glowColor} rounded-full opacity-[0.07] blur-2xl pointer-events-none`} />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold bg-gradient-to-r ${textGradient} bg-clip-text text-transparent tabular-nums`}>
        {value}
      </div>
      <div className="text-xs text-slate-600 dark:text-white/30">{sub}</div>
      {children}
    </div>
  );
}

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-3">
      {icon} {children}
    </h2>
  );
}

// ── Premium card wrapper ───────────────────────────────────────────────────
function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-slate-300/60 dark:bg-white/[0.03] backdrop-blur-sm border border-slate-400/50 dark:border-white/[0.05] rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

function CardInner({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meData.user || meData.user.role !== "admin") {
        router.replace("/");
        return;
      }

      const res = await fetch("/api/admin/stats");
      if (res.status === 403) { router.replace("/"); return; }
      if (!res.ok) throw new Error("Failed to load stats");
      const data: StatsPayload = await res.json();
      setStats(data);
      setLastRefresh(new Date());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const fieldLabels: Record<string, string> = {
    dwt: "DWT", yearBuilt: "Year Built", classification: "Classification",
    owner: "Owner", manager: "Manager", pAndI: "P&I Club",
    mmsi: "MMSI", flagParisMou: "Flag / Paris MOU", inspectionsCount: "Inspections",
    hasScrubber: "Scrubber Data",
  };

  // Animated counters — only run once data is available
  const equasisScraped = useCountUp(stats?.enrichment.equasisScraped ?? 0);
  const totalFleetRaw = stats?.valuation.totalFleetValue ?? 0;
  const spTransactions = useCountUp(stats?.valuation.spTransactions ?? 0);
  const shipsValued = useCountUp(stats?.valuation.shipsValued ?? 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-300 via-slate-300 to-slate-200 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 dark:text-white/30">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading intelligence dashboard…</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-300 via-slate-300 to-slate-200 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-red-400 font-medium text-sm">{error || "Failed to load"}</p>
          <button onClick={load} className="text-sm text-sky-400 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const { enrichment, valuation, marketData, pipelines } = stats;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-300 via-slate-300 to-slate-200 dark:from-[#060610] dark:via-[#0a0a18] dark:to-[#0f0f1a] text-slate-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Page Title ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <BarChart2 className="h-5 w-5 text-sky-500" />
              <h1 className="text-xl font-bold tracking-tight">Data Intelligence</h1>
            </div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium">
              Admin Dashboard · Auto-refreshes every 60 s
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500 dark:text-white/30 hidden sm:block">
                {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); load(); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/30 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* ── Section 1: Overview Bar ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ships Enriched */}
          <OverviewCard
            icon={<Database className="h-3.5 w-3.5" />}
            label="Ships Enriched"
            value={<>{equasisScraped.toLocaleString()} <span className="text-base font-normal text-slate-500 dark:text-white/25">/ {enrichment.total.toLocaleString()}</span></>}
            sub={<>Equasis coverage <span className={enrichment.equasisPct >= 80 ? "text-emerald-500" : enrichment.equasisPct >= 50 ? "text-amber-500" : "text-red-400"}>{enrichment.equasisPct}%</span></>}
            glowColor="from-sky-400 to-blue-600"
            textGradient="from-sky-500 to-blue-600"
          >
            <ProgressBar pct={enrichment.equasisPct} />
          </OverviewCard>

          {/* Fleet Value */}
          <OverviewCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Fleet Value"
            value={fmtB(totalFleetRaw)}
            sub={<>{shipsValued.toLocaleString()} ships valued · avg confidence {valuation.avgConfidence}%</>}
            glowColor="from-emerald-400 to-green-600"
            textGradient="from-emerald-500 to-green-600"
          />

          {/* Model Accuracy */}
          <OverviewCard
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Model Accuracy"
            value={
              valuation.modelAccuracy
                ? <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">±{valuation.modelAccuracy.medianAbsError}%</span>
                : <span className="text-slate-500 dark:text-white/25 text-xl">—</span>
            }
            sub={valuation.modelAccuracy ? "median error vs real deals" : "Not enough S&P data yet"}
            glowColor="from-amber-400 to-orange-500"
            textGradient="from-amber-500 to-orange-500"
          />

          {/* S&P Deals */}
          <OverviewCard
            icon={<FileText className="h-3.5 w-3.5" />}
            label="S&P Deals"
            value={spTransactions.toLocaleString()}
            sub={<>{enrichment.scrapedToday} ships scraped today</>}
            glowColor="from-purple-400 to-violet-600"
            textGradient="from-purple-500 to-violet-600"
          />
        </div>

        {/* ── Section 2: Enrichment Progress ───────────────────────────────── */}
        <div>
          <SectionHeader icon={<Database className="h-3.5 w-3.5" />}>
            Enrichment Progress
          </SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Field completeness */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Field Completeness
                </h3>
                <div className="space-y-3.5">
                  {Object.entries(enrichment.fields).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 dark:text-white/50">{fieldLabels[key] || key}</span>
                        <span className="text-slate-500 dark:text-white/30 tabular-nums">
                          {val.filled.toLocaleString()} <span className="text-slate-300 dark:text-white/15">({val.pct}%)</span>
                        </span>
                      </div>
                      <ProgressBar pct={val.pct} />
                    </div>
                  ))}
                </div>
              </CardInner>
            </Card>

            {/* Daily enrichment chart */}
            <Card>
              <CardInner>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium">
                    Daily Enrichment — last 14 days
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-white/30 tabular-nums">{enrichment.scrapedLast7d.toLocaleString()} in 7d</span>
                </div>
                <DailyChart data={enrichment.daily} />
              </CardInner>
            </Card>
          </div>
        </div>

        {/* ── Section 3: Valuation Quality ─────────────────────────────────── */}
        <div>
          <SectionHeader icon={<TrendingUp className="h-3.5 w-3.5" />}>
            Valuation Quality
          </SectionHeader>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model accuracy metrics */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Model Accuracy — {valuation.spTransactions} reference transactions
                </h3>
                {valuation.modelAccuracy ? (
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["Mean absolute error",   `±${valuation.modelAccuracy.meanAbsError}%`],
                        ["Median absolute error", `±${valuation.modelAccuracy.medianAbsError}%`],
                        ["Within ±10%",           `${valuation.modelAccuracy.within10pct}%`],
                        ["Within ±15%",           `${valuation.modelAccuracy.within15pct}%`],
                        ["Within ±20%",           `${valuation.modelAccuracy.within20pct}%`],
                        ["Valuation bias",        `${valuation.modelAccuracy.bias > 0 ? "+" : ""}${valuation.modelAccuracy.bias}%`],
                      ].map(([label, value], i, arr) => (
                        <tr key={label} className={i < arr.length - 1 ? "border-b border-slate-100 dark:border-white/[0.04]" : ""}>
                          <td className="py-2.5 text-slate-600 dark:text-white/35">{label}</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-800 dark:text-white/80">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-slate-600 dark:text-white/30 text-sm leading-relaxed">
                    Need at least 3 S&amp;P transactions with ship_type, DWT and year_built to calculate accuracy.
                    Currently {valuation.spTransactions} deals collected.
                  </p>
                )}
              </CardInner>
            </Card>

            {/* Benchmark comparison */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Benchmark Comparison
                </h3>
                <div className="space-y-3">
                  {/* Our model */}
                  <div className="flex items-center justify-between rounded-xl bg-sky-50 dark:bg-white/[0.04] border border-sky-100/80 dark:border-white/[0.06] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white/80">Our Model</p>
                      <p className="text-xs text-slate-500 dark:text-white/30">Hedonic pricing v4</p>
                    </div>
                    <div className="text-right">
                      {valuation.modelAccuracy ? (
                        <AccuracyIndicator pct={valuation.modelAccuracy.medianAbsError} />
                      ) : (
                        <span className="text-slate-500 dark:text-white/25 text-sm">—</span>
                      )}
                    </div>
                  </div>
                  {/* VesselsValue */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100/80 dark:border-white/[0.04] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-white/60">VesselsValue</p>
                      <p className="text-xs text-slate-500 dark:text-white/25">Industry benchmark</p>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm">±10%</span>
                  </div>
                  {/* Clarksons */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100/80 dark:border-white/[0.04] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-white/60">Clarksons SIN</p>
                      <p className="text-xs text-slate-500 dark:text-white/25">Broker quality</p>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm">±5–8%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-white/20 pt-1 leading-relaxed">
                    Target: within ±15% of VesselsValue. Green = achieved, amber = close, red = needs work.
                  </p>
                </div>
              </CardInner>
            </Card>
          </div>
        </div>

        {/* ── Section 4: Data Pipelines ─────────────────────────────────────── */}
        <div>
          <SectionHeader icon={<Activity className="h-3.5 w-3.5" />}>
            Data Pipelines
          </SectionHeader>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.05]">
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium">Pipeline</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium hidden sm:table-cell">Last Run</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium hidden md:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p, i) => (
                  <tr
                    key={p.name}
                    className={[
                      "transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                      i % 2 === 1 ? "bg-slate-50/50 dark:bg-white/[0.01]" : "",
                      i < pipelines.length - 1 ? "border-b border-slate-100 dark:border-white/[0.04]" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-white/75">{p.name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-white/30 text-xs hidden sm:table-cell tabular-nums">{fmtDate(p.lastRun)}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-slate-500 dark:text-white/30 text-xs hidden md:table-cell">{p.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* ── Section 5: Market Data ────────────────────────────────────────── */}
        <div>
          <SectionHeader icon={<Ship className="h-3.5 w-3.5" />}>
            Market Data
            {marketData.lastUpdate && (
              <span className="text-[10px] font-normal text-slate-500 dark:text-white/20 ml-1 normal-case tracking-normal">
                as of {marketData.lastUpdate}
              </span>
            )}
          </SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Freight & Scrap */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Freight &amp; Scrap
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Baltic Dry Index",  marketData.bdi.toLocaleString()],
                      ["Scrap LDT",         `$${marketData.scrapLDT}/LDT`],
                      ["Capesize T/C",      `$${marketData.charterCape.toLocaleString()}/d`],
                    ].map(([label, value], i, arr) => (
                      <tr key={label} className={i < arr.length - 1 ? "border-b border-slate-100 dark:border-white/[0.04]" : ""}>
                        <td className="py-2.5 text-slate-600 dark:text-white/35">{label}</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-white/75">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardInner>
            </Card>

            {/* Bunker prices */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Bunker Prices (Singapore) · {marketData.bunkerPorts} ports
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["VLSFO", `$${marketData.bunkerVLSFO}/t`],
                      ["HSFO",  `$${marketData.bunkerHSFO}/t`],
                      ["MGO",   `$${marketData.bunkerMGO}/t`],
                    ].map(([label, value], i, arr) => (
                      <tr key={label} className={i < arr.length - 1 ? "border-b border-slate-100 dark:border-white/[0.04]" : ""}>
                        <td className="py-2.5 text-slate-600 dark:text-white/35">{label}</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-slate-800 dark:text-white/75">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardInner>
            </Card>

            {/* Data Sources */}
            <Card>
              <CardInner>
                <h3 className="text-[10px] uppercase tracking-[0.15em] text-slate-500 dark:text-white/25 font-medium mb-4">
                  Data Sources
                </h3>
                {marketData.sources.length > 0 ? (
                  <ul className="space-y-2">
                    {marketData.sources.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/50">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 dark:text-white/25 text-xs">No sources listed in opex_rates.json</p>
                )}
              </CardInner>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] uppercase tracking-[0.15em] text-slate-300 dark:text-white/15 font-medium pb-4">
          Auto-refreshes every 60 seconds · Admin only
        </div>
      </div>
    </div>
  );
}
