"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Hammer, Ship, Calendar, Building2, Flag, Anchor, MapPin } from "lucide-react";

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

const NAV_LINKS: [string,string][] = [["Ships","/"],["Map","/karte"],["Live","/live"],["Top Picks","/top-picks"],["Compare","/vergleich"],["Watchlist","/watchlist"],["Newbuilds","/newbuilds"],["Voyage Calc","/voyage-calc"],["Valuation","/valuation"],["AI Chat","/chat"]];

function fmtDwt(dwt: number): string {
  if (dwt >= 1000) return `${(dwt / 1000).toFixed(0)}k`;
  return dwt > 0 ? dwt.toLocaleString() : "—";
}

function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("lng") || t.includes("lpg")) return "#a855f7";
  if (t.includes("crude") || t.includes("vlcc") || t.includes("tanker")) return "#f87171";
  if (t.includes("container") || t.includes("ulcv") || t.includes("panamax") && t.includes("neo")) return "#f59e0b";
  if (t.includes("bulk") || t.includes("capesize") || t.includes("kamsarmax") || t.includes("newcastle") || t.includes("ultramax")) return "#3b82f6";
  if (t.includes("cruise") || t.includes("passenger") || t.includes("ferry")) return "#ec4899";
  if (t.includes("car carrier") || t.includes("roro")) return "#06b6d4";
  if (t.includes("offshore")) return "#a3a3a3";
  if (t.includes("reefer")) return "#84cc16";
  if (t.includes("cargo")) return "#10b981";
  return "#64748b";
}

export default function NewbuildsPage() {
  const [ships, setShips] = useState<NewbuildShip[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/ships?status=under_construction&limit=200&sort=year")
      .then(r => r.json())
      .then(data => { setShips(data.ships || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const types = [...new Set(ships.map(s => s.type))].sort();
  const filtered = typeFilter ? ships.filter(s => s.type === typeFilter) : ships;

  const groups: Record<string, NewbuildShip[]> = {};
  for (const s of filtered) {
    const key = s.deliveryDate || `${s.yearBuilt}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const sortedKeys = Object.keys(groups).sort();

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {/* Mobile menu */}
      <div className={`mobile-nav-overlay${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-nav-panel${menuOpen ? " open" : ""}`}>
        <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>&#x2715;</button>
        {NAV_LINKS.map(([l,h]) => (
          <a key={h} href={h} className={h==="/newbuilds" ? "active" : ""}>{l}</a>
        ))}
      </div>

      <div className="page-header" style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "16px 24px" }}>
        <div style={{ maxWidth: "95%", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8", display: "flex", alignItems: "center", gap: 10 }}>
              <Hammer style={{ width: 24, height: 24 }} /> Newbuilds
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              <strong style={{ color: "#e2e8f0" }}>{ships.length}</strong> ships under construction
            </p>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)}>&#9776;</button>
          <nav className="nav-links">
            {NAV_LINKS.map(([l,h]) => (
              <a key={h} href={h} style={{ color: h==="/newbuilds" ? "#38bdf8" : "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "12px 24px" }}>
        <div className="stats-bar" style={{ maxWidth: "95%", margin: "0 auto", display: "flex", gap: 32, fontSize: 13 }}>
          {[
            ["Total Orders", ships.length.toString()],
            ["Types", types.length.toString()],
            ["Total DWT", `${(ships.reduce((a, s) => a + s.dwt, 0) / 1_000_000).toFixed(1)}M`],
            ["Delivery 2026", ships.filter(s => s.deliveryDate?.startsWith("2026")).length.toString()],
            ["Delivery 2027", ships.filter(s => s.deliveryDate?.startsWith("2027")).length.toString()],
          ].map(([l, v]) => (
            <div key={l}>
              <div style={{ color: "#64748b" }}>{l}</div>
              <div className="stat-value" style={{ color: "#38bdf8", fontWeight: 600, fontSize: 16 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: "95%", margin: "0 auto", padding: "16px 24px" }}>
        <div className="newbuild-filter-bar" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => setTypeFilter("")}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: !typeFilter ? "#2563eb" : "#1e293b", color: !typeFilter ? "#fff" : "#94a3b8",
            }}
          >All ({ships.length})</button>
          {types.map(t => {
            const count = ships.filter(s => s.type === t).length;
            return (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: typeFilter === t ? typeColor(t) : "#1e293b", color: typeFilter === t ? "#fff" : "#94a3b8",
                  borderLeft: `3px solid ${typeColor(t)}`,
                }}
              >{t} ({count})</button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Loading...</div>
        ) : (
          sortedKeys.map(key => (
            <div key={key} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#38bdf8", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 16, height: 16 }} />
                Delivery {key}
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>({groups[key].length} ships)</span>
              </h2>
              <div className="newbuild-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
                {groups[key].map(ship => (
                  <a key={ship.imo} href={`/schiff/${ship.imo}`}
                    style={{
                      display: "block", background: "#1e293b", borderRadius: 12, overflow: "hidden",
                      border: "1px solid #1e3a5f", textDecoration: "none", color: "inherit",
                    }}
                  >
                    {ship.imageUrl ? (
                      <img src={ship.imageUrl} alt={ship.name}
                        style={{ width: "100%", height: 140, objectFit: "cover" }}
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <div style={{
                        width: "100%", height: 140, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden",
                        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)",
                      }}>
                        <div style={{ position: "relative", textAlign: "center" }}>
                          <div style={{ fontSize: 32, marginBottom: 4 }}>🏗️</div>
                          <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>Under Construction</div>
                        </div>
                      </div>
                    )}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: typeColor(ship.type), flexShrink: 0 }} />
                        <strong style={{ fontSize: 15 }}>{ship.name}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
                        {ship.type} · {fmtDwt(ship.dwt)} DWT · IMO {ship.imo}
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                        {ship.builder && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Hammer style={{ width: 12, height: 12 }} /> {ship.builder}
                          </span>
                        )}
                        {ship.operator && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Building2 style={{ width: 12, height: 12 }} /> {ship.operator}
                          </span>
                        )}
                        {ship.flag && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Flag style={{ width: 12, height: 12 }} /> {ship.flag}
                          </span>
                        )}
                      </div>
                      {(ship.operatorWebsite || ship.operatorEmail || ship.operatorPhone) && (
                        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.12)", fontSize: 11, color: "#94a3b8", display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                          {ship.operatorWebsite && (
                            <a href={ship.operatorWebsite} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>🌐 Website</a>
                          )}
                          {ship.operatorEmail && (
                            <a href={`mailto:${ship.operatorEmail}`} onClick={e => e.stopPropagation()} style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>✉️ {ship.operatorEmail}</a>
                          )}
                          {ship.operatorPhone && (
                            <a href={`tel:${ship.operatorPhone}`} onClick={e => e.stopPropagation()} style={{ color: "#38bdf8", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>📞 {ship.operatorPhone}</a>
                          )}
                          {ship.operatorCity && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>📍 {ship.operatorCity}{ship.operatorCountry ? `, ${ship.operatorCountry}` : ""}</span>
                          )}
                        </div>
                      )}
                      <div style={{
                        marginTop: 8, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: "rgba(251,191,36,0.12)", color: "#fbbf24", display: "inline-block",
                      }}>
                        Under Construction · ETA {ship.deliveryDate || ship.yearBuilt}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
