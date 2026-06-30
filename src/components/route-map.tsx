"use client";
import { useEffect, useRef } from "react";
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

// Great circle interpolation — returns N points along shortest arc
function greatCirclePoints(lat1: number, lon1: number, lat2: number, lon2: number, n: number): [number, number][] {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const phi1 = toRad(lat1), lam1 = toRad(lon1);
  const phi2 = toRad(lat2), lam2 = toRad(lon2);

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((phi2 - phi1) / 2), 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.pow(Math.sin((lam2 - lam1) / 2), 2)
  ));

  if (d < 0.0001) return [[lat1, lon1], [lat2, lon2]];

  const points: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
    const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);
    points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return points;
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

    // Great circle route with 50 points
    const gcPoints = greatCirclePoints(fromLat, fromLon, toLat, toLon, 50);

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

    // Full route (dashed)
    L.polyline(gcPoints, {
      color: "#3b82f6",
      weight: 2,
      opacity: 0.4,
      dashArray: "8, 6",
    }).addTo(map);

    // Ship position along great circle
    const pct = Math.max(0, Math.min(98, progressPercent));
    const shipIdx = Math.round((pct / 100) * (gcPoints.length - 1));
    const [sLat, sLon] = gcPoints[shipIdx];

    // Sailed portion (solid)
    L.polyline(gcPoints.slice(0, shipIdx + 1), {
      color: "#3b82f6",
      weight: 3,
      opacity: 0.8,
    }).addTo(map);

    // Ship marker
    const shipIcon = L.divIcon({
      html: `<div style="position:relative">
        <div style="width:10px;height:10px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,0.5)"></div>
        <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);padding:2px 6px;background:rgba(15,23,42,0.9);border:1px solid rgba(16,185,129,0.3);border-radius:3px;white-space:nowrap;font-size:10px;color:#e2e8f0;font-family:system-ui"><span style="color:#10b981;font-weight:600">${shipName || "Ship"}</span> <span style="color:#94a3b8;margin-left:4px">${daysRemaining}d remaining</span></div>
      </div>`,
      className: "",
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });
    L.marker([sLat, sLon], { icon: shipIcon }).addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(gcPoints);
    map.fitBounds(bounds, { padding: [50, 50] });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [fromLat, fromLon, toLat, toLon, daysTotal, daysRemaining, distanceNm, progressPercent, fromName, toName, shipName]);

  return <div ref={ref} style={{ height, width: "100%", borderRadius: 8 }} />;
}
