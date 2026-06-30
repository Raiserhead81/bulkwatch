"use client";

import { useState, useEffect } from "react";

interface Ship {
  imo: string; name: string; type: string; dwt: number; length: number; beam: number;
  draft: number; yearBuilt: number; flag: string; operator?: string; imageUrl?: string;
  grossTonnage: number; engineType?: string; enginePowerKw: number; speedKnots: number;
  fuelConsumption: number; fuelType?: string; crewSize: number;
}

const NAV: [string,string][] = [["Ships","/"],["Map","/karte"],["Live","/live"],["Top Picks","/top-picks"],["Compare","/vergleich"],["Watchlist","/watchlist"],["Newbuilds","/newbuilds"],["Voyage Calc","/voyage-calc"],["AI Chat","/chat"]];

function fmtDwt(d: number) { return d >= 1000 ? `${(d / 1000).toFixed(0)}k` : d > 0 ? d.toLocaleString() : "\u2014"; }

function estimateValue(ship: Ship): number {
  const age = ship.yearBuilt > 0 ? new Date().getFullYear() - ship.yearBuilt : 10;
  const basePricePerDwt = 250;
  const ageFactor = Math.max(0.3, 1 - age * 0.035);
  return ship.dwt * basePricePerDwt * ageFactor;
}

export default function ComparePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const readTheme = () => {
      const saved = localStorage.getItem("vessel-theme") || "dark";
      setTheme(saved as "dark"|"light");
    };
    readTheme();
    const obs = new MutationObserver(() => readTheme());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const [selectedShips, setSelectedShips] = useState<Ship[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Ship[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/ships?search=${encodeURIComponent(search)}&limit=10`)
        .then(r => r.json())
        .then(data => {
          const results = (data.ships || []).map((s: Record<string, unknown>) => ({
            imo: s.imo, name: s.name, type: s.type, dwt: s.dwt || 0, length: s.length || 0,
            beam: s.beam || 0, draft: s.draft || 0, yearBuilt: s.yearBuilt || 0, flag: s.flag || "Unknown",
            operator: s.operator, imageUrl: s.imageUrl, grossTonnage: s.grossTonnage || 0,
            engineType: s.engineType, enginePowerKw: s.enginePowerKw || 0, speedKnots: s.speedKnots || 0,
            fuelConsumption: s.fuelConsumption || 0, fuelType: s.fuelType, crewSize: s.crewSize || 0,
          })).filter((s: Ship) => !selectedShips.find(sel => sel.imo === s.imo));
          setSearchResults(results);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search, selectedShips]);

  // Fetch extended data for a ship (the main API may not return all fields)
  const addShip = (ship: Ship) => {
    if (selectedShips.length >= 5) return;
    // Fetch full ship data from fleet API to get extended specs
    fetch(`/api/ships?search=${encodeURIComponent(ship.imo)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const s = data.ships?.[0];
        if (s) {
          setSelectedShips(prev => [...prev, {
            imo: s.imo, name: s.name, type: s.type, dwt: s.dwt || 0, length: s.length || 0,
            beam: s.beam || 0, draft: s.draft || 0, yearBuilt: s.yearBuilt || 0, flag: s.flag || "Unknown",
            operator: s.operator, imageUrl: s.imageUrl, grossTonnage: s.grossTonnage || 0,
            engineType: s.engineType, enginePowerKw: s.enginePowerKw || 0, speedKnots: s.speedKnots || 0,
            fuelConsumption: s.fuelConsumption || 0, fuelType: s.fuelType, crewSize: s.crewSize || 0,
          }]);
        } else {
          setSelectedShips(prev => [...prev, ship]);
        }
      })
      .catch(() => setSelectedShips(prev => [...prev, ship]));
    setSearch("");
    setSearchResults([]);
  };

  const removeShip = (imo: string) => {
    setSelectedShips(prev => prev.filter(s => s.imo !== imo));
  };

  const isLight = theme === "light";
  const inp: React.CSSProperties = { padding: "10px 14px", background: isLight ? "#ffffff" : "#1e293b", border: `1px solid ${isLight ? "#cbd5e1" : "#334155"}`, borderRadius: 8, color: isLight ? "#1e293b" : "#e2e8f0", fontSize: 14, width: "100%", outline: "none" };
  const box: React.CSSProperties = { background: isLight ? "#ffffff" : "#1e293b", borderRadius: 12, border: `1px solid ${isLight ? "#e2e8f0" : "#1e3a5f"}`, padding: 16 };

  // Best values for highlighting
  const prices = selectedShips.map(s => estimateValue(s));
  const bestDwt = Math.max(...selectedShips.map(s => s.dwt));
  const newestYear = Math.max(...selectedShips.map(s => s.yearBuilt));
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  const specRows: { label: string; getValue: (s: Ship) => string; getBest?: (s: Ship) => boolean }[] = [
    { label: "Type", getValue: s => s.type },
    { label: "DWT", getValue: s => fmtDwt(s.dwt), getBest: s => s.dwt === bestDwt && selectedShips.length > 1 },
    { label: "Year Built", getValue: s => s.yearBuilt > 0 ? String(s.yearBuilt) : "\u2014", getBest: s => s.yearBuilt === newestYear && selectedShips.length > 1 },
    { label: "Length", getValue: s => s.length > 0 ? `${s.length} m` : "\u2014" },
    { label: "Beam", getValue: s => s.beam > 0 ? `${s.beam} m` : "\u2014" },
    { label: "Draft", getValue: s => s.draft > 0 ? `${s.draft} m` : "\u2014" },
    { label: "Flag", getValue: s => s.flag },
    { label: "Gross Tonnage", getValue: s => s.grossTonnage > 0 ? s.grossTonnage.toLocaleString() : "\u2014" },
    { label: "Engine", getValue: s => s.engineType || "\u2014" },
    { label: "Engine Power", getValue: s => s.enginePowerKw > 0 ? `${s.enginePowerKw.toLocaleString()} kW` : "\u2014" },
    { label: "Speed", getValue: s => s.speedKnots > 0 ? `${s.speedKnots} kn` : "\u2014" },
    { label: "Fuel Consumption", getValue: s => s.fuelConsumption > 0 ? `${s.fuelConsumption} t/day` : "\u2014" },
    { label: "Fuel Type", getValue: s => s.fuelType || "\u2014" },
    { label: "Crew", getValue: s => s.crewSize > 0 ? String(s.crewSize) : "\u2014" },
    { label: "Operator", getValue: s => s.operator || "\u2014" },
    { label: "Est. Value", getValue: s => `$${(estimateValue(s) / 1_000_000).toFixed(1)}M` },
    { label: "$/DWT", getValue: s => s.dwt > 0 ? `$${(estimateValue(s) / s.dwt).toFixed(0)}` : "\u2014" },
  ];


  return (
    <div style={{ minHeight: "100vh", background: isLight ? "#f8fafc" : "#0f172a", color: isLight ? "#1e293b" : "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      <div className={`mobile-nav-overlay${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-nav-panel${menuOpen ? " open" : ""}`}>
        <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>&#x2715;</button>
        {NAV.map(([l,h]: [string,string]) => (
          <a key={h} href={h} className={h==="/vergleich" ? "active" : ""}>{l}</a>
        ))}
      </div>

      <div className="page-header" style={{ background: isLight ? "#ffffff" : "#1e293b", borderBottom: `1px solid ${isLight ? "#e2e8f0" : "#1e3a5f"}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8" }}>Compare Vessels</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Side-by-side comparison of up to 5 ships with full specs
            </p>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)}>&#9776;</button>
          <nav className="nav-links">
            {NAV.map(([l, h]) => (
              <a key={h} href={h} style={{ color: h === "/vergleich" ? "#38bdf8" : "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        {/* Search bar */}
        <div style={{ ...box, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: searchResults.length > 0 ? 12 : 0 }}>
            <input type="text" placeholder="Search by ship name or IMO..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1 }} />
            <span style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{selectedShips.length}/5 ships</span>
            {selectedShips.length > 0 && (
              <button onClick={() => setSelectedShips([])}
                style={{ padding: "8px 14px", background: "#7f1d1d", border: "none", borderRadius: 8, color: "#fca5a5", fontSize: 12, cursor: "pointer" }}>
                Clear All
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {searchResults.map(ship => (
                <button key={ship.imo} onClick={() => addShip(ship)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px",
                    background: isLight ? "#f1f5f9" : "#0f172a", border: `1px solid ${isLight ? "#e2e8f0" : "#1e3a5f"}`, borderRadius: 8, color: isLight ? "#1e293b" : "#e2e8f0",
                    cursor: "pointer", textAlign: "left", width: "100%" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ship.name}</span>
                    <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>{ship.type} &middot; IMO {ship.imo} &middot; {fmtDwt(ship.dwt)} DWT</span>
                  </div>
                  <span style={{ color: "#38bdf8", fontSize: 18 }}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedShips.length === 0 ? (
          <div style={{ ...box, textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>&#x2696;</div>
            <p style={{ color: "#64748b", marginBottom: 4 }}>No ships selected yet</p>
            <p style={{ color: "#475569", fontSize: 13 }}>Search above to add ships for comparison</p>
          </div>
        ) : (
          <>
            {/* Ship headers */}
            <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${selectedShips.length}, 1fr)`, gap: 0, marginBottom: 0 }}>
              <div />
              {selectedShips.map(ship => (
                <div key={ship.imo} style={{ ...box, borderRadius: "12px 12px 0 0", borderBottom: "none", textAlign: "center", position: "relative" }}>
                  <button onClick={() => removeShip(ship.imo)}
                    style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%",
                      background: "#7f1d1d", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14, lineHeight: "24px" }}>
                    &times;
                  </button>
                  {ship.imageUrl ? (
                    <img src={ship.imageUrl} alt={ship.name}
                      style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8, marginBottom: 8 }}
                      onError={e => (e.currentTarget.style.display = "none")} />
                  ) : (
                    <div style={{ width: "100%", height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 8 }}>&#x1F6A2;</div>
                  )}
                  <a href={`/schiff/${ship.imo}`} style={{ color: "#e2e8f0", textDecoration: "none" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{ship.name}</div>
                  </a>
                  <div style={{ fontSize: 11, color: "#64748b" }}>IMO {ship.imo}</div>
                </div>
              ))}
            </div>

            {/* Spec rows */}
            <div style={{ border: "1px solid #1e3a5f", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
              {specRows.map((row, i) => (
                <div key={row.label} style={{
                  display: "grid", gridTemplateColumns: `200px repeat(${selectedShips.length}, 1fr)`,
                  background: i % 2 === 0 ? "#1e293b" : "#162032",
                }}>
                  <div style={{ padding: "10px 16px", fontSize: 13, color: "#64748b", fontWeight: 600 }}>{row.label}</div>
                  {selectedShips.map(ship => {
                    const isBest = row.getBest?.(ship);
                    return (
                      <div key={ship.imo} style={{ padding: "10px 16px", fontSize: 13, textAlign: "center",
                        color: isBest ? "#4ade80" : "#e2e8f0", fontWeight: isBest ? 700 : 400 }}>
                        {row.getValue(ship)}
                        {isBest && <span style={{ fontSize: 9, marginLeft: 4, color: "#4ade80" }}>&#9733;</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
