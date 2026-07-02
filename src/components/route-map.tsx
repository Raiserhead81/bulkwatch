"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapProps {
  fromLat: number; fromLon: number; fromName: string;
  toLat: number; toLon: number; toName: string;
  shipName?: string;
  daysTotal: number; daysRemaining: number;
  distanceNm: number; progressPercent: number;
  height?: number;
}


export default function RouteMap({
  fromLat, fromLon, fromName,
  toLat, toLon, toName,
  shipName,
  daysTotal, daysRemaining, distanceNm, progressPercent,
  height = 280,
}: RouteMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [routePoints, setRoutePoints] = useState<[number,number][]>([]);

  // Fetch sea route from API
  useEffect(() => {
    fetch(`/api/searoute?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`)
      .then(r => r.json())
      .then(d => { if (d.points) setRoutePoints(d.points); })
      .catch(() => setRoutePoints([[fromLat,fromLon],[toLat,toLon]]));
  }, [fromLat, fromLon, toLat, toLon]);

  // Render map when route is available
  useEffect(() => {
    if (!ref.current || routePoints.length < 2) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(ref.current, {
      zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false,
    });
    const isDark = document.documentElement.classList.contains("dark");
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    L.tileLayer(tileUrl, { maxZoom: 12 }).addTo(map);

    const portIcon = (color: string, label: string, above: boolean) => L.divIcon({
      html: `<div style="position:relative"><div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div><div style="position:absolute;${above?"top:-22px":"top:18px"};left:50%;transform:translateX(-50%);padding:1px 6px;background:${isDark?"rgba(15,23,42,0.9)":"rgba(255,255,255,0.95)"};border:1px solid ${isDark?"rgba(255,255,255,0.1)":"rgba(0,0,0,0.1)"};border-radius:3px;white-space:nowrap;font-size:10px;font-weight:600;color:${isDark?"#cbd5e1":"#1e293b"};font-family:system-ui">${label}</div></div>`,
      className: "", iconSize: [12,12], iconAnchor: [6,6],
    });

    L.marker([fromLat,fromLon], { icon: portIcon("#3b82f6", fromName, true) }).addTo(map);
    L.marker([toLat,toLon], { icon: portIcon("#ef4444", toName, false) }).addTo(map);

    // Full route (dashed)
    L.polyline(routePoints, { color: "#3b82f6", weight: 2, opacity: 0.4, dashArray: "8, 6" }).addTo(map);

    // Ship position along route
    const pct = Math.max(0, Math.min(98, progressPercent));
    const shipIdx = Math.round((pct / 100) * (routePoints.length - 1));
    const [sLat, sLon] = routePoints[shipIdx] || routePoints[0];

    // Sailed portion (solid)
    L.polyline(routePoints.slice(0, shipIdx + 1), { color: "#3b82f6", weight: 3, opacity: 0.8 }).addTo(map);

    // Ship marker
    const shipIcon = L.divIcon({
      html: `<div style="position:relative"><div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,0.5)"></div><div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);padding:2px 6px;background:${isDark?"rgba(15,23,42,0.9)":"rgba(255,255,255,0.95)"};border:1px solid ${isDark?"rgba(16,185,129,0.3)":"rgba(16,185,129,0.5)"};border-radius:3px;white-space:nowrap;font-size:10px;color:${isDark?"#e2e8f0":"#1e293b"};font-family:system-ui"><span style="color:#10b981;font-weight:600">${daysRemaining}d</span> <span style="color:#94a3b8">remaining</span></div></div>`,
      className: "", iconSize: [10,10], iconAnchor: [5,5],
    });
    L.marker([sLat, sLon], { icon: shipIcon }).addTo(map);

    const bounds = L.latLngBounds(routePoints);
    map.fitBounds(bounds, { padding: [50, 50] });
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, [routePoints, fromLat, fromLon, toLat, toLon, fromName, toName, daysRemaining, progressPercent]);

  return <div ref={ref} style={{ height, width: "100%", borderRadius: 8 }} />;
}
