// Top Buy Recommendations — OPEX-based scoring
// Score = f(ROI, Payback, Age, Condition, Market)

import { type Ship, type BulkCarrierType } from "@/data/ships";
import { estimatePrice, formatPrice } from "./priceEstimator";
import { calculateOpex } from "./opex";
import { generateMockVoyage } from "./mockVoyages";

export interface TopPick {
  ship: Ship;
  price: ReturnType<typeof estimatePrice>;
  voyage: ReturnType<typeof generateMockVoyage>;
  score: number;
  reason: string;
  opexPerDay: number;
  netPerDay: number;
  roiPercent: number | null;
  paybackYears: number | null;
}

export interface TopPicksByType {
  type: BulkCarrierType;
  picks: TopPick[];
  marketSummary: string;
}

function calculateBuyScore(ship: Ship, price: ReturnType<typeof estimatePrice>): {
  score: number;
  opexPerDay: number;
  netPerDay: number;
  roiPercent: number | null;
  paybackYears: number | null;
} {
  const opex = calculateOpex(
    ship.dwt, ship.yearBuilt, ship.type, price.estimatedValueUSD,
    ship.flag, ship.fuelConsumption, ship.crewSize, ship.grossTonnage
  );

  let score = 40;
  const age = ship.yearBuilt > 1900 ? new Date().getFullYear() - ship.yearBuilt : 10;

  // ROI (biggest factor, max 30 pts)
  if (opex.roiPercent !== null) {
    if (opex.roiPercent > 20) score += 30;
    else if (opex.roiPercent > 15) score += 25;
    else if (opex.roiPercent > 10) score += 20;
    else if (opex.roiPercent > 5) score += 12;
    else if (opex.roiPercent > 0) score += 5;
    else score -= 15;
  }

  // Payback (max 15 pts)
  if (opex.paybackYears !== null) {
    if (opex.paybackYears < 4) score += 15;
    else if (opex.paybackYears < 6) score += 10;
    else if (opex.paybackYears < 10) score += 5;
    else score -= 5;
  }

  // Age (max 15 pts)
  if (age <= 3) score += 15;
  else if (age <= 7) score += 12;
  else if (age <= 12) score += 8;
  else if (age <= 18) score += 3;
  else score -= 5;

  // Status
  if (ship.status === "active") score += 5;
  else if (ship.status === "scrapped" || ship.status === "lost") score -= 40;

  // Recommendation alignment
  if (price.recommendation === "BUY") score += 10;
  else if (price.recommendation === "SELL") score -= 10;

  // Confidence
  score += Math.round((price.confidenceScore / 100) * 5);

  return {
    score: Math.max(0, Math.min(100, score)),
    opexPerDay: opex.totalFixedOpex,
    netPerDay: opex.netEarningsPerDay,
    roiPercent: opex.roiPercent,
    paybackYears: opex.paybackYears,
  };
}

function getBuyReason(ship: Ship, price: ReturnType<typeof estimatePrice>, roiPct: number | null, payback: number | null): string {
  const age = ship.yearBuilt > 1900 ? new Date().getFullYear() - ship.yearBuilt : 10;

  if (roiPct !== null && roiPct > 15 && age <= 7) {
    return `Excellent ROI ${roiPct}%/yr on a young ship (${age}yr). Payback in ${payback} years at current TC rates.`;
  }
  if (roiPct !== null && roiPct > 10) {
    return `Strong ${roiPct}% annual return. ${age <= 10 ? "Still in prime life phase." : "Solid earner despite age."} Payback: ${payback}yr.`;
  }
  if (payback !== null && payback < 5) {
    return `Fast payback (${payback}yr) — attractive cash-on-cash return even in a softening market.`;
  }
  if (age <= 5 && price.recommendation === "BUY") {
    return `Young ship (${age}yr) with market BUY signal. Long remaining economic life, low maintenance risk.`;
  }
  if (age > 18 && ship.status === "active") {
    return `Scrap strategy: ${age}yr old but still earning. 2-3 more years of returns, then scrap at ~$${((ship.dwt * 0.2 * 480) / 1e6).toFixed(1)}M.`;
  }
  return `Balanced risk-return profile. ROI: ${roiPct ?? "n/a"}%/yr, Payback: ${payback ?? "n/a"}yr.`;
}

export function getTopPicksByType(type: BulkCarrierType, limit = 3, ships: Ship[] = []): TopPick[] {
  const shipsOfType = ships.filter(s => s.type === type && s.status === "active" && s.dwt > 0 && s.yearBuilt > 1900);

  const scored = shipsOfType.map(ship => {
    const price = estimatePrice(ship);
    const voyage = generateMockVoyage(ship);
    const { score, opexPerDay, netPerDay, roiPercent, paybackYears } = calculateBuyScore(ship, price);
    const reason = getBuyReason(ship, price, roiPercent, paybackYears);
    return { ship, price, voyage, score, reason, opexPerDay, netPerDay, roiPercent, paybackYears };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getAllTopPicks(ships?: Ship[]): TopPicksByType[] {
  const SHIPS = ships || [];
  const types: BulkCarrierType[] = [
    "Capesize","Newcastlemax","VLOC","Valemax","Panamax","Kamsarmax",
    "Handymax","Handysize","General Cargo","Container Ship",
    "Crude Oil Tanker","Tanker","Product Tanker","LNG Tanker","RoRo","Car Carrier","Bulk Carrier",
  ];

  const result: TopPicksByType[] = [];
  for (const type of types) {
    const picks = getTopPicksByType(type, 3, SHIPS);
    if (picks.length === 0) continue;

    const shipsOfType = SHIPS.filter(s => s.type === type && s.status === "active");
    const avgPrice = shipsOfType.reduce((sum, s) => sum + estimatePrice(s).estimatedValueUSD, 0) / Math.max(shipsOfType.length, 1);
    const avgDwt = shipsOfType.reduce((sum, s) => sum + s.dwt, 0) / Math.max(shipsOfType.length, 1);
    const avgAge = shipsOfType.reduce((sum, s) => sum + (new Date().getFullYear() - s.yearBuilt), 0) / Math.max(shipsOfType.length, 1);

    const marketSummary = `${shipsOfType.length} ships · Avg ${formatPrice(avgPrice)} · ${(avgDwt / 1000).toFixed(0)}K DWT · ${avgAge.toFixed(1)}yr`;

    result.push({ type, picks, marketSummary });
  }
  return result;
}

export function getOverallTopPick(ships?: Ship[]): TopPick | null {
  return getAllTopPicks(ships).flatMap(t => t.picks).sort((a, b) => b.score - a.score)[0] ?? null;
}
