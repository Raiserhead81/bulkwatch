// Major bunkering hubs worldwide — lat/lon, fuels, typical prices relative to Singapore

export interface BunkerPort {
  name: string;
  country: string;
  lat: number;
  lon: number;
  fuels: ("VLSFO" | "HSFO" | "MGO")[];
  priceKey?: string; // key prefix in opex_rates.json bunkerByPort
  relativePremium: number; // % vs Singapore (0 = same)
  minStem: number; // minimum stem in tons
  notes?: string;
}

export const BUNKER_PORTS: BunkerPort[] = [
  // Asia
  { name: "Singapore", country: "SG", lat: 1.26, lon: 103.84, fuels: ["VLSFO","HSFO","MGO"], priceKey: "singapore", relativePremium: 0, minStem: 200, notes: "World's largest bunkering hub" },
  { name: "Busan", country: "KR", lat: 35.10, lon: 129.03, fuels: ["VLSFO","HSFO","MGO"], priceKey: "busan", relativePremium: 2, minStem: 300 },
  { name: "Hong Kong", country: "HK", lat: 22.30, lon: 114.17, fuels: ["VLSFO","HSFO","MGO"], priceKey: "hong_kong", relativePremium: 2, minStem: 200 },
  { name: "Zhoushan", country: "CN", lat: 29.98, lon: 122.20, fuels: ["VLSFO","MGO"], relativePremium: -3, minStem: 500, notes: "DECA zone — HSFO restricted" },
  { name: "Kaohsiung", country: "TW", lat: 22.62, lon: 120.30, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 3, minStem: 300 },
  { name: "Port Klang", country: "MY", lat: 3.00, lon: 101.39, fuels: ["VLSFO","HSFO","MGO"], relativePremium: -1, minStem: 250 },
  // Middle East
  { name: "Fujairah", country: "AE", lat: 25.12, lon: 56.36, fuels: ["VLSFO","HSFO","MGO"], priceKey: "fujairah", relativePremium: 14, minStem: 200, notes: "Key hub for AG/Indian Ocean routes" },
  { name: "Jebel Ali", country: "AE", lat: 25.01, lon: 55.06, fuels: ["VLSFO","MGO"], relativePremium: 15, minStem: 300 },
  // Europe
  { name: "Rotterdam", country: "NL", lat: 51.90, lon: 4.50, fuels: ["VLSFO","HSFO","MGO"], priceKey: "rotterdam", relativePremium: -11, minStem: 100, notes: "Europe's largest bunkering port" },
  { name: "Gibraltar", country: "GI", lat: 36.14, lon: -5.35, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 5, minStem: 150, notes: "Med/Atlantic crossroads" },
  { name: "Algeciras", country: "ES", lat: 36.13, lon: -5.45, fuels: ["VLSFO","MGO"], relativePremium: 4, minStem: 200 },
  { name: "Malta (Marsaxlokk)", country: "MT", lat: 35.83, lon: 14.53, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 6, minStem: 200 },
  { name: "Piraeus", country: "GR", lat: 37.94, lon: 23.63, fuels: ["VLSFO","MGO"], relativePremium: 8, minStem: 200 },
  { name: "Istanbul", country: "TR", lat: 41.00, lon: 28.98, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 5, minStem: 200 },
  { name: "ARA (Antwerp)", country: "BE", lat: 51.22, lon: 4.40, fuels: ["VLSFO","HSFO","MGO"], relativePremium: -10, minStem: 100 },
  // Africa
  { name: "Durban", country: "ZA", lat: -29.87, lon: 31.05, fuels: ["VLSFO","MGO"], relativePremium: 10, minStem: 300 },
  { name: "Las Palmas", country: "ES", lat: 28.13, lon: -15.43, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 7, minStem: 200, notes: "West Africa route hub" },
  { name: "Lomé", country: "TG", lat: 6.13, lon: 1.35, fuels: ["VLSFO","MGO"], relativePremium: 15, minStem: 500 },
  // Americas
  { name: "Houston", country: "US", lat: 29.76, lon: -95.36, fuels: ["VLSFO","HSFO","MGO"], relativePremium: -5, minStem: 300 },
  { name: "New Orleans", country: "US", lat: 29.95, lon: -90.07, fuels: ["VLSFO","MGO"], relativePremium: -3, minStem: 300 },
  { name: "Santos", country: "BR", lat: -23.96, lon: -46.30, fuels: ["VLSFO","MGO"], relativePremium: 12, minStem: 300 },
  { name: "Balboa (Panama)", country: "PA", lat: 8.95, lon: -79.56, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 8, minStem: 200, notes: "Panama Canal transit" },
  { name: "Cristóbal (Panama)", country: "PA", lat: 9.35, lon: -79.90, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 8, minStem: 200 },
  // Indian Ocean
  { name: "Colombo", country: "LK", lat: 6.93, lon: 79.84, fuels: ["VLSFO","HSFO","MGO"], relativePremium: 5, minStem: 250 },
  // Oceania
  { name: "Port Hedland", country: "AU", lat: -20.31, lon: 118.58, fuels: ["VLSFO","MGO"], relativePremium: 18, minStem: 500, notes: "Iron ore export — limited bunker" },
];

// Tank capacity estimates by ship type (tons)
// Source: MAN Energy Solutions, typical fuel oil tank capacities
export const TANK_CAPACITY: Record<string, { min: number; typical: number; max: number }> = {
  "Capesize":       { min: 4000, typical: 5000, max: 6500 },
  "Newcastlemax":   { min: 4500, typical: 5500, max: 7000 },
  "Kamsarmax":      { min: 2000, typical: 2800, max: 3500 },
  "Panamax":        { min: 1800, typical: 2500, max: 3200 },
  "Post-Panamax":   { min: 2500, typical: 3500, max: 4500 },
  "Ultramax":       { min: 1500, typical: 2200, max: 2800 },
  "Supramax":       { min: 1400, typical: 2000, max: 2600 },
  "Handymax":       { min: 1200, typical: 1800, max: 2400 },
  "Handysize":      { min: 800,  typical: 1200, max: 1600 },
  "Mini-Bulker":    { min: 400,  typical: 600,  max: 900 },
  "VLCC":           { min: 6000, typical: 8000, max: 10000 },
  "Suezmax":        { min: 3500, typical: 4500, max: 5500 },
  "Aframax":        { min: 2800, typical: 3500, max: 4500 },
  "Product Tanker": { min: 1500, typical: 2200, max: 3000 },
  "Chemical Tanker":{ min: 1000, typical: 1500, max: 2200 },
  "Container Ship": { min: 4000, typical: 6000, max: 9000 },
  "LNG Tanker":     { min: 3000, typical: 4500, max: 6000 },
  "LPG Tanker":     { min: 2500, typical: 3500, max: 4500 },
  "General Cargo":  { min: 500,  typical: 800,  max: 1200 },
};

// Haversine distance in nautical miles
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nm
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Find bunker ports within maxDetourNm of route waypoints
export function findBunkerPortsAlongRoute(
  waypoints: [number, number][], // [lon, lat] from GeoJSON
  maxDetourNm: number = 150
): (BunkerPort & { detourNm: number; nearestWaypointIdx: number })[] {
  const results: (BunkerPort & { detourNm: number; nearestWaypointIdx: number })[] = [];
  
  for (const port of BUNKER_PORTS) {
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < waypoints.length; i++) {
      const [lon, lat] = waypoints[i];
      const d = haversineNm(port.lat, port.lon, lat, lon);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    if (minDist <= maxDetourNm) {
      results.push({ ...port, detourNm: Math.round(minDist), nearestWaypointIdx: nearestIdx });
    }
  }
  
  // Sort by position along route
  return results.sort((a, b) => a.nearestWaypointIdx - b.nearestWaypointIdx);
}
