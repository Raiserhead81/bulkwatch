"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Database, TrendingUp, Ship, FileText,
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

function ProgressBar({ pct, className }: { pct: number; className?: string }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`h-1.5 rounded-full bg-slate-700 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

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

function AccuracyIndicator({ pct }: { pct: number }) {
  if (pct <= 15) return <span className="text-emerald-400 font-bold">±{pct}%</span>;
  if (pct <= 25) return <span className="text-amber-400 font-bold">±{pct}%</span>;
  return <span className="text-red-400 font-bold">±{pct}%</span>;
}

// ── Mini SVG bar chart ────────────────────────────────────────────────────
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
                className="fill-blue-500 hover:fill-blue-400 transition-colors"
                rx="2"
              >
                <title>{d.date}: {d.count.toLocaleString()} ships</title>
              </rect>
              {i % 2 === 0 && (
                <text x={x + barW / 2} y={H + 14} textAnchor="middle"
                  className="fill-slate-500" fontSize="8">
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

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      // Auth check
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading intelligence dashboard…</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-red-400 font-medium">{error || "Failed to load"}</p>
          <button onClick={load} className="text-sm text-blue-400 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  const { enrichment, valuation, marketData, pipelines } = stats;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-blue-500/10 bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-400" /> Data Intelligence
          </h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Refreshed {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => { setLoading(true); load(); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Section 1: Overview Bar ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ships Enriched */}
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
              <Database className="h-4 w-4 text-blue-400" /> Ships Enriched
            </div>
            <div>
              <span className="text-2xl font-bold">{enrichment.equasisScraped.toLocaleString()}</span>
              <span className="text-slate-400 text-sm ml-1">/ {enrichment.total.toLocaleString()}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Equasis coverage</span>
                <span className={enrichment.equasisPct >= 80 ? "text-emerald-400" : enrichment.equasisPct >= 50 ? "text-amber-400" : "text-red-400"}>
                  {enrichment.equasisPct}%
                </span>
              </div>
              <ProgressBar pct={enrichment.equasisPct} />
            </div>
          </div>

          {/* Fleet Value */}
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Fleet Value
            </div>
            <div className="text-2xl font-bold text-emerald-400">{fmtB(valuation.totalFleetValue)}</div>
            <p className="text-xs text-slate-500">
              {valuation.shipsValued.toLocaleString()} ships valued · avg confidence {valuation.avgConfidence}%
            </p>
          </div>

          {/* Model Accuracy */}
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
              <Activity className="h-4 w-4 text-amber-400" /> Model Accuracy
            </div>
            <div className="text-2xl font-bold">
              {valuation.modelAccuracy
                ? <AccuracyIndicator pct={valuation.modelAccuracy.medianAbsError} />
                : <span className="text-slate-500">—</span>}
            </div>
            <p className="text-xs text-slate-500">
              {valuation.modelAccuracy ? "median error vs real deals" : "Not enough S&P data yet"}
            </p>
          </div>

          {/* S&P Deals */}
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
              <FileText className="h-4 w-4 text-purple-400" /> S&amp;P Deals
            </div>
            <div className="text-2xl font-bold text-purple-400">{valuation.spTransactions.toLocaleString()}</div>
            <p className="text-xs text-slate-500">
              Transactions collected · {enrichment.scrapedToday} ships scraped today
            </p>
          </div>
        </div>

        {/* ── Section 2: Enrichment Progress ───────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Database className="h-4 w-4" /> Enrichment Progress
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Field completeness table */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-4">Field Completeness</h3>
              <div className="space-y-3">
                {Object.entries(enrichment.fields).map(([key, val]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{fieldLabels[key] || key}</span>
                      <span className="text-slate-400 tabular-nums">
                        {val.filled.toLocaleString()} <span className="text-slate-600">({val.pct}%)</span>
                      </span>
                    </div>
                    <ProgressBar pct={val.pct} />
                  </div>
                ))}
              </div>
            </div>

            {/* Daily enrichment chart */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-slate-400">Daily Enrichment (last 14 days)</h3>
                <span className="text-xs text-slate-500">{enrichment.scrapedLast7d.toLocaleString()} in 7d</span>
              </div>
              <DailyChart data={enrichment.daily} />
            </div>
          </div>
        </div>

        {/* ── Section 3: Valuation Quality ─────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Valuation Quality
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model accuracy metrics */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-4">
                Model Accuracy — {valuation.spTransactions} reference transactions
              </h3>
              {valuation.modelAccuracy ? (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-800">
                    {[
                      ["Mean absolute error",   `±${valuation.modelAccuracy.meanAbsError}%`],
                      ["Median absolute error", `±${valuation.modelAccuracy.medianAbsError}%`],
                      ["Within ±10%",           `${valuation.modelAccuracy.within10pct}%`],
                      ["Within ±15%",           `${valuation.modelAccuracy.within15pct}%`],
                      ["Within ±20%",           `${valuation.modelAccuracy.within20pct}%`],
                      ["Valuation bias",        `${valuation.modelAccuracy.bias > 0 ? "+" : ""}${valuation.modelAccuracy.bias}%`],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td className="py-2 text-slate-400">{label}</td>
                        <td className="py-2 text-right font-mono font-bold text-slate-200">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-slate-500 text-sm">
                  Need at least 3 S&amp;P transactions with ship_type, DWT and year_built to calculate accuracy.
                  Currently {valuation.spTransactions} deals collected.
                </p>
              )}
            </div>

            {/* Benchmark comparison */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-4">Benchmark Comparison</h3>
              <div className="space-y-4">
                {/* Our model */}
                <div className="flex items-center justify-between rounded-xl bg-slate-800/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Our Model</p>
                    <p className="text-xs text-slate-500">Hedonic pricing v4</p>
                  </div>
                  <div className="text-right">
                    {valuation.modelAccuracy ? (
                      <AccuracyIndicator pct={valuation.modelAccuracy.medianAbsError} />
                    ) : (
                      <span className="text-slate-500 text-sm">—</span>
                    )}
                  </div>
                </div>
                {/* VesselsValue */}
                <div className="flex items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">VesselsValue</p>
                    <p className="text-xs text-slate-500">Industry benchmark</p>
                  </div>
                  <span className="text-emerald-400 font-bold">±10%</span>
                </div>
                {/* Clarksons */}
                <div className="flex items-center justify-between rounded-xl bg-slate-800/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Clarksons SIN</p>
                    <p className="text-xs text-slate-500">Broker quality</p>
                  </div>
                  <span className="text-emerald-400 font-bold">±5–8%</span>
                </div>
                {/* Note */}
                <p className="text-xs text-slate-600 pt-1">
                  Target: within ±15% of VesselsValue. Green = achieved, amber = close, red = needs work.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 4: Data Pipelines ─────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Data Pipelines
          </h2>
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Last Run</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pipelines.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs hidden sm:table-cell tabular-nums">{fmtDate(p.lastRun)}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden md:table-cell">{p.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 5: Market Data ────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Ship className="h-4 w-4" /> Market Data
            {marketData.lastUpdate && (
              <span className="text-xs font-normal text-slate-500 ml-2">as of {marketData.lastUpdate}</span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Indices */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">Freight &amp; Scrap</h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2 text-slate-400">Baltic Dry Index</td>
                    <td className="py-2 text-right font-mono font-bold">{marketData.bdi.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Scrap LDT</td>
                    <td className="py-2 text-right font-mono">${marketData.scrapLDT}/LDT</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">Capesize T/C</td>
                    <td className="py-2 text-right font-mono">${marketData.charterCape.toLocaleString()}/d</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bunker prices */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">
                Bunker Prices (Singapore) · {marketData.bunkerPorts} ports tracked
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2 text-slate-400">VLSFO</td>
                    <td className="py-2 text-right font-mono">${marketData.bunkerVLSFO}/t</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">HSFO</td>
                    <td className="py-2 text-right font-mono">${marketData.bunkerHSFO}/t</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-400">MGO</td>
                    <td className="py-2 text-right font-mono">${marketData.bunkerMGO}/t</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sources */}
            <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-slate-400 mb-3">Data Sources</h3>
              {marketData.sources.length > 0 ? (
                <ul className="space-y-1.5">
                  {marketData.sources.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-xs">No sources listed in opex_rates.json</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-4">
          Auto-refreshes every 60 seconds · Admin only
        </div>
      </div>
    </div>
  );
}
