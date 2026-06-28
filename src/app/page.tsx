"use client";

import { useState, useEffect, useCallback } from "react";

const SHIP_TYPES = [
  "Capesize","Newcastlemax","VLOC","Kamsarmax","Panamax","Ultramax","Supramax",
  "Handymax","Handysize","Mini-Bulker","Geared","Gearless",
  "General Cargo","Container Ship","Tanker","Crude Oil Tanker","Product Tanker",
  "Chemical Tanker","LNG Tanker","LPG Tanker","RoRo","Car Carrier",
  "Ferry","Passenger","Offshore","Tug","Other"
];

interface Ship {
  id: string; imo: string; name: string; type: string;
  dwt: number; yearBuilt: number; flag: string;
  operator?: string; imageUrl?: string; status: string;
  lat?: number; lon?: number;
}

interface Stats { total: number; withImage: number; withPosition: number; totalDwt: number; }

const LIMIT = 24;

export default function Home() {
  const [ships, setShips] = useState<Ship[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, withImage: 0, withPosition: 0, totalDwt: 0 });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [flagFilter, setFlagFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/ships/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
    fetch("/api/ships/flags").then(r => r.ok ? r.json() : null).then(d => { if (d?.flags) setFlags(d.flags.slice(0, 100)); }).catch(() => {});
  }, []);

  const fetchShips = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), sort: sortBy });
    if (search) p.set("search", search);
    if (typeFilter) p.set("type", typeFilter);
    if (flagFilter) p.set("flag", flagFilter);
    fetch(`/api/ships?${p}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setShips(d.ships || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 0); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, search, typeFilter, flagFilter, sortBy]);

  useEffect(() => { const t = setTimeout(fetchShips, search ? 300 : 0); return () => clearTimeout(t); }, [fetchShips]);
  useEffect(() => { setPage(1); }, [search, typeFilter, flagFilter, sortBy]);

  const fmtDwt = (d: number) => d > 0 ? `${(d/1000).toFixed(0)}k DWT` : "";
  const fmtM = (n: number) => (n/1e6).toFixed(1);
  const inp = { padding: "10px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14 } as const;

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8" }}>⚓ Vessel Database</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
              Intelligence for <strong style={{ color: "#e2e8f0" }}>{stats.total.toLocaleString()}</strong> ships worldwide
            </p>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            {[["Ships","/"],["Map","/karte"],["Live","/live"],["Top Picks","/top-picks"],["Compare","/vergleich"],["Watchlist","/watchlist"],["Newbuilds","/newbuilds"],["Voyage Calc","/voyage-calc"]].map(([l,h]) => (
              <a key={h} href={h} style={{ color: h==="/" ? "#38bdf8" : "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "12px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 32, fontSize: 13 }}>
          {[["Total Ships", stats.total.toLocaleString()],["Photos", stats.withImage.toLocaleString()],["GPS", stats.withPosition.toLocaleString()],["DWT", `${fmtM(stats.totalDwt)} M`]].map(([l,v]) => (
            <div key={l}><div style={{ color: "#64748b" }}>{l}</div><div style={{ color: "#38bdf8", fontWeight: 600, fontSize: 16 }}>{v}</div></div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <input type="text" placeholder="Search ships, IMO, operator..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 1, minWidth: 200, outline: "none" }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inp}>
            <option value="">All Types</option>
            {SHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} style={{ ...inp, maxWidth: 180 }}>
            <option value="">All Flags</option>
            {flags.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inp}>
            <option value="name">Name</option>
            <option value="dwt">DWT</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Quick:</span>
          {[["Oldendorff","Oldendorff"],["Maersk","Maersk"],["MSC","MSC"],["CMA CGM","CMA CGM"],["Hapag-Lloyd","Hapag-Lloyd"],["Evergreen","Evergreen"]].map(([label, q]) => (
            <button key={q} onClick={() => { setSearch(search === q ? "" : q); setPage(1); }}
              style={{ padding: "4px 10px", background: search === q ? "#0ea5e9" : "#1e293b", border: "1px solid " + (search === q ? "#0ea5e9" : "#334155"), borderRadius: 20, color: search === q ? "#fff" : "#94a3b8", fontSize: 12, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, color: "#64748b" }}>
          {loading ? "Loading..." : `${total.toLocaleString()} ships · Page ${page}/${totalPages.toLocaleString()}`}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>Loading ships...</div>
        ) : ships.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: "#64748b" }}>No ships found</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {ships.map(ship => (
              <a key={ship.imo} href={`/schiff/${ship.imo}`} style={{ textDecoration: "none", display: "block", background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                {ship.imageUrl
                  ? <div style={{ height: 160, overflow: "hidden", background: "#0f172a" }}><img src={ship.imageUrl} alt={ship.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
                  : <div style={{ height: 80, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🚢</div>
                }
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "#e2e8f0", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ship.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>IMO {ship.imo}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 7px", background: "#0f172a", borderRadius: 4, fontSize: 11, color: "#38bdf8" }}>{ship.type}</span>
                    {ship.flag && <span style={{ padding: "2px 7px", background: "#0f172a", borderRadius: 4, fontSize: 11, color: "#94a3b8" }}>{ship.flag}</span>}
                    {ship.dwt > 0 && <span style={{ padding: "2px 7px", background: "#0f172a", borderRadius: 4, fontSize: 11, color: "#94a3b8" }}>{fmtDwt(ship.dwt)}</span>}
                    {ship.yearBuilt > 0 && <span style={{ padding: "2px 7px", background: "#0f172a", borderRadius: 4, fontSize: 11, color: "#94a3b8" }}>{ship.yearBuilt}</span>}
                    {ship.lat && <span style={{ padding: "2px 7px", background: "#052e16", borderRadius: 4, fontSize: 11, color: "#4ade80" }}>📍 Live</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 32 }}>
            <button onClick={() => setPage(1)} disabled={page===1} style={{ padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", cursor: "pointer" }}>«</button>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", cursor: "pointer" }}>‹</button>
            <span style={{ padding: "8px 16px", background: "#0ea5e9", borderRadius: 6, fontWeight: 600 }}>{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", cursor: "pointer" }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={{ padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", cursor: "pointer" }}>»</button>
          </div>
        )}
      </div>
    </main>
  );
}
