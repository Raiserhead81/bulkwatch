"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Ship } from "@/data/ships";
import { estimatePrice, formatPrice, getRecommendationEmoji } from "@/lib/priceEstimator";
import { useI18n } from "@/lib/i18n";
import { useAllLiveShips } from "@/lib/use-live-ais";

interface WorldMapProps {
  ships: Ship[];
  height?: string;
}

export default function WorldMap({ ships, height = "600px" }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const liveLayerRef = useRef<L.LayerGroup | null>(null);
  const clusterGroupRef = useRef<L.LayerGroup | null>(null);
  const { t, lang } = useI18n();
  const { ships: liveShips, stats } = useAllLiveShips(30000);
  const [showLive, setShowLive] = useState(true);
  const [showStatic, setShowStatic] = useState(true);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 14,
      worldCopyJump: true,
      attributionControl: true,
    });

    // Base OSM layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // OpenSeaMap nautical overlay
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      attribution: '<a href="http://www.openseamap.org">OpenSeaMap</a>',
      opacity: 0.7,
      maxZoom: 19,
    }).addTo(map);

    // Cluster group for DB ships
    const clusterGroup = L.layerGroup();
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    liveLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []);

  // Update static clustered markers (ships from database)
  useEffect(() => {
    if (!clusterGroupRef.current || !mapRef.current) return;
    const clusterGroup = clusterGroupRef.current;
    clusterGroup.clearLayers();
    if (!showStatic) return;

    const staticIcon = L.divIcon({
      className: "ship-marker",
      html: `<div style="
        width: 22px; height: 22px;
        background: linear-gradient(135deg, #2563eb, #06b6d4);
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
      "><span style="transform: rotate(45deg); font-size: 9px;">🚢</span></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      popupAnchor: [0, -22],
    });

    for (const ship of ships) {
      const pos = ship.position;
      if (!pos || (pos.lat === 0 && pos.lon === 0)) continue;

      const price = estimatePrice(ship);
      const recEmoji = getRecommendationEmoji(price.recommendation);
      const priceStr = formatPrice(price.estimatedValueUSD);

      const popupHtml = `
        <div style="min-width: 220px; font-family: system-ui, sans-serif;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${ship.name}</div>
          <div style="font-size: 11px; color: #666; margin-bottom: 6px;">
            ${ship.type} &middot; IMO: ${ship.imo} &middot; ${ship.flag || ""}
          </div>
          <div style="font-size: 11px; margin-bottom: 2px;">
            <strong>Position:</strong> ${pos.lat.toFixed(4)}&deg;, ${pos.lon.toFixed(4)}&deg;
          </div>
          <div style="font-size: 11px; margin-bottom: 2px;">
            <strong>Status:</strong> ${ship.status}
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Est. Value:</strong> ${priceStr} &nbsp; ${recEmoji} ${price.recommendation}
          </div>
          <a href="/schiff/${ship.imo}" style="
            display: inline-block;
            background: #2563eb; color: white;
            padding: 4px 12px; border-radius: 6px;
            text-decoration: none; font-size: 11px;
          ">Details &rarr;</a>
        </div>
      `;

      const marker = L.marker([pos.lat, pos.lon], { icon: staticIcon })
        .bindPopup(popupHtml);
      clusterGroup.addLayer(marker);
    }
  }, [ships, showStatic, t, lang]);

  // Toggle cluster group visibility
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return;
    if (showStatic) {
      mapRef.current.addLayer(clusterGroupRef.current);
    } else {
      mapRef.current.removeLayer(clusterGroupRef.current);
    }
  }, [showStatic]);

  // Update live markers (real AIS positions)
  useEffect(() => {
    if (!liveLayerRef.current) return;
    liveLayerRef.current.clearLayers();
    if (!showLive) return;

    const limit = liveShips.slice(0, 2000);

    const liveIcon = L.divIcon({
      className: "live-ship-marker",
      html: `<div style="
        width: 14px; height: 14px;
        background: #10b981;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(16,185,129,0.8);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });

    for (const ship of limit) {
      if (!ship.lat || !ship.lon) continue;
      if (ship.lat === 0 && ship.lon === 0) continue;

      const speed = ship.sog !== undefined ? `${ship.sog.toFixed(1)} kn` : "—";
      const course = ship.cog !== undefined ? `${ship.cog.toFixed(0)}&deg;` : "—";
      const lastSeen = new Date(ship.timestamp).toLocaleTimeString(lang === "de" ? "de-DE" : "en-US");
      const name = ship.name || ship.shipName || `MMSI ${ship.mmsi}`;

      const popupHtml = `
        <div style="min-width: 200px; font-family: system-ui, sans-serif;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; box-shadow: 0 0 4px #10b981;"></span>
            <strong style="font-size: 14px;">${name}</strong>
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 6px;">
            MMSI: ${ship.mmsi}${ship.imo ? ` &middot; IMO: ${ship.imo}` : ""}
          </div>
          <div style="font-size: 11px; margin-bottom: 2px;">
            <strong>Position:</strong> ${ship.lat.toFixed(4)}&deg;, ${ship.lon.toFixed(4)}&deg;
          </div>
          <div style="font-size: 11px; margin-bottom: 2px;">
            <strong>Speed:</strong> ${speed} &nbsp; <strong>Course:</strong> ${course}
          </div>
          ${ship.destination ? `<div style="font-size: 11px; margin-bottom: 2px;"><strong>Destination:</strong> ${ship.destination}</div>` : ""}
          <div style="font-size: 10px; color: #888; margin-top: 4px;">
            Last signal: ${lastSeen}
          </div>
        </div>
      `;

      const marker = L.marker([ship.lat, ship.lon], { icon: liveIcon })
        .bindPopup(popupHtml);
      liveLayerRef.current.addLayer(marker);
    }
  }, [liveShips, showLive, t, lang]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden border border-blue-500/20" />

      {/* Live AIS overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg border border-blue-500/30 shadow-lg p-3 max-w-[260px]">
        <div className="flex items-center gap-2 mb-2">
          <span className={`h-2 w-2 rounded-full ${stats?.wsConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-cyan-300">
            Live AIS {stats?.wsConnected ? "●" : "○"}
          </span>
        </div>
        <div className="text-xs space-y-1 mb-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-white/50">Live Ships:</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{stats?.activeShips ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-white/50">DB Positions:</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{ships.length}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showLive}
              onChange={(e) => setShowLive(e.target.checked)}
              className="accent-emerald-500"
            />
            <span className="text-emerald-600 dark:text-emerald-400">● Live AIS</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showStatic}
              onChange={(e) => setShowStatic(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-blue-600 dark:text-blue-400">🚢 Database ({ships.length})</span>
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg border border-blue-500/30 shadow-lg p-2 text-[10px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-slate-700 dark:text-white/70">Live AIS (real-time)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 inline-block rounded-sm" style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }} />
          <span className="text-slate-700 dark:text-white/70">Vessel Database</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">⚓</span>
          <span className="text-slate-700 dark:text-white/70">OpenSeaMap overlay</span>
        </div>
      </div>
    </div>
  );
}