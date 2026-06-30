"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { findSeaRoute } from "@/lib/seaRouting";
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

// Major maritime chokepoints and waypoints for sea routing
const CHOKEPOINTS: Record<string, [number, number]> = {
  gibraltar:    [36.0, -5.5],
  suezN:        [31.3, 32.3],
  suezS:        [29.9, 32.6],
  babElMandeb:  [12.5, 43.5],
  hormuz:       [26.5, 56.5],
  sriLanka:     [6.0, 80.0],
  malacca:      [1.8, 101.5],
  singapore:    [1.2, 103.8],
  lombok:       [-8.5, 115.7],
  southChinaSea:[10.0, 115.0],
  taiwan:       [22.0, 121.0],
  eastPhilippines: [15.0, 128.0],
  eastPNG:      [-5.0, 155.0],
  skagen:       [57.7, 10.6],
  englishCh:    [50.0, -1.5],
  capeGoodHope: [-34.4, 18.5],
  capeHorn:     [-56.0, -67.0],
  panama:       [9.0, -79.5],
  panamaPacific:[8.0, -82.0],
  northMadagascar: [-12.0, 49.0],
  mozambique:   [-15.0, 40.5],
  goodHopeWest: [-34.0, 15.0],
  canaryIs:     [28.0, -15.5],
  azores:       [38.5, -28.0],
  dakar:        [14.7, -17.5],
  recife:       [-8.0, -34.8],
  buenosAires:  [-34.6, -58.4],
  pacificMid:   [0.0, -140.0],
  hawaii:       [21.0, -158.0],
  japanSouth:   [30.0, 132.0],
  koreaStrait:  [34.0, 129.0],
};

function getSeaRouteWaypoints(lat1: number, lon1: number, lat2: number, lon2: number): [number, number][] {
  const wp: [number, number][] = [[lat1, lon1]];
  const C = CHOKEPOINTS;
  
  // Region detection helpers
  const inRegion = (lat: number, lon: number, r: string): boolean => {
    switch(r) {
      case "europe":     return lat > 35 && lat < 72 && lon > -12 && lon < 35;
      case "nwEurope":   return lat > 48 && lon > -10 && lon < 10;
      case "baltic":     return lat > 54 && lon > 8 && lon < 30;
      case "med":        return lat > 30 && lat < 45 && lon > -6 && lon < 36;
      case "mideast":    return lon > 35 && lon < 75 && lat > 10 && lat < 35;
      case "persian":    return lon > 45 && lon < 60 && lat > 22 && lat < 32;
      case "india":      return lat > 5 && lat < 25 && lon > 68 && lon < 90;
      case "seAsia":     return lat > -10 && lat < 15 && lon > 95 && lon < 125;
      case "eastAsia":   return lat > 20 && lon > 100 && lon < 145;
      case "japan":      return lat > 30 && lat < 45 && lon > 128 && lon < 146;
      case "china":      return lat > 18 && lat < 42 && lon > 105 && lon < 125;
      case "auEast":     return lat < -15 && lon > 140 && lon < 160;
      case "auWest":     return lat < -15 && lon > 110 && lon < 130;
      case "australia":  return lat < -10 && lon > 110 && lon < 160;
      case "eAfrica":    return lat < 12 && lat > -35 && lon > 25 && lon < 55;
      case "wAfrica":    return lat < 15 && lat > -35 && lon > -20 && lon < 15;
      case "usEast":     return lat > 25 && lat < 50 && lon > -82 && lon < -60;
      case "usGulf":     return lat > 25 && lat < 32 && lon > -98 && lon < -80;
      case "usWest":     return lat > 25 && lat < 50 && lon > -130 && lon < -115;
      case "caribbean":  return lat > 8 && lat < 25 && lon > -90 && lon < -60;
      case "brazil":     return lat < 5 && lat > -35 && lon > -55 && lon < -30;
      case "argentina":  return lat < -25 && lon > -70 && lon < -50;
      default: return false;
    }
  };
  
  const r1 = (r: string) => inRegion(lat1, lon1, r);
  const r2 = (r: string) => inRegion(lat2, lon2, r);
  const route = (from: string, to: string) => (r1(from) && r2(to)) || (r1(to) && r2(from));
  const toward = (from: string, to: string) => r1(from) && r2(to);
  
  // ═══ EUROPE ↔ ASIA (Suez) ═══
  if (route("europe", "eastAsia") || route("europe", "seAsia") || route("europe", "japan") ||
      route("europe", "china") || route("europe", "australia") || route("europe", "india")) {
    const goEast = lon1 < lon2;
    const pts: [number, number][] = [];
    if (r1("baltic") || r2("baltic")) pts.push(C.skagen);
    if (r1("nwEurope") || r2("nwEurope")) pts.push(C.englishCh);
    pts.push(C.gibraltar, C.suezN, C.suezS, C.babElMandeb);
    if (r1("india") || r2("india")) { /* direct after Bab */ }
    else if (r1("australia") || r2("australia")) {
      pts.push(C.sriLanka, C.lombok);
    } else {
      pts.push(C.sriLanka, C.malacca, C.singapore);
      if (r1("china") || r2("china") || r1("japan") || r2("japan")) pts.push(C.southChinaSea);
    }
    if (!goEast) pts.reverse();
    wp.push(...pts);
  }
  
  // ═══ EUROPE ↔ MIDDLE EAST / PERSIAN GULF ═══
  else if (route("europe", "mideast") || route("europe", "persian")) {
    const goEast = lon1 < lon2;
    const pts: [number, number][] = [C.gibraltar, C.suezN, C.suezS, C.babElMandeb];
    if (r1("persian") || r2("persian")) pts.push(C.hormuz);
    if (!goEast) pts.reverse();
    wp.push(...pts);
  }
  
  // ═══ AUSTRALIA ↔ EAST ASIA ═══
  else if (route("australia", "eastAsia") || route("australia", "japan") || route("australia", "china")) {
    if (r1("auEast") || r2("auEast")) {
      // East AU: go east of Philippines/PNG
      const pts: [number, number][] = [C.eastPNG, C.eastPhilippines];
      if (r1("japan") || r2("japan")) pts.push(C.koreaStrait);
      if (lon1 > lon2) pts.reverse();
      wp.push(...pts);
    } else {
      // West AU: via Lombok + Singapore + SCS
      const pts: [number, number][] = [C.lombok, C.singapore, C.southChinaSea];
      if (lon1 > lon2) pts.reverse();
      wp.push(...pts);
    }
  }
  
  // ═══ AUSTRALIA ↔ INDIA / MIDDLE EAST ═══
  else if (route("australia", "india") || route("australia", "mideast") || route("australia", "persian")) {
    const pts: [number, number][] = [C.lombok, C.sriLanka];
    if (r1("persian") || r2("persian")) pts.push(C.hormuz);
    if (lon1 > lon2) pts.reverse();
    wp.push(...pts);
  }
  
  // ═══ US EAST / GULF ↔ ASIA ═══
  else if (route("usEast", "eastAsia") || route("usEast", "japan") || route("usGulf", "eastAsia") || route("usGulf", "japan")) {
    wp.push(C.panama, C.panamaPacific);
    wp.push(C.hawaii);
  }
  
  // ═══ US EAST ↔ EUROPE ═══
  else if (route("usEast", "europe") || route("usGulf", "europe")) {
    wp.push(C.azores);
  }
  
  // ═══ BRAZIL ↔ ASIA ═══
  else if (route("brazil", "eastAsia") || route("brazil", "china") || route("brazil", "japan")) {
    wp.push(C.capeGoodHope, C.sriLanka, C.malacca, C.singapore);
  }
  
  // ═══ BRAZIL ↔ EUROPE ═══
  else if (route("brazil", "europe")) {
    wp.push(C.canaryIs);
  }
  
  // ═══ EAST AFRICA ↔ ASIA ═══
  else if (route("eAfrica", "eastAsia") || route("eAfrica", "india") || route("eAfrica", "seAsia")) {
    wp.push(C.northMadagascar, C.sriLanka);
    if (r1("seAsia") || r2("seAsia") || r1("eastAsia") || r2("eastAsia")) wp.push(C.malacca);
  }
  
  // ═══ ARGENTINA ↔ EUROPE ═══  
  else if (route("argentina", "europe")) {
    wp.push(C.recife, C.canaryIs);
  }
  
  // ═══ US WEST ↔ ASIA ═══
  else if (route("usWest", "eastAsia") || route("usWest", "japan") || route("usWest", "china")) {
    wp.push(C.hawaii);
  }
  
  // ═══ BALTIC special ═══
  else if (r1("baltic") !== r2("baltic") && (r1("baltic") || r2("baltic"))) {
    wp.push(C.skagen);
  }
  
  // ═══ ENGLISH CHANNEL ═══
  else if (route("nwEurope", "med") || (r1("nwEurope") && lon2 < -10) || (r2("nwEurope") && lon1 < -10)) {
    wp.push(C.englishCh);
  }
  
  // ═══ FALLBACK: Check great circle segments for land crossings ═══
  // If no specific route was matched above, check for common land barriers
  if (wp.length <= 1) {
    // Define land barriers as boxes: if a GC line crosses these, insert waypoint
    const barriers: Array<{name: string; latMin:number; latMax:number; lonMin:number; lonMax:number; wp:[number,number]}> = [
      // Indonesia/Malaysia/Philippines barrier
      {name:"Indonesia-W", latMin:-10, latMax:5, lonMin:95, lonMax:120, wp:[1.2, 103.8]},    // Singapore
      {name:"Indonesia-E", latMin:-10, latMax:5, lonMin:120, lonMax:140, wp:[-5.0, 155.0]},   // east of PNG
      {name:"Philippines", latMin:5, latMax:20, lonMin:117, lonMax:127, wp:[15.0, 128.0]},     // east of PH
      // India
      {name:"India-S", latMin:5, latMax:22, lonMin:72, lonMax:88, wp:[6.0, 80.0]},            // south of Sri Lanka
      // Arabian Peninsula
      {name:"Arabia", latMin:12, latMax:30, lonMin:35, lonMax:56, wp:[12.5, 43.5]},            // Bab el-Mandeb
      // Africa
      {name:"Africa-W", latMin:-35, latMax:5, lonMin:-20, lonMax:20, wp:[-34.4, 18.5]},       // Cape Good Hope
      {name:"Africa-E", latMin:-15, latMax:12, lonMin:30, lonMax:52, wp:[-12.0, 49.0]},       // north Madagascar
      // Central America
      {name:"CentralAm", latMin:5, latMax:20, lonMin:-90, lonMax:-75, wp:[9.0, -79.5]},       // Panama
      // Italy/Greece  
      {name:"Italy", latMin:37, latMax:45, lonMin:8, lonMax:20, wp:[36.5, 15.0]},             // south of Sicily
      // Malay Peninsula
      {name:"Malay", latMin:1, latMax:8, lonMin:99, lonMax:105, wp:[1.2, 103.8]},             // Singapore
      // Japan (Honshu)
      {name:"Japan", latMin:33, latMax:42, lonMin:130, lonMax:142, wp:[30.0, 132.0]},         // south of Japan
      // Scandinavia/Denmark
      {name:"Denmark", latMin:54, latMax:58, lonMin:8, lonMax:13, wp:[57.7, 10.6]},           // Skagen
      // Australia (north)
      {name:"Australia-N", latMin:-20, latMax:-10, lonMin:120, lonMax:145, wp:[-8.5, 115.7]},  // Lombok
      // Suez (land bridge)
      {name:"Suez", latMin:28, latMax:33, lonMin:30, lonMax:36, wp:[31.3, 32.3]},             // Suez Canal
      // Taiwan
      {name:"Taiwan", latMin:22, latMax:26, lonMin:119, lonMax:122, wp:[21.5, 121.5]},        // south of Taiwan
      // New Zealand
      {name:"NZ", latMin:-47, latMax:-34, lonMin:166, lonMax:178, wp:[-48.0, 166.0]},         // south of NZ
      // Madagascar
      {name:"Madagascar", latMin:-26, latMax:-12, lonMin:43, lonMax:50, wp:[-12.0, 49.0]},    // north of Madagascar
      // UK / Ireland
      {name:"UK", latMin:50, latMax:59, lonMin:-11, lonMax:2, wp:[50.0, -1.5]},               // English Channel
    ];
    
    // Check if GC from start to end crosses any barrier
    const gcMid = [(lat1+lat2)/2, (lon1+lon2)/2];
    const crossesBarrier = (b: typeof barriers[0]) => {
      // Simple check: does the midpoint or any interpolated point fall in the barrier box?
      for (let f = 0.1; f <= 0.9; f += 0.1) {
        const pLat = lat1 + (lat2 - lat1) * f;
        const pLon = lon1 + (lon2 - lon1) * f;
        if (pLat >= b.latMin && pLat <= b.latMax && pLon >= b.lonMin && pLon <= b.lonMax) {
          // Check that start and end are on DIFFERENT sides of the barrier
          const startIn = lat1 >= b.latMin && lat1 <= b.latMax && lon1 >= b.lonMin && lon1 <= b.lonMax;
          const endIn = lat2 >= b.latMin && lat2 <= b.latMax && lon2 >= b.lonMin && lon2 <= b.lonMax;
          if (!startIn && !endIn) return true; // crosses through, neither endpoint is in it
          if (startIn !== endIn) return true; // one side in, one out
        }
      }
      return false;
    };
    
    const crossedBarriers = barriers.filter(b => crossesBarrier(b));
    if (crossedBarriers.length > 0) {
      // Sort waypoints by distance from start
      const dist = (p: [number,number]) => Math.sqrt((p[0]-lat1)**2 + (p[1]-lon1)**2);
      const sorted = crossedBarriers.map(b => b.wp).sort((a, b) => dist(a) - dist(b));
      wp.push(...sorted);
    }
  }
  
  wp.push([lat2, lon2]);
  return wp;
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

    // Build sea route with waypoints to avoid land
    const waypoints = findSeaRoute(fromLat, fromLon, toLat, toLon);
    let gcPoints: [number, number][] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const seg = greatCirclePoints(waypoints[i][0], waypoints[i][1], waypoints[i+1][0], waypoints[i+1][1], 20);
      if (i > 0) seg.shift(); // avoid duplicate points
      gcPoints = gcPoints.concat(seg);
    }

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
        <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);padding:2px 6px;background:rgba(15,23,42,0.9);border:1px solid rgba(16,185,129,0.3);border-radius:3px;white-space:nowrap;font-size:10px;color:#e2e8f0;font-family:system-ui"><span style="color:#10b981;font-weight:600">${daysRemaining}d</span> <span style="color:#94a3b8">remaining</span></div>
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
