// Top 3 Kauf-Empfehlungen pro Schiffsgröße (Bulk Carrier Typ)
// Basierend auf Preis-Schätzung + Buy/Hold/Sell Empfehlung + Markt-Logik

import { type Ship, type BulkCarrierType } from "@/data/ships";
import { estimatePrice, formatPrice } from "./priceEstimator";
import { generateMockVoyage } from "./mockVoyages";

export interface TopPick {
  ship: Ship;
  price: ReturnType<typeof estimatePrice>;
  voyage: ReturnType<typeof generateMockVoyage>;
  score: number; // 0-100, wie gut der Kauf ist
  reason: string;
}

export interface TopPicksByType {
  type: BulkCarrierType;
  picks: TopPick[];
  marketSummary: string;
}

/**
 * Berechnet einen Kauf-Score (0-100) für ein Schiff.
 * Höher = besseres Kauf-Potential.
 *
 * Faktoren:
 * - Junges Schiff (wenig Alter) = +Punkte
 * - Große Tonnage (hohe DWT) = +Punkte
 * - Aktiv im Einsatz = +Punkte
 * - Niedriger Preis pro DWT = +Punkte
 * - Buy-Empfehlung = +Punkte
 * - Keine Billigflagge = +Punkte
 */
function calculateBuyScore(ship: Ship, price: ReturnType<typeof estimatePrice>): number {
  let score = 50; // Basis
  const currentYear = new Date().getFullYear();
  const age = currentYear - ship.yearBuilt;

  // Alter (max 30 Punkte)
  if (age <= 2) score += 30;
  else if (age <= 5) score += 25;
  else if (age <= 10) score += 15;
  else if (age <= 15) score += 5;
  else score -= 10;

  // Preis pro DWT (max 20 Punkte) — niedriger = besser
  const pricePerDwt = price.estimatedValueUSD / ship.dwt;
  if (pricePerDwt < 200) score += 20;
  else if (pricePerDwt < 400) score += 15;
  else if (pricePerDwt < 600) score += 10;
  else if (pricePerDwt < 1000) score += 5;
  else score -= 5;

  // Buy/Hold/Sell Empfehlung (max 20 Punkte)
  if (price.recommendation === "BUY") score += 20;
  else if (price.recommendation === "HOLD") score += 5;
  else if (price.recommendation === "SELL") score -= 15;

  // Konfidenz (max 10 Punkte)
  score += Math.round((price.confidenceScore / 100) * 10);

  // Status (max 10 Punkte)
  if (ship.status === "active") score += 10;
  else if (ship.status === "laid_up") score -= 5;
  else if (ship.status === "scrapped" || ship.status === "lost") score -= 30;

  // Flagge (max 5 Punkte)
  const goodFlags = ["Norway", "Denmark", "Germany", "Netherlands", "Japan", "Singapore"];
  if (goodFlags.includes(ship.flag)) score += 5;

  // Alter-Bonus für Preis: Alte Schiffe mit hohem Konfidenz sind Kauf-Kandiaten (Schrottwert)
  if (age > 20 && ship.status === "active" && price.confidenceScore > 60) {
    score += 5; // möglicher Schrott-Trade
  }

  return Math.max(0, Math.min(100, score));
}

function getBuyReason(ship: Ship, price: ReturnType<typeof estimatePrice>): string {
  const currentYear = new Date().getFullYear();
  const age = currentYear - ship.yearBuilt;
  const pricePerDwt = price.estimatedValueUSD / ship.dwt;

  if (age <= 5 && price.recommendation === "BUY") {
    return `Young ship (${age} yrs), attractive market price. Price/DWT: $${pricePerDwt.toFixed(0)}. High remaining lifespan, good return prospects.`;
  }
  if (age <= 10 && ship.dwt > 100000) {
    return `Large ship (${ship.dwt.toLocaleString("en-US")} DWT) in prime life phase. High freight rates for Capesize/VLOCs enable fast payback.`;
  }
  if (age > 20 && ship.status === "active") {
    return `Older ship (${age} yrs) but still active. Scrap strategy: 2-3 more years of returns, then scrapping at steel price (~$500/t).`;
  }
  if (pricePerDwt < 300) {
    return `Excellent price/DWT ratio ($${pricePerDwt.toFixed(0)}). Comparable market value is higher — potential capital gain.`;
  }
  if (price.recommendation === "BUY") {
    return `Buy recommendation based on market conditions and ship profile. Confidence ${price.confidenceScore}%.`;
  }
  return `Solid investment option with balanced risk profile.`;
}

/**
 * Holt die Top 3 Kauf-Empfehlungen für einen Schiffstyp.
 */
export function getTopPicksByType(type: BulkCarrierType, limit = 3, ships: Ship[] = []): TopPick[] {
  const shipsOfType = SHIPS.filter((s) => s.type === type && s.status === "active");

  const scored = shipsOfType.map((ship) => {
    const price = estimatePrice(ship);
    const voyage = generateMockVoyage(ship);
    const score = calculateBuyScore(ship, price);
    const reason = getBuyReason(ship, price);
    return { ship, price, voyage, score, reason };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Holt die Top 3 Kauf-Empfehlungen für ALLE Schiffstypen.
 */
export function getAllTopPicks(ships?: Ship[]): TopPicksByType[] {
  const SHIPS = ships || [];
  const types: BulkCarrierType[] = [
    "Capesize",
    "Newcastlemax",
    "VLOC",
    "Valemax",
    "Panamax",
    "Kamsarmax",
    "Handymax",
    "Handysize",
    "General Cargo",
    "Container Ship",
    "Crude Oil Tanker",
    "Tanker",
    "Product Tanker",
    "LNG Tanker",
    "RoRo",
    "Car Carrier",
    "Bulk Carrier",
  ];

  const result: TopPicksByType[] = [];

  for (const type of types) {
    const picks = getTopPicksByType(type, 3, SHIPS);
    if (picks.length === 0) continue;

    const shipsOfType = SHIPS.filter((s) => s.type === type && s.status === "active");
    const avgPrice =
      shipsOfType.reduce((sum, s) => sum + estimatePrice(s).estimatedValueUSD, 0) /
      shipsOfType.length;
    const avgDwt =
      shipsOfType.reduce((sum, s) => sum + s.dwt, 0) / shipsOfType.length;
    const avgAge =
      shipsOfType.reduce((sum, s) => sum + (new Date().getFullYear() - s.yearBuilt), 0) /
      shipsOfType.length;

    const marketSummary = `${shipsOfType.length} ships available · Avg ${formatPrice(
      avgPrice,
    )} · Avg ${(avgDwt / 1000).toFixed(0)}K DWT · Avg ${avgAge.toFixed(1)} yrs old`;

    result.push({ type, picks, marketSummary });
  }

  return result;
}

/**
 * Gesamt-Top-Pick über alle Typen hinweg.
 */
export function getOverallTopPick(ships?: Ship[]): TopPick | null {
  const allPicks = getAllTopPicks()
    .flatMap((t) => t.picks)
    .sort((a, b) => b.score - a.score);
  return allPicks[0] ?? null;
}
