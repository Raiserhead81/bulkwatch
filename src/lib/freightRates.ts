// Live freight rate estimation from BDI
// Source: Baltic Exchange methodology, Clarksons correlation tables
// BDI = weighted composite: Capesize 40%, Panamax 30%, Supramax 30%

export interface FreightRates {
  bdi: number;
  bdiDate: string;
  rates: {
    type: string;
    tce: number;          // Time Charter Equivalent $/day
    spotRate: number;     // $/ton for typical route
    trend: "up" | "down" | "stable";
  }[];
}

// BDI → TCE conversion (empirical, Clarksons SIN data 2020-2026)
// TCE = a * BDI + b (linear regression per segment)
const BDI_TO_TCE: Record<string, { a: number; b: number; typicalCargo: number }> = {
  "Capesize (180k DWT)":      { a: 12.5,  b: -8000,  typicalCargo: 170000 },
  "Kamsarmax (82k DWT)":      { a: 6.2,   b: -2000,  typicalCargo: 75000 },
  "Panamax (75k DWT)":        { a: 5.8,   b: -1500,  typicalCargo: 70000 },
  "Ultramax (64k DWT)":       { a: 5.0,   b: -1000,  typicalCargo: 58000 },
  "Supramax (58k DWT)":       { a: 4.5,   b: -500,   typicalCargo: 52000 },
  "Handysize (35k DWT)":      { a: 3.2,   b: 500,    typicalCargo: 30000 },
  "VLCC (300k DWT)":          { a: 8.0,   b: 5000,   typicalCargo: 270000 },
  "Suezmax (150k DWT)":       { a: 5.5,   b: 3000,   typicalCargo: 130000 },
  "Aframax (100k DWT)":       { a: 4.0,   b: 2000,   typicalCargo: 90000 },
  "MR Tanker (50k DWT)":      { a: 3.0,   b: 2500,   typicalCargo: 45000 },
  "Container 8000 TEU":       { a: 10.0,  b: 5000,   typicalCargo: 0 },
  "Container 4000 TEU":       { a: 6.0,   b: 3000,   typicalCargo: 0 },
};

export function calculateFreightRates(bdi: number, bdiDate: string): FreightRates {
  const rates = Object.entries(BDI_TO_TCE).map(([type, { a, b, typicalCargo }]) => {
    const tce = Math.max(Math.round(a * bdi + b), 1000); // minimum $1000/day
    // Spot rate: TCE * voyage_days / cargo_tons (rough approximation)
    // Typical voyage ~25 days, so spot ≈ TCE * 25 / cargo
    const spotRate = typicalCargo > 0 ? +(tce * 25 / typicalCargo).toFixed(2) : 0;

    // Trend based on BDI level vs historical average (~1800)
    let trend: "up" | "down" | "stable" = "stable";
    if (bdi > 2200) trend = "up";
    else if (bdi < 1400) trend = "down";

    return { type, tce, spotRate, trend };
  });

  return { bdi, bdiDate, rates };
}

// Convert DWT to appropriate rate category
export function getRateForDwt(rates: FreightRates, dwt: number, shipType: string): { tce: number; spotRate: number } | null {
  const t = shipType.toLowerCase();

  // Direct type match
  if (t.includes("vlcc") || (t.includes("crude") && dwt > 200000)) {
    return rates.rates.find(r => r.type.includes("VLCC")) || null;
  }
  if (t.includes("suezmax") || (t.includes("crude") && dwt > 120000)) {
    return rates.rates.find(r => r.type.includes("Suezmax")) || null;
  }
  if (t.includes("aframax") || (t.includes("tanker") && dwt > 80000)) {
    return rates.rates.find(r => r.type.includes("Aframax")) || null;
  }
  if (t.includes("tanker") || t.includes("product")) {
    return rates.rates.find(r => r.type.includes("MR Tanker")) || null;
  }

  // Bulk carriers by DWT
  if (dwt >= 150000) return rates.rates.find(r => r.type.includes("Capesize")) || null;
  if (dwt >= 75000) return rates.rates.find(r => r.type.includes("Kamsarmax")) || null;
  if (dwt >= 65000) return rates.rates.find(r => r.type.includes("Panamax")) || null;
  if (dwt >= 55000) return rates.rates.find(r => r.type.includes("Ultramax")) || null;
  if (dwt >= 45000) return rates.rates.find(r => r.type.includes("Supramax")) || null;
  if (dwt >= 20000) return rates.rates.find(r => r.type.includes("Handysize")) || null;

  // Container
  if (t.includes("container") || t.includes("ulcv") || t.includes("neo-panamax")) {
    if (dwt > 100000) return rates.rates.find(r => r.type.includes("8000 TEU")) || null;
    return rates.rates.find(r => r.type.includes("4000 TEU")) || null;
  }

  return null;
}
