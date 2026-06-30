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
    const portIcon = (color: string, label: string, isFrom: boolean) => L.divIcon({
      html: `<div style="position:relative">
        <div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>
        <div style="position:absolute;${isFrom ? "top:-22px" : "top:18px"};left:50%;transform:translateX(-50%);padding:1px 6px;background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.1);border-radius:3px;white-space:nowrap;font-size:10px;font-weight:600;color:#cbd5e1;font-family:system-ui;letter-spacing:0.02em">${label}</div>
      </div>`,
      className: "",
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

    L.marker([fromLat, fromLon], { icon: portIcon("#3b82f6", fromName, true) }).addTo(map);
    L.marker([toLat, toLon], { icon: portIcon("#ef4444", toName, false) }).addTo(map);

    // Route line (dashed = planned)
    const routeLine = L.polyline([[fromLat, fromLon], [toLat, toLon]], {
      color: "#3b82f6",
      weight: 2,
      opacity: 0.4,
      dashArray: "8, 6",
    }).addTo(map);

    // Ship position
    const pct = Math.max(0, Math.min(100, progressPercent));
    const sLat = shipLat ?? fromLat + (toLat - fromLat) * (pct / 100);
    const sLon = shipLon ?? fromLon + (toLon - fromLon) * (pct / 100);

    // Sailed line (solid)
    L.polyline([[fromLat, fromLon], [sLat, sLon]], {
      color: "#3b82f6",
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Ship marker
    const shipIcon = L.divIcon({
      html: `<div style="position:relative">
        <div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,0.5)"></div>
        <div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);padding:1px 5px;background:rgba(15,23,42,0.9);border:1px solid rgba(16,185,129,0.3);border-radius:3px;white-space:nowrap;font-size:9px;color:#94a3b8;font-family:system-ui">${seaDays}d / ${distanceNm}nm</div>
      </div>`,
      className: "",
      iconSize: [10, 10],
      iconAnchor: [5, 5],
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
