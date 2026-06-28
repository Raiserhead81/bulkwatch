"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface FleetShip {
  imo: string; name: string; type: string; dwt: number; length: number; beam: number;
  draft: number; yearBuilt: number; builder?: string; flag: string; operator?: string;
  imageUrl?: string; status: string; grossTonnage: number; engineType?: string;
  enginePowerKw: number; speedKnots: number; fuelConsumption: number; fuelType?: string;
  crewSize: number; lat?: number; lon?: number;
}
interface OperatorInfo { name: string; country: string; city: string; website: string; email: string; phone: string; fleetSize: number; }
interface FleetStats { count: number; totalDwt: number; avgAge: number; types: Record<string, number>; }

function fmtDwt(d: number) { return d >= 1000 ? `${(d / 1000).toFixed(0)}k` : d > 0 ? d.toLocaleString() : "\u2014"; }

function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("lng") || t.includes("lpg")) return "#a855f7";
  if (t.includes("crude") || t.includes("vlcc") || t.includes("tanker")) return "#f87171";
  if (t.includes("container")) return "#f59e0b";
  if (t.includes("bulk") || t.includes("cape") || t.includes("kamsar") || t.includes("ultra") || t.includes("newcastle")) return "#3b82f6";
  return "#64748b";
}

const NAV = [["Ships", "/"], ["Map", "/karte"], ["Live", "/live"], ["Top Picks", "/top-picks"], ["Compare", "/vergleich"], ["Watchlist", "/watchlist"], ["Newbuilds", "/newbuilds"]];

export default function FleetPage() {
  const params = useParams();
  const operatorSlug = decodeURIComponent(params.operator as string);
  const [ships, setShips] = useState<FleetShip[]>([]);
  const [op, setOp] = useState<OperatorInfo | null>(null);
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("dwt");

  useEffect(() => {
    fetch(`/api/ships/fleet?operator=${encodeURIComponent(operatorSlug)}`)
      .then(r => r.json())
      .then(data => {
        setShips(data.ships || []);
        setOp(data.operator);
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [operatorSlug]);

  const types = [...new Set(ships.map(s => s.type))].sort();
  let filtered = typeFilter ? ships.filter(s => s.type === typeFilter) : ships;
  if (sortBy === "name") filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "year") filtered = [...filtered].sort((a, b) => b.yearBuilt - a.yearBuilt);
  else filtered = [...filtered].sort((a, b) => b.dwt - a.dwt);

  const currentYear = new Date().getFullYear();

  const fleetValue = ships.reduce((sum, s) => {
    const age = s.yearBuilt > 0 ? currentYear - s.yearBuilt : 10;
    const basePricePerDwt = 250;
    const ageFactor = Math.max(0.3, 1 - age * 0.035);
    return sum + s.dwt * basePricePerDwt * ageFactor;
  }, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8" }}>
              {op?.name || operatorSlug} Fleet
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              {op ? `${op.city}, ${op.country}` : "Loading..."}
            </p>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            {NAV.map(([l, h]) => (
              <a key={h} href={h} style={{ color: "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      {op && (
        <div style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "16px 24px" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Contact</div>
              <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
                {op.website && <a href={op.website} target="_blank" rel="noopener" style={{ color: "#38bdf8", textDecoration: "none" }}>{op.website.replace(/^https?:\/\//, "")}</a>}
                {op.email && <span style={{ color: "#e2e8f0" }}>{op.email}</span>}
                {op.phone && <span style={{ color: "#e2e8f0" }}>{op.phone}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              {[
                ["Ships", stats?.count?.toString() || "\u2014"],
                ["Total DWT", stats ? `${(stats.totalDwt / 1_000_000).toFixed(1)}M` : "\u2014"],
                ["Avg Age", stats ? `${stats.avgAge.toFixed(1)} yrs` : "\u2014"],
                ["Est. Fleet Value", `$${(fleetValue / 1_000_000).toFixed(0)}M`],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{l}</div>
                  <div style={{ color: "#38bdf8", fontWeight: 600, fontSize: 18 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <button onClick={() => setTypeFilter("")}
            style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: !typeFilter ? "#2563eb" : "#1e293b", color: !typeFilter ? "#fff" : "#94a3b8" }}>
            All ({ships.length})
          </button>
          {types.map(t => {
            const count = ships.filter(s => s.type === t).length;
            return (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: typeFilter === t ? typeColor(t) : "#1e293b", color: typeFilter === t ? "#fff" : "#94a3b8",
                  borderLeft: `3px solid ${typeColor(t)}` }}>
                {t} ({count})
              </button>
            );
          })}
          <div style={{ marginLeft: "auto" }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: "6px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 13 }}>
              <option value="dwt">Sort by DWT</option>
              <option value="name">Sort by Name</option>
              <option value="year">Sort by Year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading fleet...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>No ships found for this operator.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
            {filtered.map(ship => (
              <a key={ship.imo} href={`/schiff/${ship.imo}`}
                style={{ display: "block", background: "#1e293b", borderRadius: 12, overflow: "hidden",
                  border: "1px solid #1e3a5f", textDecoration: "none", color: "inherit" }}>
                {ship.imageUrl ? (
                  <img src={ship.imageUrl} alt={ship.name} style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={e => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div style={{ width: "100%", height: 80, background: "#0f172a", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 32 }}>&#x1F6A2;</div>
                )}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor(ship.type), flexShrink: 0 }} />
                    <strong style={{ fontSize: 15 }}>{ship.name}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                    {ship.type} &middot; {fmtDwt(ship.dwt)} DWT &middot; IMO {ship.imo}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                    {ship.yearBuilt > 0 && <span>Built {ship.yearBuilt} ({currentYear - ship.yearBuilt} yrs)</span>}
                    {ship.flag && <span>{ship.flag}</span>}
                    {ship.grossTonnage > 0 && <span>GT {ship.grossTonnage.toLocaleString()}</span>}
                    {ship.crewSize > 0 && <span>Crew {ship.crewSize}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap", marginTop: 4 }}>
                    {ship.engineType && <span>Engine: {ship.engineType}</span>}
                    {ship.fuelConsumption > 0 && <span>Fuel: {ship.fuelConsumption} t/d</span>}
                    {ship.speedKnots > 0 && <span>Speed: {ship.speedKnots} kn</span>}
                  </div>
                  {ship.lat && (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ padding: "2px 8px", background: "#052e16", borderRadius: 4, fontSize: 11, color: "#4ade80" }}>Live Position</span>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
