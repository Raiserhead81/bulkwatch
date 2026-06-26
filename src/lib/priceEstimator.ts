// Preis-Schätzungslogik für Bulk Carrier
// Basierend auf typischen Marktwerten für gebrauchte Schiffe (Stand 2024)

import type { Ship, BulkCarrierType } from "@/data/ships";

export interface PriceEstimate {
  estimatedValueUSD: number;
  confidenceScore: number; // 0-100
  reasoning: string;
  recommendation: "BUY" | "HOLD" | "SELL";
  recommendationReasoning: string;
  factors: Array<{
    label: string;
    value: string;
    impact: "positive" | "neutral" | "negative";
    weight: number;
  }>;
}

// Basispreise nach Schiffstyp (in USD, für altersunabhängige Schiffe mittleren Alters)
const BASE_PRICES: Record<BulkCarrierType, number> = {
  Valemax: 95_000_000,
  VLOC: 85_000_000,
  Newcastlemax: 65_000_000,
  Capesize: 38_000_000,
  "Post-Panamax": 32_000_000,
  Kamsarmax: 28_000_000,
  Panamax: 22_000_000,
  Handymax: 18_000_000,
  Handysize: 12_000_000,
  "Mini-Bulker": 6_000_000,
  Gearless: 25_000_000,
  Geared: 20_000_000,
};

// Marktfaktoren (z.B. Baltic Dry Index, könnte später dynamisch sein)
const MARKET_FACTORS = {
  bdiCurrent: 1500, // Baltic Dry Index (Approximation)
  bdiTrend: "stable" as "rising" | "stable" | "falling",
  freightRateMultiplier: 1.0,
};

// DWT-zu-Wert Multiplikator (pro tausend DWT)
const DWT_VALUE_PER_1000 = 250; // USD pro 1000 DWT

/**
 * Berechnet eine Preis-Schätzung für ein Schiff basierend auf:
 * - Typ (Basispreis)
 * - Baujahr (Altersabschlag)
 * - DWT (Größenbonus)
 * - Flag ( regulatorische Faktoren)
 * - Status (aktiv, stillgelegt, etc.)
 */
export function estimatePrice(ship: Ship): PriceEstimate {
  const basePrice = BASE_PRICES[ship.type] || 20_000_000;
  const factors: PriceEstimate["factors"] = [];
  let priceMultiplier = 1.0;
  let confidenceScore = 70;

  // 1. Alter (größter Faktor)
  const currentYear = new Date().getFullYear();
  const age = currentYear - ship.yearBuilt;
  let ageMultiplier = 1.0;
  if (age <= 2) {
    ageMultiplier = 1.05;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (fast neu)`,
      impact: "positive",
      weight: 30,
    });
  } else if (age <= 5) {
    ageMultiplier = 1.0;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (jung)`,
      impact: "positive",
      weight: 25,
    });
  } else if (age <= 10) {
    ageMultiplier = 0.85;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (mittel)`,
      impact: "neutral",
      weight: 20,
    });
  } else if (age <= 15) {
    ageMultiplier = 0.65;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (älter)`,
      impact: "negative",
      weight: 25,
    });
  } else if (age <= 20) {
    ageMultiplier = 0.45;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (alt)`,
      impact: "negative",
      weight: 30,
    });
  } else if (age <= 25) {
    ageMultiplier = 0.30;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (sehr alt)`,
      impact: "negative",
      weight: 35,
    });
    confidenceScore -= 10;
  } else {
    ageMultiplier = 0.15;
    factors.push({
      label: "Alter",
      value: `${age} Jahre (verschrottungsreif)`,
      impact: "negative",
      weight: 40,
    });
    confidenceScore -= 20;
  }
  priceMultiplier *= ageMultiplier;

  // 2. DWT-Größenbonus
  const dwtBonus = (ship.dwt / 1000) * DWT_VALUE_PER_1000;
  const dwtBonusPercent = dwtBonus / basePrice;
  if (dwtBonusPercent > 0.1) {
    factors.push({
      label: "Tonnage",
      value: `${ship.dwt.toLocaleString("de-DE")} DWT (groß)`,
      impact: "positive",
      weight: 15,
    });
  } else if (dwtBonusPercent > 0.05) {
    factors.push({
      label: "Tonnage",
      value: `${ship.dwt.toLocaleString("de-DE")} DWT`,
      impact: "neutral",
      weight: 10,
    });
  }

  // 3. Flag/Regulatorik
  const reputableFlags = [
    "Norway",
    "Denmark",
    "Germany",
    "Netherlands",
    "United Kingdom",
    "Japan",
    "Singapore",
  ];
  const flagCompliant = ["Panama", "Liberia", "Marshall Islands", "Hong Kong"];
  const flagLowCost = ["Mongolia", "Cambodia", "Belize", "Comoros"];

  if (reputableFlags.includes(ship.flag)) {
    priceMultiplier *= 1.02;
    factors.push({
      label: "Flagge",
      value: `${ship.flag} (Premium)`,
      impact: "positive",
      weight: 8,
    });
  } else if (flagCompliant.includes(ship.flag)) {
    factors.push({
      label: "Flagge",
      value: `${ship.flag} (Standard)`,
      impact: "neutral",
      weight: 5,
    });
  } else if (flagLowCost.includes(ship.flag)) {
    priceMultiplier *= 0.95;
    factors.push({
      label: "Flagge",
      value: `${ship.flag} (Billigflagge)`,
      impact: "negative",
      weight: 10,
    });
    confidenceScore -= 5;
  }

  // 4. Status (aktiv, stillgelegt, verschrottet, verloren)
  if (ship.status === "scrapped") {
    priceMultiplier *= 0.20;
    factors.push({
      label: "Status",
      value: "Verschrottet (Schrottwert)",
      impact: "negative",
      weight: 50,
    });
    confidenceScore -= 30;
  } else if (ship.status === "laid_up") {
    priceMultiplier *= 0.70;
    factors.push({
      label: "Status",
      value: "Stillgelegt",
      impact: "negative",
      weight: 15,
    });
  } else if (ship.status === "lost") {
    priceMultiplier *= 0;
    factors.push({
      label: "Status",
      value: "Verloren (Totalverlust)",
      impact: "negative",
      weight: 100,
    });
    confidenceScore -= 50;
  } else {
    factors.push({
      label: "Status",
      value: "Aktiv im Einsatz",
      impact: "positive",
      weight: 10,
    });
  }

  // 5. Bauwerft-Qualität
  const premiumBuilders = [
    "Hyundai Heavy Industries",
    "Mitsubishi Heavy Industries",
    "Daewoo Shipbuilding",
    "Imabari Shipbuilding",
    "Namura Shipbuilding",
    "Shanghai Waigaoqiao",
  ];
  if (ship.builder && premiumBuilders.includes(ship.builder)) {
    priceMultiplier *= 1.03;
    factors.push({
      label: "Bauwerft",
      value: `${ship.builder} (Premium)`,
      impact: "positive",
      weight: 7,
    });
  }

  // 6. Marktlage (BDI)
  if (MARKET_FACTORS.bdiCurrent > 2000) {
    priceMultiplier *= 1.10;
    factors.push({
      label: "Marktlage",
      value: `BDI ${MARKET_FACTORS.bdiCurrent} (hoch)`,
      impact: "positive",
      weight: 15,
    });
  } else if (MARKET_FACTORS.bdiCurrent > 1000) {
    factors.push({
      label: "Marktlage",
      value: `BDI ${MARKET_FACTORS.bdiCurrent} (normal)`,
      impact: "neutral",
      weight: 8,
    });
  } else {
    priceMultiplier *= 0.85;
    factors.push({
      label: "Marktlage",
      value: `BDI ${MARKET_FACTORS.bdiCurrent} (niedrig)`,
      impact: "negative",
      weight: 12,
    });
  }

  // Endpreis berechnen
  const estimatedValueUSD = Math.round(
    (basePrice + dwtBonus) * priceMultiplier,
  );

  // Konfidenz-Score anpassen
  confidenceScore = Math.max(20, Math.min(95, confidenceScore));

  // Buy/Hold/Sell Empfehlung
  let recommendation: "BUY" | "HOLD" | "SELL" = "HOLD";
  let recommendationReasoning = "";

  if (ship.status === "lost") {
    recommendation = "SELL";
    recommendationReasoning =
      "Schiff ist verloren — kein Wiederverkaufswert. Schrottwert der Versicherung beachten.";
  } else if (ship.status === "scrapped") {
    recommendation = "SELL";
    recommendationReasoning =
      "Schiff ist bereits verschrottet. Schrottwert notiert, kein Investment.";
  } else if (age > 25) {
    recommendation = "SELL";
    recommendationReasoning =
      "Verschrottungsreif. Verkauf vor weiteren Wertverlusten. Stahlpreis (~$500/t) als Minimum beachten.";
  } else if (age > 18 && MARKET_FACTORS.bdiCurrent > 1500) {
    recommendation = "SELL";
    recommendationReasoning =
      "Hohes Alter bei aktuell gutem Markt — optimaler Verkaufszeitpunkt vor nächstem Abschwung.";
  } else if (age <= 5 && MARKET_FACTORS.bdiCurrent > 1500) {
    recommendation = "HOLD";
    recommendationReasoning =
      "Junges Schiff in gutem Markt — Wertsteigerung wahrscheinlich. Verkauf in 2-3 Jahren könnte besser sein.";
  } else if (age <= 5 && MARKET_FACTORS.bdiCurrent < 1200) {
    recommendation = "BUY";
    recommendationReasoning =
      "Junges Schiff, aber Markt ist schwach — Einstiegschance zu reduziertem Preis. Markt wird sich erholen.";
  } else if (age <= 10 && ship.dwt > 100000) {
    recommendation = "BUY";
    recommendationReasoning =
      "Großes Schiff in der besten Lebensphase. Capesize/VLOCs profitieren stark von Erzfracht-Nachfrage.";
  } else if (ship.dwt < 40000 && MARKET_FACTORS.bdiCurrent < 1000) {
    recommendation = "SELL";
    recommendationReasoning =
      "Kleines Schiff in schwachem Markt — Handysize-Schiffe sind am empfindlichsten für Frachtraten-Schwankungen.";
  } else if (ship.type === "Valemax" || ship.type === "VLOC") {
    recommendation = "HOLD";
    recommendationReasoning =
      "Spezialisierte VLOCs haben langfristige Verträge mit Vale — stabile Einnahmen, aber eingeschränkter Käuferkreis.";
  } else {
    recommendation = "HOLD";
    recommendationReasoning =
      "Ausgewogene Risiko-Rendite. Marktbeobachtung empfohlen, je nach Frachtraten-Entwicklung.";
  }

  // Reasoning-Text für Preis
  const reasoning = `Geschätzt basierend auf ${ship.type}-Basispreis von $${(basePrice / 1_000_000).toFixed(1)}M, Alter ${age} Jahre (${Math.round(ageMultiplier * 100)}% Multiplikator), Tonnage-Bonus von $${(dwtBonus / 1_000_000).toFixed(2)}M für ${ship.dwt.toLocaleString("de-DE")} DWT, und Marktlage (BDI ${MARKET_FACTORS.bdiCurrent}). Konfidenz: ${confidenceScore}%.`;

  return {
    estimatedValueUSD,
    confidenceScore,
    reasoning,
    recommendation,
    recommendationReasoning,
    factors,
  };
}

// Hilfsfunktion: Schätzwert formatieren
export function formatPrice(usd: number): string {
  if (usd >= 1_000_000) {
    return `$${(usd / 1_000_000).toFixed(2)}M`;
  } else if (usd >= 1_000) {
    return `$${(usd / 1_000).toFixed(0)}K`;
  }
  return `$${usd}`;
}

// Hilfsfunktion: Recommendation-Farbe
export function getRecommendationColor(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "HOLD":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "SELL":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
  }
}

// Hilfsfunktion: Recommendation-Emoji
export function getRecommendationEmoji(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "🟢";
    case "HOLD":
      return "🟡";
    case "SELL":
      return "🔴";
  }
}

// Hilfsfunktion: Recommendation-Text (Deutsch)
export function getRecommendationLabel(rec: "BUY" | "HOLD" | "SELL"): string {
  switch (rec) {
    case "BUY":
      return "KAUFEN";
    case "HOLD":
      return "HALTEN";
    case "SELL":
      return "VERKAUFEN";
  }
}
