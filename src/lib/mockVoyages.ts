// Mock-Route und Ladungs-Schätzung für Bulk Carrier
// In der späteren Live-Version: AIS-Daten von AISHub.net

import type { Ship, BulkCarrierType } from "@/data/ships";

// Wichtige Bulk-Handelshäfen weltweit mit Koordinaten
export interface Port {
  code: string;
  name: string;
  country: string;
  countryFlag: string;
  lat: number;
  lon: number;
  primaryCargo: CargoType;
}

export type CargoType =
  | "iron_ore"
  | "coal"
  | "grain"
  | "bauxite"
  | "alumina"
  | "cement"
  | "fertilizer"
  | "steel"
  | "scrap"
  | "sulfur"
  | "salt"
  | "lumber"
  | "empty";

// Top 30 Bulk-Handelshäfen (echte Daten)
export const PORTS: Port[] = [
  // === Iron Ore Export ===
  { code: "PDA", name: "Port Hedland", country: "Australia", countryFlag: "🇦🇺", lat: -20.312, lon: 118.608, primaryCargo: "iron_ore" },
  { code: "DKG", name: "Dampier", country: "Australia", countryFlag: "🇦🇺", lat: -20.661, lon: 116.711, primaryCargo: "iron_ore" },
  { code: "TUB", name: "Tubarão (Vitória)", country: "Brazil", countryFlag: "🇧🇷", lat: -20.323, lon: -40.283, primaryCargo: "iron_ore" },
  { code: "PNT", name: "Ponta da Madeira", country: "Brazil", countryFlag: "🇧🇷", lat: -2.533, lon: -44.367, primaryCargo: "iron_ore" },
  { code: "SDL", name: "Saldanha Bay", country: "South Africa", countryFlag: "🇿🇦", lat: -33.024, lon: 17.945, primaryCargo: "iron_ore" },

  // === Coal Export ===
  { code: "NCT", name: "Newcastle", country: "Australia", countryFlag: "🇦🇺", lat: -32.927, lon: 151.776, primaryCargo: "coal" },
  { code: "GLT", name: "Gladstone", country: "Australia", countryFlag: "🇦🇺", lat: -23.848, lon: 151.272, primaryCargo: "coal" },
  { code: "RGT", name: "Richards Bay", country: "South Africa", countryFlag: "🇿🇦", lat: -28.801, lon: 32.078, primaryCargo: "coal" },
  { code: "TJP", name: "Tanjung Bara", country: "Indonesia", countryFlag: "🇮🇩", lat: -0.85, lon: 117.45, primaryCargo: "coal" },
  { code: "BAN", name: "Balikpapan", country: "Indonesia", countryFlag: "🇮🇩", lat: -1.237, lon: 116.825, primaryCargo: "coal" },

  // === Grain Export ===
  { code: "NOR", name: "Norfolk (VA)", country: "USA", countryFlag: "🇺🇸", lat: 36.846, lon: -76.286, primaryCargo: "grain" },
  { code: "NOL", name: "New Orleans", country: "USA", countryFlag: "🇺🇸", lat: 29.950, lon: -90.067, primaryCargo: "grain" },
  { code: "PDX", name: "Portland (OR)", country: "USA", countryFlag: "🇺🇸", lat: 45.590, lon: -122.833, primaryCargo: "grain" },
  { code: "BAH", name: "Bahía Blanca", country: "Argentina", countryFlag: "🇦🇷", lat: -38.799, lon: -62.267, primaryCargo: "grain" },
  { code: "PRG", name: "Paranaguá", country: "Brazil", countryFlag: "🇧🇷", lat: -25.501, lon: -48.517, primaryCargo: "grain" },
  { code: "ROS", name: "Rosario", country: "Argentina", countryFlag: "🇦🇷", lat: -32.944, lon: -60.639, primaryCargo: "grain" },

  // === Iron Ore Import (Asia) ===
  { code: "QIN", name: "Qingdao", country: "China", countryFlag: "🇨🇳", lat: 36.067, lon: 120.383, primaryCargo: "iron_ore" },
  { code: "NBO", name: "Ningbo-Zhoushan", country: "China", countryFlag: "🇨🇳", lat: 29.873, lon: 121.883, primaryCargo: "iron_ore" },
  { code: "SHA", name: "Shanghai", country: "China", countryFlag: "🇨🇳", lat: 31.230, lon: 121.474, primaryCargo: "iron_ore" },
  { code: "TJN", name: "Tianjin", country: "China", countryFlag: "🇨🇳", lat: 38.975, lon: 117.778, primaryCargo: "iron_ore" },
  { code: "RNO", name: "Rizhao", country: "China", countryFlag: "🇨🇳", lat: 35.382, lon: 119.527, primaryCargo: "iron_ore" },

  // === Europe ===
  { code: "RTM", name: "Rotterdam", country: "Netherlands", countryFlag: "🇳🇱", lat: 51.924, lon: 4.479, primaryCargo: "coal" },
  { code: "AMP", name: "Amsterdam", country: "Netherlands", countryFlag: "🇳🇱", lat: 52.379, lon: 4.900, primaryCargo: "coal" },
  { code: "HAM", name: "Hamburg", country: "Germany", countryFlag: "🇩🇪", lat: 53.539, lon: 9.980, primaryCargo: "coal" },
  { code: "ANR", name: "Antwerp", country: "Belgium", countryFlag: "🇧🇪", lat: 51.260, lon: 4.400, primaryCargo: "coal" },
  { code: "IJM", name: "IJmuiden", country: "Netherlands", countryFlag: "🇳🇱", lat: 52.464, lon: 4.602, primaryCargo: "iron_ore" },

  // === Other Asian ===
  { code: "YOK", name: "Yokohama", country: "Japan", countryFlag: "🇯🇵", lat: 35.444, lon: 139.638, primaryCargo: "coal" },
  { code: "CHB", name: "Chiba", country: "Japan", countryFlag: "🇯🇵", lat: 35.605, lon: 140.083, primaryCargo: "iron_ore" },
  { code: "POH", name: "Pohang", country: "South Korea", countryFlag: "🇰🇷", lat: 35.977, lon: 129.578, primaryCargo: "iron_ore" },
  { code: "KRP", name: "Krishnapatnam", country: "India", countryFlag: "🇮🇳", lat: 14.253, lon: 80.130, primaryCargo: "coal" },
  { code: "MAA", name: "Mumbai", country: "India", countryFlag: "🇮🇳", lat: 19.076, lon: 72.876, primaryCargo: "coal" },
  { code: "SIN", name: "Singapore", country: "Singapore", countryFlag: "🇸🇬", lat: 1.264, lon: 103.840, primaryCargo: "empty" },

  // === Bauxite / Alumina ===
  { code: "KMB", name: "Kamsar", country: "Guinea", countryFlag: "🇬🇳", lat: 10.636, lon: -14.602, primaryCargo: "bauxite" },
  { code: "WEP", name: "Weipa", country: "Australia", countryFlag: "🇦🇺", lat: -12.667, lon: 141.867, primaryCargo: "bauxite" },

  // === Cement / Fertilizer ===
  { code: "DAM", name: "Damman", country: "Saudi Arabia", countryFlag: "🇸🇦", lat: 26.435, lon: 50.110, primaryCargo: "fertilizer" },
  { code: "JEA", name: "Jebel Ali", country: "UAE", countryFlag: "🇦🇪", lat: 25.012, lon: 55.067, primaryCargo: "fertilizer" },

  // === Americas Import ===
  { code: "MIA", name: "Miami", country: "USA", countryFlag: "🇺🇸", lat: 25.775, lon: -80.167, primaryCargo: "empty" },
  { code: "LGB", name: "Long Beach", country: "USA", countryFlag: "🇺🇸", lat: 33.770, lon: -118.194, primaryCargo: "empty" },
];

// Typische Bulk-Handelsrouten (Quelle → Ziel + primäre Ladung)
interface TradeRoute {
  from: string;
  to: string;
  cargo: CargoType;
  typicalShipType: BulkCarrierType[];
  durationDays: number;
  probability: number; // Wie wahrscheinlich ist diese Route für einen Bulk Carrier
}

const TRADE_ROUTES: TradeRoute[] = [
  // Australia → China (Iron Ore)
  { from: "PDA", to: "QIN", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax", "VLOC", "Valemax"], durationDays: 12, probability: 25 },
  { from: "PDA", to: "NBO", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax", "VLOC", "Valemax"], durationDays: 13, probability: 20 },
  { from: "PDA", to: "SHA", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax", "VLOC"], durationDays: 13, probability: 18 },
  { from: "PDA", to: "RNO", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax", "VLOC"], durationDays: 12, probability: 15 },
  { from: "DKG", to: "QIN", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax", "VLOC"], durationDays: 12, probability: 12 },
  { from: "DKG", to: "POH", cargo: "iron_ore", typicalShipType: ["Capesize", "Newcastlemax"], durationDays: 13, probability: 10 },
  // Brazil → China (Iron Ore, Valemax mostly)
  { from: "TUB", to: "QIN", cargo: "iron_ore", typicalShipType: ["Valemax", "VLOC"], durationDays: 40, probability: 8 },
  { from: "TUB", to: "NBO", cargo: "iron_ore", typicalShipType: ["Valemax", "VLOC"], durationDays: 41, probability: 7 },
  { from: "PNT", to: "QIN", cargo: "iron_ore", typicalShipType: ["Valemax", "VLOC"], durationDays: 38, probability: 6 },
  { from: "PNT", to: "NBO", cargo: "iron_ore", typicalShipType: ["Valemax", "VLOC"], durationDays: 39, probability: 6 },
  // Australia → Japan/Korea (Coal)
  { from: "NCT", to: "YOK", cargo: "coal", typicalShipType: ["Capesize", "Panamax"], durationDays: 12, probability: 10 },
  { from: "NCT", to: "CHB", cargo: "coal", typicalShipType: ["Capesize", "Panamax"], durationDays: 13, probability: 8 },
  { from: "NCT", to: "POH", cargo: "coal", typicalShipType: ["Capesize", "Panamax"], durationDays: 13, probability: 7 },
  { from: "GLT", to: "YOK", cargo: "coal", typicalShipType: ["Panamax", "Handymax"], durationDays: 13, probability: 6 },
  // Indonesia → India/China (Coal)
  { from: "BAN", to: "KRP", cargo: "coal", typicalShipType: ["Panamax", "Handymax", "Handysize"], durationDays: 8, probability: 8 },
  { from: "TJP", to: "QIN", cargo: "coal", typicalShipType: ["Panamax", "Handymax"], durationDays: 7, probability: 7 },
  { from: "BAN", to: "QIN", cargo: "coal", typicalShipType: ["Panamax", "Handymax"], durationDays: 9, probability: 6 },
  // South Africa → Europe/Asia (Coal)
  { from: "RGT", to: "RTM", cargo: "coal", typicalShipType: ["Capesize", "Panamax"], durationDays: 18, probability: 6 },
  { from: "RGT", to: "HAM", cargo: "coal", typicalShipType: ["Capesize", "Panamax"], durationDays: 19, probability: 5 },
  // US Grain → Asia/Europe
  { from: "NOL", to: "QIN", cargo: "grain", typicalShipType: ["Panamax", "Handymax"], durationDays: 30, probability: 6 },
  { from: "NOR", to: "RTM", cargo: "grain", typicalShipType: ["Panamax", "Handymax"], durationDays: 14, probability: 5 },
  { from: "PDX", to: "YOK", cargo: "grain", typicalShipType: ["Panamax", "Handymax"], durationDays: 16, probability: 5 },
  // South America Grain
  { from: "PRG", to: "QIN", cargo: "grain", typicalShipType: ["Panamax", "Handymax", "Kamsarmax"], durationDays: 38, probability: 5 },
  { from: "BAH", to: "RTM", cargo: "grain", typicalShipType: ["Panamax", "Handymax", "Kamsarmax"], durationDays: 18, probability: 4 },
  // Bauxite
  { from: "KMB", to: "QIN", cargo: "bauxite", typicalShipType: ["Capesize", "Panamax"], durationDays: 35, probability: 4 },
  { from: "WEP", to: "YOK", cargo: "bauxite", typicalShipType: ["Panamax", "Handymax"], durationDays: 13, probability: 3 },
  // Europe imports (Iron Ore)
  { from: "TUB", to: "IJM", cargo: "iron_ore", typicalShipType: ["Capesize", "VLOC"], durationDays: 18, probability: 4 },
  { from: "TUB", to: "RTM", cargo: "iron_ore", typicalShipType: ["Capesize", "VLOC"], durationDays: 18, probability: 4 },
];

// Pseudo-random Zahl basierend auf Ship-ID (für reproduzierbare Mock-Daten)
function seededRandom(imo: string): number {
  let hash = 0;
  for (let i = 0; i < imo.length; i++) {
    hash = ((hash << 5) - hash + imo.charCodeAt(i)) | 0;
  }
  // Convert to 0-1
  return Math.abs(hash % 10000) / 10000;
}

function pickRoute(ship: Ship): TradeRoute | null {
  const compatibleRoutes = TRADE_ROUTES.filter(
    (r) => r.typicalShipType.includes(ship.type),
  );
  if (compatibleRoutes.length === 0) return null;

  // Gewichtete Zufallsauswahl basierend auf probability
  const totalWeight = compatibleRoutes.reduce(
    (sum, r) => sum + r.probability,
    0,
  );
  const rand = seededRandom(ship.imo + "route") * totalWeight;
  let cumulative = 0;
  for (const route of compatibleRoutes) {
    cumulative += route.probability;
    if (rand <= cumulative) return route;
  }
  return compatibleRoutes[0];
}

export interface MockVoyage {
  from: Port;
  to: Port;
  cargo: CargoType;
  cargoDescription: string;
  cargoLoadPercent: number; // 0-100, wie voll
  currentStatus: VoyageStatus;
  currentPosition: { lat: number; lon: number };
  progressPercent: number; // 0-100
  speedKnots: number;
  eta: Date;
  departureDate: Date;
  durationDays: number;
  distanceNm: number;
  vesselActivity: string;
}

export type VoyageStatus =
  | "under_way_loaded"
  | "under_way_ballast"
  | "at_anchor"
  | "moored_loading"
  | "moored_discharging"
  | "in_port";

export function getCargoDescription(cargo: CargoType): string {
  const descriptions: Record<CargoType, string> = {
    iron_ore: "Iron Ore",
    coal: "Coal",
    grain: "Grain",
    bauxite: "Bauxite",
    alumina: "Alumina",
    cement: "Cement",
    fertilizer: "Fertilizer",
    steel: "Steel Products",
    scrap: "Scrap Metal",
    sulfur: "Sulfur",
    salt: "Salt",
    lumber: "Lumber",
    empty: "Ballast Voyage (empty)",
  };
  return descriptions[cargo] || "Unknown";
}

// Haversine-Formel für Distanz zwischen zwei Koordinaten
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Interpoliere Position zwischen zwei Häfen
function interpolatePosition(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  progress: number,
): { lat: number; lon: number } {
  // Berücksichtige, dass Schiffe nicht geradeaus fahren — slight offset
  const lat = lat1 + (lat2 - lat1) * progress;
  let lon = lon1 + (lon2 - lon1) * progress;
  // Wenn die Differenz > 180, kürzerer Pfad über Datumsgrenze
  if (Math.abs(lon2 - lon1) > 180) {
    if (lon2 > lon1) {
      lon = lon1 + (lon2 - lon1 - 360) * progress;
    } else {
      lon = lon1 + (lon2 - lon1 + 360) * progress;
    }
    if (lon < -180) lon += 360;
    if (lon > 180) lon -= 360;
  }
  return { lat, lon };
}

export function generateMockVoyage(ship: Ship): MockVoyage {
  const route = pickRoute(ship);
  if (!route) {
    // Fallback: Ship liegt im Hafen
    const port = PORTS[Math.floor(seededRandom(ship.imo + "port") * PORTS.length)];
    return {
      from: port,
      to: PORTS[(Math.floor(seededRandom(ship.imo + "dest") * (PORTS.length - 1)) + 1 + Math.floor(seededRandom(ship.imo + "port") * PORTS.length)) % PORTS.length],
      cargo: "empty",
      cargoDescription: "In Port",
      cargoLoadPercent: 0,
      currentStatus: "in_port",
      currentPosition: { lat: port.lat, lon: port.lon },
      progressPercent: 0,
      speedKnots: 0,
      eta: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      departureDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      durationDays: 0,
      distanceNm: 0,
      vesselActivity: `In port at ${port.name}`,
    };
  }

  const fromPort = PORTS.find((p) => p.code === route.from)!;
  const toPort = PORTS.find((p) => p.code === route.to)!;
  const distance = haversineDistance(
    fromPort.lat,
    fromPort.lon,
    toPort.lat,
    toPort.lon,
  );
  // Realistische Dauer: Distanz / Geschwindigkeit (12-14 Knoten)
  const realDurationDays = Math.round(distance / 13 / 24);
  const durationDays = Math.max(realDurationDays, route.durationDays);

  // Pseudo-zufälliger Fortschritt (0-100)
  const rand = seededRandom(ship.imo + "progress");
  const progressPercent = Math.round(5 + rand * 90); // 5-95%

  // Status basierend auf progress
  let status: VoyageStatus;
  let cargoLoadPercent: number;
  let speedKnots: number;
  let vesselActivity: string;
  let departureDate: Date;

  if (progressPercent < 5) {
    status = "moored_loading";
    cargoLoadPercent = Math.round(progressPercent * 20); // 0-100% while loading
    speedKnots = 0;
    vesselActivity = `Loading at ${fromPort.name}`;
    departureDate = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6h ago
  } else if (progressPercent > 95) {
    status = "moored_discharging";
    cargoLoadPercent = Math.round((100 - progressPercent) * 20);
    speedKnots = 0;
    vesselActivity = `Discharging at ${toPort.name}`;
    departureDate = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);
  } else {
    status = "under_way_loaded";
    cargoLoadPercent = 95; // fast voll
    speedKnots = 11 + Math.round(seededRandom(ship.imo + "speed") * 4); // 11-15 kn
    vesselActivity = `Under way from ${fromPort.name} to ${toPort.name}`;
    departureDate = new Date(
      Date.now() - (progressPercent / 100) * durationDays * 24 * 60 * 60 * 1000,
    );
  }

  // Aktuelle Position
  const currentPos = interpolatePosition(
    fromPort.lat,
    fromPort.lon,
    toPort.lat,
    toPort.lon,
    progressPercent / 100,
  );

  // ETA
  const remainingDays = (durationDays * (100 - progressPercent)) / 100;
  const eta = new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);

  return {
    from: fromPort,
    to: toPort,
    cargo: route.cargo,
    cargoDescription: getCargoDescription(route.cargo),
    cargoLoadPercent,
    currentStatus: status,
    currentPosition: currentPos,
    progressPercent,
    speedKnots,
    eta,
    departureDate,
    durationDays,
    distanceNm: Math.round(distance),
    vesselActivity,
  };
}

export function getStatusColor(status: VoyageStatus): string {
  switch (status) {
    case "under_way_loaded":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "under_way_ballast":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "at_anchor":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "moored_loading":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "moored_discharging":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    case "in_port":
      return "bg-stone-500/15 text-stone-700 dark:text-stone-400 border-stone-500/30";
  }
}

export function getStatusLabel(status: VoyageStatus): string {
  switch (status) {
    case "under_way_loaded":
      return "Under Way (Loaded)";
    case "under_way_ballast":
      return "Under Way (Ballast)";
    case "at_anchor":
      return "At Anchor";
    case "moored_loading":
      return "Loading";
    case "moored_discharging":
      return "Discharging";
    case "in_port":
      return "In Port";
  }
}
