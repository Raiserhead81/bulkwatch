// ═══════════════════════════════════════════════════════════════
// PORT CALL COSTS BY REGION — Broker Level
// All costs in USD per call for a reference Handysize (35k DWT)
// Scale with DWT for other sizes
// Sources: Inchcape Shipping Services, GAC, Wilhelmsen,
//          Port Authority tariff sheets, broker proformas
// ═══════════════════════════════════════════════════════════════

export interface PortCallCost {
  region: string;
  country: string;
  portDuesPerGT: number;     // $/GT
  pilotageIn: number;        // flat + per move
  pilotageOut: number;
  towageIn: number;          // per tug, typically 2 tugs
  towageOut: number;
  agencyFee: number;
  sludgeDisposal: number;    // $/m³, typically 5-20m³
  freshWater: number;        // $/ton
  lighthouseDues: number;
  quarantineHealth: number;
  miscCharges: number;       // stamps, documentation, comms
  totalEstimate35kDWT: number; // pre-calculated for Handysize
}

// Regional port cost profiles
export const PORT_REGIONS: PortCallCost[] = [
  // ═══ EUROPE ═══
  {
    region: "NW Europe", country: "Netherlands/Belgium/Germany",
    portDuesPerGT: 0.45, pilotageIn: 3500, pilotageOut: 3500,
    towageIn: 4500, towageOut: 4000, agencyFee: 2800,
    sludgeDisposal: 250, freshWater: 12, lighthouseDues: 1200,
    quarantineHealth: 0, miscCharges: 800,
    totalEstimate35kDWT: 30000,
  },
  {
    region: "Mediterranean", country: "Italy/Spain/Greece",
    portDuesPerGT: 0.35, pilotageIn: 2800, pilotageOut: 2800,
    towageIn: 3500, towageOut: 3000, agencyFee: 2200,
    sludgeDisposal: 200, freshWater: 10, lighthouseDues: 800,
    quarantineHealth: 200, miscCharges: 600,
    totalEstimate35kDWT: 24000,
  },
  {
    region: "UK/Ireland", country: "United Kingdom/Ireland",
    portDuesPerGT: 0.50, pilotageIn: 4000, pilotageOut: 4000,
    towageIn: 5000, towageOut: 4500, agencyFee: 3200,
    sludgeDisposal: 300, freshWater: 15, lighthouseDues: 1500,
    quarantineHealth: 0, miscCharges: 1000,
    totalEstimate35kDWT: 33000,
  },
  {
    region: "Baltic/Scandinavia", country: "Sweden/Finland/Denmark",
    portDuesPerGT: 0.55, pilotageIn: 3800, pilotageOut: 3800,
    towageIn: 4200, towageOut: 3800, agencyFee: 3000,
    sludgeDisposal: 280, freshWater: 14, lighthouseDues: 1800,
    quarantineHealth: 0, miscCharges: 900,
    totalEstimate35kDWT: 32000,
  },
  {
    region: "Black Sea", country: "Turkey/Romania/Ukraine",
    portDuesPerGT: 0.30, pilotageIn: 2200, pilotageOut: 2200,
    towageIn: 2800, towageOut: 2500, agencyFee: 1800,
    sludgeDisposal: 150, freshWater: 8, lighthouseDues: 500,
    quarantineHealth: 300, miscCharges: 500,
    totalEstimate35kDWT: 18000,
  },
  // ═══ AMERICAS ═══
  {
    region: "US Gulf", country: "United States",
    portDuesPerGT: 0.25, pilotageIn: 5500, pilotageOut: 5500,
    towageIn: 6000, towageOut: 5500, agencyFee: 3500,
    sludgeDisposal: 350, freshWater: 10, lighthouseDues: 0,
    quarantineHealth: 500, miscCharges: 1200,
    totalEstimate35kDWT: 35000,
  },
  {
    region: "US East Coast", country: "United States",
    portDuesPerGT: 0.28, pilotageIn: 6000, pilotageOut: 6000,
    towageIn: 7000, towageOut: 6500, agencyFee: 3800,
    sludgeDisposal: 400, freshWater: 12, lighthouseDues: 0,
    quarantineHealth: 500, miscCharges: 1500,
    totalEstimate35kDWT: 40000,
  },
  {
    region: "Brazil", country: "Brazil",
    portDuesPerGT: 0.20, pilotageIn: 3000, pilotageOut: 3000,
    towageIn: 4000, towageOut: 3500, agencyFee: 2500,
    sludgeDisposal: 200, freshWater: 8, lighthouseDues: 600,
    quarantineHealth: 400, miscCharges: 800,
    totalEstimate35kDWT: 22000,
  },
  {
    region: "Argentina/River Plate", country: "Argentina",
    portDuesPerGT: 0.22, pilotageIn: 4000, pilotageOut: 4000,
    towageIn: 3500, towageOut: 3000, agencyFee: 2200,
    sludgeDisposal: 180, freshWater: 7, lighthouseDues: 500,
    quarantineHealth: 350, miscCharges: 700,
    totalEstimate35kDWT: 23000,
  },
  // ═══ ASIA ═══
  {
    region: "China", country: "China",
    portDuesPerGT: 0.15, pilotageIn: 1800, pilotageOut: 1800,
    towageIn: 2500, towageOut: 2200, agencyFee: 1500,
    sludgeDisposal: 120, freshWater: 5, lighthouseDues: 300,
    quarantineHealth: 200, miscCharges: 400,
    totalEstimate35kDWT: 14000,
  },
  {
    region: "Japan", country: "Japan",
    portDuesPerGT: 0.35, pilotageIn: 3200, pilotageOut: 3200,
    towageIn: 3800, towageOut: 3500, agencyFee: 2800,
    sludgeDisposal: 350, freshWater: 18, lighthouseDues: 1000,
    quarantineHealth: 300, miscCharges: 800,
    totalEstimate35kDWT: 27000,
  },
  {
    region: "South Korea", country: "South Korea",
    portDuesPerGT: 0.28, pilotageIn: 2500, pilotageOut: 2500,
    towageIn: 3200, towageOut: 2800, agencyFee: 2200,
    sludgeDisposal: 280, freshWater: 12, lighthouseDues: 600,
    quarantineHealth: 200, miscCharges: 600,
    totalEstimate35kDWT: 20000,
  },
  {
    region: "SE Asia", country: "Singapore/Indonesia/Philippines",
    portDuesPerGT: 0.12, pilotageIn: 1500, pilotageOut: 1500,
    towageIn: 2000, towageOut: 1800, agencyFee: 1200,
    sludgeDisposal: 100, freshWater: 4, lighthouseDues: 200,
    quarantineHealth: 150, miscCharges: 300,
    totalEstimate35kDWT: 11000,
  },
  {
    region: "India", country: "India",
    portDuesPerGT: 0.18, pilotageIn: 2000, pilotageOut: 2000,
    towageIn: 2200, towageOut: 2000, agencyFee: 1500,
    sludgeDisposal: 100, freshWater: 4, lighthouseDues: 400,
    quarantineHealth: 250, miscCharges: 500,
    totalEstimate35kDWT: 15000,
  },
  // ═══ MIDDLE EAST / AFRICA ═══
  {
    region: "Arabian Gulf", country: "UAE/Saudi/Qatar",
    portDuesPerGT: 0.20, pilotageIn: 2500, pilotageOut: 2500,
    towageIn: 3000, towageOut: 2800, agencyFee: 2000,
    sludgeDisposal: 150, freshWater: 8, lighthouseDues: 400,
    quarantineHealth: 200, miscCharges: 500,
    totalEstimate35kDWT: 18000,
  },
  {
    region: "West Africa", country: "Nigeria/Ghana/Cameroon",
    portDuesPerGT: 0.25, pilotageIn: 3000, pilotageOut: 3000,
    towageIn: 4000, towageOut: 3500, agencyFee: 3000,
    sludgeDisposal: 200, freshWater: 10, lighthouseDues: 500,
    quarantineHealth: 500, miscCharges: 1500,
    totalEstimate35kDWT: 26000,
  },
  {
    region: "South Africa", country: "South Africa",
    portDuesPerGT: 0.22, pilotageIn: 2500, pilotageOut: 2500,
    towageIn: 3500, towageOut: 3000, agencyFee: 2200,
    sludgeDisposal: 180, freshWater: 7, lighthouseDues: 600,
    quarantineHealth: 300, miscCharges: 600,
    totalEstimate35kDWT: 20000,
  },
  // ═══ AUSTRALIA ═══
  {
    region: "Australia", country: "Australia",
    portDuesPerGT: 0.40, pilotageIn: 5000, pilotageOut: 5000,
    towageIn: 5500, towageOut: 5000, agencyFee: 3500,
    sludgeDisposal: 400, freshWater: 20, lighthouseDues: 1200,
    quarantineHealth: 800, miscCharges: 1000,
    totalEstimate35kDWT: 38000,
  },
];

/**
 * Estimate port call cost for a specific ship size in a specific region.
 * Scales linearly from the Handysize (35k DWT) reference.
 */
export function estimatePortCallCost(dwt: number, region: string): number {
  const profile = PORT_REGIONS.find(p => p.region === region);
  if (!profile) return 20000; // global average fallback
  
  // Scale factor: sqrt-based (port costs don't scale linearly with DWT)
  const scaleFactor = Math.sqrt(dwt / 35000);
  return Math.round(profile.totalEstimate35kDWT * scaleFactor);
}

/**
 * Estimate average port call cost across typical trading patterns.
 * Weighted by common bulk carrier trade routes.
 */
export function estimateAvgPortCallCost(dwt: number, shipType: string): number {
  // Typical bulk carrier trading pattern weights
  const bulkWeights: Record<string,number> = {
    "China": 0.25, "SE Asia": 0.10, "Japan": 0.08, "Australia": 0.12,
    "Brazil": 0.10, "India": 0.08, "NW Europe": 0.07, "US Gulf": 0.05,
    "Arabian Gulf": 0.05, "Mediterranean": 0.05, "Black Sea": 0.03,
    "South Africa": 0.02,
  };
  
  const tankerWeights: Record<string,number> = {
    "Arabian Gulf": 0.30, "China": 0.15, "SE Asia": 0.10,
    "NW Europe": 0.10, "US Gulf": 0.10, "Japan": 0.08,
    "South Korea": 0.05, "Mediterranean": 0.05, "India": 0.07,
  };
  
  const isTanker = ["VLCC","Suezmax","Aframax","Product Tanker","Chemical Tanker",
    "Crude Oil Tanker","Tanker","Oil/Chemical Tanker","LNG Tanker","LPG Tanker"].includes(shipType);
  
  const weights = isTanker ? tankerWeights : bulkWeights;
  let totalCost = 0;
  let totalWeight = 0;
  
  for (const [region, weight] of Object.entries(weights)) {
    totalCost += estimatePortCallCost(dwt, region) * weight;
    totalWeight += weight;
  }
  
  return Math.round(totalCost / totalWeight);
}

/**
 * Canal transit costs (Suez/Panama) — for reference
 */
export const CANAL_COSTS = {
  suez: {
    // Suez Canal toll: ~$5-8 per NT for bulk carriers (laden)
    ratePerNT: 6.5,
    surcharges: 1.15, // 15% surcharge
    estimate: (netTonnage: number) => Math.round(netTonnage * 6.5 * 1.15),
    // Typical costs:
    // Handysize 35k DWT (~15k NT): ~$112k
    // Panamax 75k DWT (~30k NT): ~$224k
    // Capesize: too large, goes around Cape
  },
  panama: {
    // Panama Canal toll: ~$6 per TEU for container, ~$4.50/PC/UMS ton for bulk
    ratePerPCUMS: 4.50,
    estimate: (dwt: number) => Math.round(dwt * 0.55 * 4.50), // PC/UMS ≈ 55% of DWT
    // Typical costs:
    // Handysize: ~$87k
    // Panamax: ~$186k (max beam 32.3m)
    // Post-Panamax: Neopanamax locks ~$350k
  },
};
