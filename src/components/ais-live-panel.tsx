"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, Ship as ShipIcon, RefreshCw, Radio, Zap, Search } from "lucide-react";
import { SHIPS } from "@/data/ships";

interface AISShip {
  mmsi: string;
  imo?: string;
  name?: string;
  shipName?: string;
  lat: number;
  lon: number;
  sog?: number;
  cog?: number;
  heading?: number;
  navStatus?: number;
  shipType?: number;
  destination?: string;
  eta?: string;
  timestamp: number;
}

interface AISStats {
  totalShips: number;
  activeShips: number;
  lastMessage: number;
  uptime: number;
  wsConnected: boolean;
}

export default function AISLivePanel() {
  const [ships, setShips] = useState<AISShip[]>([]);
  const [stats, setStats] = useState<AISStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [operatorSearch, setOperatorSearch] = useState("");
  const shipByImo = new Map(SHIPS.map((s) => [s.imo, s]));

  const fetchData = async () => {
    try {
      const [shipsRes, statsRes] = await Promise.all([
        fetch("/api/ais", { signal: AbortSignal.timeout(8000) }),
        fetch("/api/ais/stats", { signal: AbortSignal.timeout(5000) }),
      ]);
      if (shipsRes.ok) {
        const data = await shipsRes.json();
        setShips(data.ships || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error("AIS fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 30000); // 30s
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  const formatTime = (ts: number) => {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleTimeString("en-US");
  };

  const formatSpeed = (sog?: number) => {
    if (sog === undefined || sog === null) return "—";
    return `${sog.toFixed(1)} kn`;
  };

  const navStatusText = (status?: number) => {
    const statuses = [
      "Under Way (Engine)",
      "At Anchor",
      "Not Under Command",
      "Restricted Maneuverability",
      "Constrained by Draft",
      "Moored",
      "Aground",
      "Engaged in Fishing",
      "Under way sailing",
      "Reserved",
      "Reserved",
      "Power-driven vessel towing",
      "Power-driven vessel pushing",
      "Reserved",
      "Reserved",
      "Undefined",
    ];
    return status !== undefined ? statuses[status] || `Status ${status}` : "—";
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/5 border border-cyan-500/20 p-6">
        <div className="flex items-center gap-2 text-cyan-300">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading live AIS data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 border border-cyan-500/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-cyan-500/20 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="h-5 w-5 text-cyan-400" />
            {stats?.wsConnected && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              Live AIS Stream
              <span className="text-[10px] font-mono uppercase text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                {stats?.wsConnected ? "CONNECTED" : "OFFLINE"}
              </span>
            </h3>
            <p className="text-[10px] text-cyan-300/70 font-mono">
              AISStream.io · WebSocket · {ships.length} ships cached
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-cyan-400/60" />
            <input
              type="text"
              placeholder="Operator filter..."
              value={operatorSearch}
              onChange={(e) => setOperatorSearch(e.target.value)}
              className="pl-6 pr-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs placeholder:text-cyan-300/40 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-36"
            />
          </div>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-colors ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            <Activity className={`h-3 w-3 ${autoRefresh ? "animate-pulse" : ""}`} />
            {autoRefresh ? "Auto 30s" : "Manual"}
          </button>
          <button
            type="button"
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900/40">
          <StatCard label="Active Ships" value={stats.activeShips} icon="🚢" />
          <StatCard label="Total Cache" value={stats.totalShips} icon="📡" />
          <StatCard label="Last Message" value={formatTime(stats.lastMessage)} icon="⏱️" />
          <StatCard label="Uptime" value={`${Math.floor(stats.uptime / 60)} min`} icon="⚡" />
        </div>
      )}

      {/* Ships table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-900/60 text-cyan-300/80 uppercase tracking-wider font-mono">
            <tr>
              <th className="text-left py-2 px-3">Ship</th>
              <th className="text-left py-2 px-3 hidden sm:table-cell">MMSI / IMO</th>
              <th className="text-left py-2 px-3">Position</th>
              <th className="text-left py-2 px-3 hidden md:table-cell">Speed</th>
              <th className="text-left py-2 px-3 hidden lg:table-cell">Course</th>
              <th className="text-left py-2 px-3 hidden lg:table-cell">Status</th>
              <th className="text-left py-2 px-3 hidden sm:table-cell">Destination</th>
              <th className="text-left py-2 px-3 hidden xl:table-cell">Operator</th>
            </tr>
          </thead>
          <tbody>
            {ships.filter(ship => {
              if (!operatorSearch.trim()) return true;
              const op = operatorSearch.toLowerCase();
              const dbShip = ship.imo ? shipByImo.get(ship.imo) : undefined;
              const operator = dbShip?.operator || "";
              return operator.toLowerCase().includes(op) || (ship.name || "").toLowerCase().includes(op);
            }).slice(0, 100).map((ship, i) => (
              <tr
                key={ship.mmsi}
                className={`border-b border-white/5 hover:bg-cyan-500/5 transition-colors ${
                  i % 2 === 0 ? "bg-white/[0.02]" : ""
                }`}
              >
                <td className="py-1.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <ShipIcon className="h-3 w-3 text-cyan-400 flex-shrink-0" />
                    <span className="font-medium text-white truncate max-w-[120px]">
                      {ship.name || ship.shipName || "Unknown"}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-3 hidden sm:table-cell font-mono text-white/60">
                  <div>MMSI: {ship.mmsi}</div>
                  {ship.imo && <div>IMO: {ship.imo}</div>}
                </td>
                <td className="py-1.5 px-3 font-mono text-white/70">
                  {ship.lat.toFixed(4)}, {ship.lon.toFixed(4)}
                </td>
                <td className="py-1.5 px-3 hidden md:table-cell text-cyan-300/80">
                  {formatSpeed(ship.sog)}
                </td>
                <td className="py-1.5 px-3 hidden lg:table-cell text-white/60">
                  {ship.cog !== undefined ? `${ship.cog.toFixed(0)}°` : "—"}
                </td>
                <td className="py-1.5 px-3 hidden lg:table-cell text-white/60 text-[10px]">
                  {navStatusText(ship.navStatus)}
                </td>
                <td className="py-1.5 px-3 hidden sm:table-cell text-white/60 truncate max-w-[100px]">
                  {ship.destination || "—"}
                </td>
                <td className="py-1.5 px-3 hidden xl:table-cell text-cyan-300/70 truncate max-w-[120px]">
                  {(ship.imo ? shipByImo.get(ship.imo)?.operator : undefined) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-cyan-500/20 text-[10px] text-cyan-300/60 font-mono flex items-center justify-between">
        <span>Showing {Math.min(ships.length, 100)} of {ships.length} ships · Last update: {lastUpdate?.toLocaleTimeString("en-US") || "—"}</span>
        <span className="flex items-center gap-1">
          <Zap className="h-2.5 w-2.5 text-emerald-400" />
          Real-time data
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 border border-cyan-500/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-cyan-300/60 font-mono mb-1">
        {icon} {label}
      </div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}
