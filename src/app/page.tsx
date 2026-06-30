"use client";

import { useState, useEffect, useCallback } from "react";

const SHIP_TYPES = [
  "Capesize","Newcastlemax","VLOC","Kamsarmax","Panamax","Ultramax","Supramax",
  "Handymax","Handysize","Mini-Bulker","Geared","Gearless",
  "General Cargo","Container Ship","Tanker","Crude Oil Tanker","Product Tanker",
  "Chemical Tanker","LNG Tanker","LPG Tanker","RoRo","Car Carrier",
  "Ferry","Passenger","Offshore","Tug","Other"
];

const AGE_RANGES = [
  { label: "All Ages", min: "", max: "" },
  { label: "0-5 years", min: "0", max: "5" },
  { label: "5-10 years", min: "5", max: "10" },
  { label: "10-15 years", min: "10", max: "15" },
  { label: "15-20 years", min: "15", max: "20" },
  { label: "20+ years", min: "20", max: "" },
];

const DWT_RANGES = [
  { label: "All DWT", min: "", max: "" },
  { label: "Handysize <40k", min: "", max: "40000" },
  { label: "Handymax 40-60k", min: "40000", max: "60000" },
  { label: "Panamax 60-80k", min: "60000", max: "80000" },
  { label: "Capesize 80-200k", min: "80000", max: "200000" },
  { label: "VLOC 200k+", min: "200000", max: "" },
];

const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Under Construction", value: "under_construction" },
  { label: "Scrapped", value: "scrapped" },
  { label: "Lost", value: "lost" },
];

const NAV_LINKS: [string,string][] = [["Ships","/"],["Map","/karte"],["Live","/live"],["Top Picks","/top-picks"],["Compare","/vergleich"],["Watchlist","/watchlist"],["Newbuilds","/newbuilds"],["Voyage Calc","/voyage-calc"],["Valuation","/valuation"],["AI Chat","/chat"]];

interface Ship {
  id: string; imo: string; name: string; type: string;
  dwt: number; yearBuilt: number; flag: string;
  operator?: string; imageUrl?: string; status: string;
  lat?: number; lon?: number;
}

interface Stats { total: number; withImage: number; withPosition: number; totalDwt: number; }

const LIMIT = 24;

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{username:string;company:string;role:string}|null>(null);
  const [ships, setShips] = useState<Ship[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, withImage: 0, withPosition: 0, totalDwt: 0 });
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
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("vessel-theme") || "dark";
    setTheme(saved as "dark"|"light");
    document.documentElement.classList.toggle("light", saved === "light"); document.documentElement.classList.toggle("dark", saved !== "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("vessel-theme", next);
    document.documentElement.classList.toggle("light", next === "light"); document.documentElement.classList.toggle("dark", next !== "light");
  };

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{if(d.user) setCurrentUser(d.user)}).catch(()=>{});
    fetch("/api/ships/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
    fetch("/api/ships/flags").then(r => r.ok ? r.json() : null).then(d => { if (d?.flags) setFlags(d.flags.slice(0, 100)); }).catch(() => {});
    fetch("/api/ships/operators").then(r => r.ok ? r.json() : null).then(d => { if (d?.operators) setOperators(d.operators); }).catch(() => {});
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

  const fmtDwt = (d: number) => d > 0 ? `${(d/1000).toFixed(0)}k DWT` : "";
  const fmtM = (n: number) => (n/1e6).toFixed(1);

  const bg = theme === "light" ? "#f8fafc" : "#0f172a";
  const cardBg = theme === "light" ? "#ffffff" : "#1e293b";
  const border = theme === "light" ? "#e2e8f0" : "#334155";
  const text = theme === "light" ? "#1e293b" : "#e2e8f0";
  const textMuted = theme === "light" ? "#64748b" : "#94a3b8";
  const textDim = theme === "light" ? "#94a3b8" : "#64748b";
  const accent = "#38bdf8";
  const tagBg = theme === "light" ? "#f1f5f9" : "#0f172a";

  const inp = { padding: "10px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 8, color: text, fontSize: 14 } as const;

  return (
    <main style={{ fontFamily: "system-ui,sans-serif", background: bg, minHeight: "100vh", color: text }}>
      {/* Mobile menu overlay */}
      <div className={`mobile-nav-overlay${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-nav-panel${menuOpen ? " open" : ""}`}>
        <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>&#x2715;</button>
        {NAV_LINKS.map(([l,h]) => (
          <a key={h} href={h} className={h==="/" ? "active" : ""}>{l}</a>
        ))}
        <button onClick={() => { toggleTheme(); setMenuOpen(false); }}
          style={{ background: "none", border: `1px solid #334155`, borderRadius: 8, padding: "12px 16px", cursor: "pointer", fontSize: 15, color: "#e2e8f0", textAlign: "left", marginTop: 8 }}>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div className="page-header" style={{ background: cardBg, borderBottom: `1px solid ${border}`, padding: "16px 24px" }}>
        <div style={{ maxWidth: "95%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {currentUser && currentUser.username !== "kay" && currentUser.username !== "admin" ? (
              <>
                <img src="/logos/arklow-crest.png" alt="" style={{ height: 40 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff" }}>{currentUser.company}</h1>
              </>
            ) : null}
            {(!currentUser || currentUser.username === "kay" || currentUser.username === "admin") && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img src="/icon-maritime-ai.png" alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                <div>
                  <span style={{ fontSize: 22, fontWeight: 700, color: accent }}>Maritime AI</span>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: textMuted }}>{stats.total.toLocaleString()} ships worldwide</p>
                </div>
              </div>
            )}
          </div>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)}>&#9776;</button>
          <nav className="nav-links">
            {NAV_LINKS.map(([l,h]) => (
              <a key={h} href={h} style={{ color: h==="/" ? accent : textMuted, textDecoration: "none" }}>{l}</a>
            ))}
            <button onClick={toggleTheme} title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{ background: "none", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 16, color: text, marginLeft: 8 }}>
              {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {currentUser && currentUser.username !== "kay" && currentUser.username !== "admin" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
                <img src="/icon-maritime-ai.png" alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>Maritime AI</span>
              </div>
            )}
            <a href="/api/auth/logout" style={{ color: textDim, textDecoration: "none", fontSize: 12, marginLeft: 12 }}>Logout</a>

          </nav>
        </div>
      </div>

      <div style={{ background: cardBg, borderBottom: `1px solid ${theme === "light" ? "#cbd5e1" : "#1e3a5f"}`, padding: "12px 24px" }}>
        <div className="stats-bar" style={{ maxWidth: "95%", margin: "0 auto", display: "flex", gap: 32, fontSize: 13 }}>
          {[["Total Ships", stats.total.toLocaleString()],["Photos", stats.withImage.toLocaleString()],["GPS", stats.withPosition.toLocaleString()],["DWT", `${fmtM(stats.totalDwt)} M`]].map(([l,v]) => (
            <div key={l}><div style={{ color: textDim }}>{l}</div><div className="stat-value" style={{ color: accent, fontWeight: 600, fontSize: 16 }}>{v}</div></div>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: "95%", margin: "0 auto", padding: "24px" }}>
        <div className="filter-row" style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <input type="text" placeholder="Search ships, IMO, operator..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" style={{ ...inp, flex: 1, minWidth: 200, outline: "none" }} />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} autoComplete="off" style={inp}>
            <option value="">All Types</option>
            {SHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} autoComplete="off" style={{ ...inp, maxWidth: 180 }}>
            <option value="">All Flags</option>
            {flags.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} autoComplete="off" style={inp}>
            <option value="name">Name</option>
            <option value="dwt">DWT</option>
            <option value="year">Year</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            style={{ ...inp, cursor: "pointer", background: showFilters ? "#0ea5e9" : cardBg, color: showFilters ? "#fff" : text, display: "flex", alignItems: "center", gap: 6 }}>
            Filters {activeFilterCount > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{activeFilterCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="filter-row" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", padding: "14px 16px", background: theme === "light" ? "#f1f5f9" : "#162032", borderRadius: 10, border: `1px solid ${border}` }}>
            <select value={ageRange} onChange={e => setAgeRange(Number(e.target.value))} style={inp}>
              {AGE_RANGES.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
            </select>
            <select value={dwtRange} onChange={e => setDwtRange(Number(e.target.value))} style={inp}>
              {DWT_RANGES.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inp}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} autoComplete="off" style={{ ...inp, minWidth: 180 }}>
              <option value="">All Operators</option>
              {operators.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={() => { setAgeRange(0); setDwtRange(0); setStatusFilter(""); setOperatorFilter(""); setTypeFilter(""); setFlagFilter(""); }}
                style={{ ...inp, cursor: "pointer", color: "#ef4444", borderColor: "#ef4444" }}>
                Clear All
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: textDim }}>Quick:</span>
          {[["Arklow","Arklow Shipping"],["Oldendorff","Oldendorff Carriers"],["Maersk","Maersk"],["MSC","MSC"],["CMA CGM","CMA CGM"],["Hapag-Lloyd","Hapag-Lloyd"],["Evergreen","Evergreen"]].map(([label, q]) => (
            <button key={q} onClick={() => { setOperatorFilter(operatorFilter === q ? "" : q); setSearch(""); setPage(1); }}
              style={{ padding: "4px 10px", background: operatorFilter === q ? "#0ea5e9" : cardBg, border: `1px solid ${search === q ? "#0ea5e9" : border}`, borderRadius: 20, color: operatorFilter === q ? "#fff" : textMuted, fontSize: 12, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, color: textDim }}>
          {loading ? "Loading..." : `${total.toLocaleString()} ships · Page ${page}/${totalPages.toLocaleString()}`}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: textDim }}>Loading ships...</div>
        ) : ships.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, color: textDim }}>No ships found</div>
        ) : (
          <div className="ship-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {ships.map(ship => (
              <a key={ship.imo} href={`/schiff/${ship.imo}`} style={{ textDecoration: "none", display: "block", background: cardBg, borderRadius: 12, border: `1px solid ${border}`, overflow: "hidden" }}>
                {ship.imageUrl
                  ? <div style={{ height: 160, overflow: "hidden", background: tagBg }}><img src={ship.imageUrl} alt={ship.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" /></div>
                  : <div style={{ height: 80, background: tagBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🚢</div>
                }
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ship.name}</div>
                  <div style={{ fontSize: 12, color: textDim, marginBottom: 8 }}>IMO {ship.imo}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 7px", background: tagBg, borderRadius: 4, fontSize: 11, color: accent }}>{ship.type}</span>
                    {ship.flag && <span style={{ padding: "2px 7px", background: tagBg, borderRadius: 4, fontSize: 11, color: textMuted }}>{ship.flag}</span>}
                    {ship.dwt > 0 && <span style={{ padding: "2px 7px", background: tagBg, borderRadius: 4, fontSize: 11, color: textMuted }}>{fmtDwt(ship.dwt)}</span>}
                    {ship.yearBuilt > 0 && <span style={{ padding: "2px 7px", background: tagBg, borderRadius: 4, fontSize: 11, color: textMuted }}>{ship.yearBuilt}</span>}
                    {ship.lat && <span style={{ padding: "2px 7px", background: theme === "light" ? "#dcfce7" : "#052e16", borderRadius: 4, fontSize: 11, color: "#4ade80" }}>Live</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 32 }}>
            <button onClick={() => setPage(1)} disabled={page===1} style={{ padding: "8px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 6, color: text, cursor: "pointer" }}>&#171;</button>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: "8px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 6, color: text, cursor: "pointer" }}>&#8249;</button>
            <span style={{ padding: "8px 16px", background: "#0ea5e9", borderRadius: 6, fontWeight: 600, color: "#fff" }}>{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: "8px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 6, color: text, cursor: "pointer" }}>&#8250;</button>
            <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={{ padding: "8px 14px", background: cardBg, border: `1px solid ${border}`, borderRadius: 6, color: text, cursor: "pointer" }}>&#187;</button>
          </div>
        )}
      </div>
    </main>
  );
}
