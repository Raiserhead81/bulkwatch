// Formatting helpers for ships

export function formatUSD(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)} Mrd`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)} Mio`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

export function formatUSDFull(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDWT(dwt: number): string {
  if (dwt >= 1000) {
    return `${(dwt / 1000).toFixed(1)}k DWT`;
  }
  return `${dwt} DWT`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("de-DE").format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  if (hours > 0) return `vor ${hours} Std.`;
  if (minutes > 0) return `vor ${minutes} Min.`;
  return "gerade eben";
}

// Carrier class → human readable label
export const CLASS_LABELS: Record<string, string> = {
  VLOC: "VLOC (Very Large Ore Carrier)",
  Capesize: "Capesize",
  Newcastlemax: "Newcastlemax",
  "Post-Panamax": "Post-Panamax",
  Panamax: "Panamax",
  Kamsarmax: "Kamsarmax",
  Supramax: "Supramax",
  Ultramax: "Ultramax",
  Handymax: "Handymax",
  Handysize: "Handysize",
};

export const CLASS_DESCRIPTIONS: Record<string, string> = {
  VLOC: "Very Large Ore Carrier — über 200.000 DWT, hauptsächlich für Eisenerz-Transport zwischen Brasilien/Australien und China",
  Capesize: "100.000–200.000 DWT, zu groß für Suez- und Panama-Kanal. Fährt ums Kap der Guten Hoffnung oder Kap Hoorn",
  Newcastlemax: "Maximalgröße für den Hafen Newcastle (Australien) — ca. 210.000 DWT",
  "Post-Panamax": "80.000–100.000 DWT, zu groß für alte Panama-Schleusen",
  Panamax: "60.000–80.000 DWT, maximale Größe für alte Panama-Kanal-Schleusen",
  Kamsarmax: "Ca. 82.000 DWT, maximale Größe für Port Kamsar (Guinea, Bauxit-Export)",
  Supramax: "50.000–60.000 DWT, mit eigenem Kran (geared) — flexibel einsetzbar",
  Ultramax: "60.000–65.000 DWT, moderne Supramax-Variante mit besserer Effizienz",
  Handymax: "40.000–50.000 DWT, mit Kran, für kleinere Häfen",
  Handysize: "15.000–40.000 DWT, mit Kran, sehr flexibel für kleine Häfen",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  laid_up: "Aufgelegt",
  scrapped: "Verschrottet",
  under_construction: "Im Bau",
};

export const CARGO_STATUS_LABELS: Record<string, string> = {
  loaded: "Beladen",
  in_ballast: "In Ballast",
  loading: "Beladung",
  discharging: "Löschen",
};

export const RECOMMENDATION_COLORS: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  HOLD: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SELL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const RECOMMENDATION_LABELS: Record<string, string> = {
  BUY: "KAUFEN",
  HOLD: "HALTEN",
  SELL: "VERKAUFEN",
};
