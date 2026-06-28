"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { Ship } from "@/data/ships";
import { useAllLiveShips, type LiveAISShip } from "@/lib/use-live-ais";

interface WorldMapProps {
  ships: Ship[];
  height?: string;
  typeFilter?: string;
}

// ── Type colour palette ──────────────────────────────────────────────────────
function getTypeColor(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("lng") || t.includes("lpg") || t.includes("gas tanker")) return "#a855f7";
  if (t.includes("crude") || t.includes("vlcc") || t.includes("aframax") || t.includes("suezmax")) return "#dc2626";
  if (t.includes("tanker") || t.includes("oil") || t.includes("chemical") || t.includes("product")) return "#f87171";
  if (t.includes("container") || t.includes("feeder") || t.includes("ulcv")) return "#f59e0b";
  if (t.includes("bulk") || t.includes("capesize") || t.includes("panamax") ||
      t.includes("handymax") || t.includes("handysize") || t.includes("vloc") ||
      t.includes("kamsarmax") || t.includes("ultramax") || t.includes("supramax")) return "#3b82f6";
  if (t.includes("general cargo") || t.includes("multipurpose")) return "#10b981";
  if (t.includes("roro") || t.includes("ro-ro") || t.includes("car carrier") || t.includes("pctc")) return "#06b6d4";
  if (t.includes("passenger") || t.includes("cruise") || t.includes("ferry")) return "#ec4899";
  if (t.includes("reefer")) return "#84cc16";
  if (t.includes("tug")) return "#78716c";
  if (t.includes("offshore") || t.includes("osv") || t.includes("platform")) return "#a3a3a3";
  return "#64748b";
}

// AIS navStatus → colour
function navStatusColor(status?: number): string {
  if (status === 1) return "#f59e0b"; // at anchor
  if (status === 5) return "#6b7280"; // moored
  if (status === 0) return "#10b981"; // underway
  return "#38bdf8";
}

// ── SVG ship triangle (rotated by COG/heading) ────────────────────────────────
function shipSVG(color: string, hdg: number, size = 14): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 14 20" style="transform:rotate(${hdg}deg);display:block">
    <polygon points="7,0 14,20 7,15 0,20" fill="${color}" stroke="rgba(255,255,255,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}

// ── DB ship dot ──────────────────────────────────────────────────────────────
function dbDotSVG(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" fill="${color}" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
  </svg>`;
}

// ── Cluster icon factory ──────────────────────────────────────────────────────
function makeClusterIcon(count: number, color: string) {
  const size = count < 50 ? 32 : count < 500 ? 38 : count < 5000 ? 44 : 52;
  const label = count < 1000 ? String(count) : `${Math.round(count / 1000)}k`;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color}cc;border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;backdrop-filter:blur(2px);box-shadow:0 2px 8px rgba(0,0,0,0.4)">${label}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCoord(lat: number, lon: number): string {
  const latD = Math.abs(lat).toFixed(4);
  const lonD = Math.abs(lon).toFixed(4);
  return `${latD}°${lat >= 0 ? "N" : "S"} ${lonD}°${lon >= 0 ? "E" : "W"}`;
}

// ── Popup HTML ────────────────────────────────────────────────────────────────
function buildPopup(ship: Ship, color: string): string {
  const imgHtml = ship.imageUrl
    ? `<img src="${ship.imageUrl}" alt="${ship.name}" style="width:100%;height:110px;object-fit:cover;border-radius:6px 6px 0 0;display:block"
         onerror="this.style.display='none'">`
    : "";
  // 47000/190/30/11/2008 are DB import defaults — skip them
  const isDefaultData = ship.dwt === 47000 && ship.length === 190 && ship.yearBuilt === 2008;
  const dwt = ship.dwt > 0 && !isDefaultData ? `${(ship.dwt / 1000).toFixed(0)}k DWT` : "";
  const year = ship.yearBuilt > 0 && !isDefaultData ? ship.yearBuilt : "";
  const coordHtml = ship.position
    ? `<div style="font-size:10px;color:#475569;margin-top:4px;font-family:monospace">${fmtCoord(ship.position.lat, ship.position.lon)}</div>`
    : "";
  return `
    <div style="width:230px;font-family:system-ui,sans-serif;border-radius:8px;overflow:hidden">
      ${imgHtml}
      <div style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
          <strong style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px">${ship.name}</strong>
        </div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:6px">
          ${ship.type}${ship.flag ? ` · ${ship.flag}` : ""}${ship.operator ? ` · ${ship.operator}` : ""}
        </div>
        <div style="font-size:11px;color:#cbd5e1;display:flex;gap:10px;margin-bottom:4px;flex-wrap:wrap">
          <span>IMO <strong style="color:#e2e8f0">${ship.imo}</strong></span>
          ${dwt ? `<span><strong style="color:#e2e8f0">${dwt}</strong></span>` : ""}
          ${year ? `<span>Built <strong style="color:#e2e8f0">${year}</strong></span>` : ""}
        </div>
        ${coordHtml}
        <a href="/schiff/${ship.imo}" style="display:block;text-align:center;background:#2563eb;color:#fff;padding:5px 0;border-radius:5px;text-decoration:none;font-size:12px;font-weight:600;margin-top:8px">View Details →</a>
      </div>
    </div>`;
}

function buildLivePopup(live: LiveAISShip, dbShip?: Ship): string {
  const color = dbShip ? getTypeColor(dbShip.type) : navStatusColor(live.navStatus);
  const name = live.name || live.shipName || `MMSI ${live.mmsi}`;
  const speed = live.sog !== undefined ? `${live.sog.toFixed(1)} kn` : "—";
  const course = live.cog !== undefined ? `${Math.round(live.cog)}°` : "—";
  const imgHtml = dbShip?.imageUrl
    ? `<img src="${dbShip.imageUrl}" alt="${name}" style="width:100%;height:90px;object-fit:cover;border-radius:6px 6px 0 0;display:block"
         onerror="this.style.display='none'">`
    : "";
  const ts = new Date(live.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const detailLink = (dbShip || live.imo)
    ? `<a href="/schiff/${dbShip?.imo ?? live.imo}" style="display:block;text-align:center;background:#2563eb;color:#fff;padding:5px 0;border-radius:5px;text-decoration:none;font-size:12px;font-weight:600;margin-top:8px">View Details →</a>`
    : "";
  return `
    <div style="width:230px;font-family:system-ui,sans-serif;border-radius:8px;overflow:hidden">
      ${imgHtml}
      <div style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 6px ${color}"></span>
          <strong style="font-size:13px">${name}</strong>
        </div>
        ${dbShip ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:4px">${dbShip.type}${dbShip.flag ? ` · ${dbShip.flag}` : ""}</div>` : ""}
        <div style="font-size:11px;color:#cbd5e1;margin-bottom:4px">
          MMSI <strong style="color:#e2e8f0">${live.mmsi}</strong>${live.imo ? ` · IMO <strong style="color:#e2e8f0">${live.imo}</strong>` : ""}
        </div>
        <div style="font-size:11px;color:#cbd5e1;display:flex;gap:12px;margin-bottom:4px">
          <span>⚡ <strong style="color:#e2e8f0">${speed}</strong></span>
          <span>🧭 <strong style="color:#e2e8f0">${course}</strong></span>
        </div>
        ${live.destination ? `<div style="font-size:11px;color:#94a3b8">→ <strong style="color:#e2e8f0">${live.destination}</strong></div>` : ""}
        <div style="font-size:10px;color:#475569;margin-top:3px;font-family:monospace">${fmtCoord(live.lat, live.lon)}</div>
        <div style="font-size:10px;color:#475569;margin-top:2px">Last signal: ${ts}</div>
        ${detailLink}
      </div>
    </div>`;
}

// ── Legend data ───────────────────────────────────────────────────────────────
const LEGEND = [
  { color: "#3b82f6", label: "Bulk Carrier" },
  { color: "#f59e0b", label: "Container" },
  { color: "#f87171", label: "Tanker" },
  { color: "#a855f7", label: "LNG / LPG" },
  { color: "#10b981", label: "General Cargo" },
  { color: "#06b6d4", label: "RoRo / Car" },
  { color: "#ec4899", label: "Passenger" },
  { color: "#84cc16", label: "Reefer" },
  { color: "#78716c", label: "Tug / Other" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function WorldMap({ ships, height = "100%", typeFilter = "" }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const liveClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const dbClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const seaMarkRef = useRef<L.TileLayer | null>(null);

  const [showLive, setShowLive] = useState(true);
  const [showDB, setShowDB] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [cursor, setCursor] = useState<{ lat: number; lon: number } | null>(null);

  const { ships: liveShips, stats } = useAllLiveShips(120000); // 2-min refresh — ships barely move at world-zoom

  // Index DB ships by IMO for fast lookup
  const dbByImo = useMemo(() => {
    const m = new Map<string, Ship>();
    for (const s of ships) if (s.imo) m.set(s.imo, s);
    return m;
  }, [ships]);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [25, 10],
      zoom: 3,
      minZoom: 2,
      maxZoom: 16,
      worldCopyJump: true,
      zoomControl: false,
    });

    // Zoom control bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Dark CartoDB base layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
      detectRetina: true,
    }).addTo(map);

    // OpenSeaMap nautical overlay (hidden by default)
    const seaMark = L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      attribution: '<a href="https://www.openseamap.org">OpenSeaMap</a>',
      opacity: 0.65,
      maxZoom: 20,
    });
    seaMarkRef.current = seaMark;

    // ── Cluster groups ───────────────────────────────────────────────────────
    const liveCluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 9,
      chunkedLoading: true,        // process markers in chunks to avoid UI freeze
      chunkSize: 500,
      chunkDelay: 50,
      iconCreateFunction: (cluster: any) =>
        makeClusterIcon(cluster.getChildCount(), "#10b981"),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    }) as L.MarkerClusterGroup;

    const dbCluster = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 8,
      iconCreateFunction: (cluster: any) =>
        makeClusterIcon(cluster.getChildCount(), "#2563eb"),
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    }) as L.MarkerClusterGroup;

    map.addLayer(dbCluster);
    map.addLayer(liveCluster);

    liveClusterRef.current = liveCluster;
    dbClusterRef.current = dbCluster;
    // Cursor coordinate readout
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      setCursor({ lat: e.latlng.lat, lon: e.latlng.lng });
    });
    map.on("mouseout", () => setCursor(null));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      liveClusterRef.current = null;
      dbClusterRef.current = null;
      seaMarkRef.current = null;
    };
  }, []);

  // ── SeaMarks toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = seaMarkRef.current;
    if (!map || !layer) return;
    if (showSeamarks) map.addLayer(layer);
    else map.removeLayer(layer);
  }, [showSeamarks]);

  // ── DB ship markers ──────────────────────────────────────────────────────
  const activeType = selectedType || typeFilter;

  useEffect(() => {
    const cluster = dbClusterRef.current;
    const map = mapRef.current;
    if (!cluster || !map) return;
    cluster.clearLayers();
    if (!showDB) return;

    for (const ship of ships) {
      const pos = ship.position;
      if (!pos || (pos.lat === 0 && pos.lon === 0)) continue;
      if (activeType && !ship.type.toLowerCase().includes(activeType.toLowerCase())) continue;

      const color = getTypeColor(ship.type);
      const icon = L.divIcon({
        html: dbDotSVG(color),
        className: "",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        popupAnchor: [0, -7],
      });

      L.marker([pos.lat, pos.lon], { icon })
        .bindPopup(buildPopup(ship, color), { maxWidth: 240, className: "vessel-popup" })
        .addTo(cluster);
    }
  }, [ships, showDB, activeType]);

  // ── Live AIS markers (batch addLayers to avoid per-marker overhead) ─────────
  useEffect(() => {
    const cluster = liveClusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    if (!showLive) return;

    const markers: L.Marker[] = [];
    for (const live of liveShips) {
      if (!live.lat || !live.lon || (live.lat === 0 && live.lon === 0)) continue;

      const dbShip = live.imo ? dbByImo.get(live.imo) : undefined;
      const color = dbShip ? getTypeColor(dbShip.type) : navStatusColor(live.navStatus);

      if (activeType && dbShip && !dbShip.type.toLowerCase().includes(activeType.toLowerCase())) continue;
      if (activeType && !dbShip) continue;

      const hdg = live.heading && live.heading < 360 ? live.heading : live.cog ?? 0;

      const icon = L.divIcon({
        html: shipSVG(color, hdg, 12),
        className: "",
        iconSize: [12, 17],
        iconAnchor: [6, 8],
        popupAnchor: [0, -10],
      });

      markers.push(
        L.marker([live.lat, live.lon], { icon })
          .bindPopup(buildLivePopup(live, dbShip), { maxWidth: 240, className: "vessel-popup" })
      );
    }
    (cluster as any).addLayers(markers); // batch add — much faster than individual addTo()
  }, [liveShips, showLive, dbByImo, activeType]);

  // ── Layer visibility ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const cl = liveClusterRef.current;
    if (!map || !cl) return;
    if (showLive) map.addLayer(cl);
    else map.removeLayer(cl);
  }, [showLive]);

  useEffect(() => {
    const map = mapRef.current;
    const cl = dbClusterRef.current;
    if (!map || !cl) return;
    if (showDB) map.addLayer(cl);
    else map.removeLayer(cl);
  }, [showDB]);

  const liveCount = liveShips.length;
  const dbCount = ships.filter(s => s.position && !(s.position.lat === 0 && s.position.lon === 0)).length;

  return (
    <div className="relative w-full" style={{ height }}>
      {/* ── Inject popup dark-theme CSS ── */}
      <style>{`
        .vessel-popup .leaflet-popup-content-wrapper {
          background: #0f172a;
          border: 1px solid rgba(59,130,246,0.3);
          border-radius: 8px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
          color: #e2e8f0;
        }
        .vessel-popup .leaflet-popup-tip { background: #0f172a; }
        .vessel-popup .leaflet-popup-content { margin: 0; }
        .leaflet-control-zoom a { background:#1e293b!important;color:#e2e8f0!important;border-color:#334155!important; }
        .leaflet-control-zoom a:hover { background:#334155!important; }
        .leaflet-control-attribution { background:rgba(15,23,42,0.7)!important;color:#64748b!important;font-size:9px!important; }
        .leaflet-control-attribution a { color:#475569!important; }
        .marker-cluster div { background:none!important; }
        .marker-cluster { background:none!important; }
      `}</style>

      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Top-right control panel ── */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/60 shadow-2xl p-3 min-w-[200px]">
        {/* Connection status */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${stats?.wsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-[11px] font-semibold text-slate-200 tracking-wide uppercase">
            AIS {stats?.wsConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-[11px]">
          <span className="text-slate-400">Live</span>
          <span className="text-emerald-400 font-bold tabular-nums text-right">{liveCount.toLocaleString()}</span>
          <span className="text-slate-400">Database</span>
          <span className="text-blue-400 font-bold tabular-nums text-right">{dbCount.toLocaleString()}</span>
        </div>

        {/* Layer toggles */}
        <div className="space-y-1.5 mb-3 pb-3 border-b border-slate-700/50">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div onClick={() => setShowLive(v => !v)}
              className={`w-7 h-4 rounded-full transition-colors flex-shrink-0 ${showLive ? "bg-emerald-500" : "bg-slate-600"}`}>
              <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${showLive ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-[11px] text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
              Live AIS ships
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setShowDB(v => !v)}
              className={`w-7 h-4 rounded-full transition-colors flex-shrink-0 ${showDB ? "bg-blue-500" : "bg-slate-600"}`}>
              <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${showDB ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-[11px] text-slate-300">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
              DB positions
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setShowSeamarks(v => !v)}
              className={`w-7 h-4 rounded-full transition-colors flex-shrink-0 ${showSeamarks ? "bg-cyan-500" : "bg-slate-600"}`}>
              <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${showSeamarks ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-[11px] text-slate-300">⚓ OpenSeaMap</span>
          </label>
        </div>

        {/* Type filter */}
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Filter by type</div>
        <div className="flex flex-wrap gap-1">
          {[
            ["All", ""],
            ["Bulk", "bulk"],
            ["Container", "container"],
            ["Tanker", "tanker"],
            ["LNG", "lng"],
            ["Cargo", "general cargo"],
            ["RoRo", "roro"],
          ].map(([label, val]) => (
            <button key={val}
              onClick={() => setSelectedType(val === selectedType ? "" : val)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                selectedType === val
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700/60 text-slate-400 hover:bg-slate-600/60 hover:text-slate-200"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bottom-center cursor coordinates ── */}
      {cursor && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700/50 px-3 py-1 pointer-events-none">
          <span className="font-mono text-[11px] text-slate-300">
            {fmtCoord(cursor.lat, cursor.lon)}
          </span>
        </div>
      )}

      {/* ── Bottom-left legend ── */}
      <div className="absolute bottom-8 left-3 z-[1000] bg-slate-900/85 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-xl p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Ship types</div>
        <div className="space-y-1">
          {LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <svg width="10" height="14" viewBox="0 0 14 20">
                <polygon points="7,0 14,20 7,15 0,20" fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              </svg>
              <span className="text-[10px] text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
