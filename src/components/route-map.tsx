"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  fromLat: number; fromLon: number; fromName: string;
  toLat: number; toLon: number; toName: string;
  shipLat?: number; shipLon?: number; shipName?: string;
  seaDays: string; distanceNm: number; progressPercent: number;
  height?: number;
}

export default function RouteMap({
  fromLat, fromLon, fromName,
  toLat, toLon, toName,
  shipLat, shipLon, shipName,
  seaDays, distanceNm, progressPercent,
  height = 280,
}: RouteMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const map = L.map(ref.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 12,
    }).addTo(map);

    // Port markers
    const portIcon = (color: string, label: string) => L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>
        <div style="margin-top:4px;padding:2px 6px;background:rgba(15,23,42,0.85);border-radius:4px;white-space:nowrap;font-size:11px;font-weight:600;color:#e2e8f0;font-family:system-ui">${label}</div>
      </div>`,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [7, 7],
    });

    L.marker([fromLat, fromLon], { icon: portIcon("#3b82f6", fromName) }).addTo(map);
    L.marker([toLat, toLon], { icon: portIcon("#ef4444", toName) }).addTo(map);

    // Route line (dashed = planned)
    const routeLine = L.polyline([[fromLat, fromLon], [toLat, toLon]], {
      color: "#3b82f6",
      weight: 2,
      opacity: 0.4,
      dashArray: "8, 6",
    }).addTo(map);

    // Ship position
    const sLat = shipLat ?? fromLat + (toLat - fromLat) * (progressPercent / 100);
    const sLon = shipLon ?? fromLon + (toLon - fromLon) * (progressPercent / 100);

    // Sailed line (solid)
    L.polyline([[fromLat, fromLon], [sLat, sLon]], {
      color: "#3b82f6",
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Ship marker
    const shipIcon = L.divIcon({
      html: `<div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:18px;height:18px;border-radius:50%;background:#10b981;border:2.5px solid #fff;box-shadow:0 0 12px rgba(16,185,129,0.6)"></div>
        <div style="margin-top:4px;padding:2px 8px;background:rgba(15,23,42,0.9);border-radius:4px;white-space:nowrap;font-size:10px;color:#94a3b8;font-family:system-ui">
          <span style="color:#10b981;font-weight:700">${shipName || "Position"}</span>
          <span style="margin-left:6px">${seaDays}d · ${distanceNm}nm</span>
        </div>
      </div>`,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [9, 9],
    });
    L.marker([sLat, sLon], { icon: shipIcon }).addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds([[fromLat, fromLon], [toLat, toLon], [sLat, sLon]]);
    map.fitBounds(bounds, { padding: [50, 50] });

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [fromLat, fromLon, toLat, toLon, shipLat, shipLon, seaDays, distanceNm, progressPercent, fromName, toName, shipName]);

  return <div ref={ref} style={{ height, width: "100%", borderRadius: 8 }} />;
}
