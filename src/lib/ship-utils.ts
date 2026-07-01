// Formatting helpers for ships

export function formatUSD(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
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
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
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

  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return "just now";
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
  VLOC: "Very Large Ore Carrier — over 200,000 DWT, mainly for iron ore transport between Brazil/Australia and China",
  Capesize: "100,000–200,000 DWT, too large for Suez and Panama Canal. Routes around Cape of Good Hope or Cape Horn",
  Newcastlemax: "Maximum size for Newcastle port (Australia) — approx. 210,000 DWT",
  "Post-Panamax": "80,000–100,000 DWT, too large for the old Panama Canal locks",
  Panamax: "60,000–80,000 DWT, maximum size for the old Panama Canal locks",
  Kamsarmax: "Approx. 82,000 DWT, maximum size for Port Kamsar (Guinea, bauxite export)",
  Supramax: "50,000–60,000 DWT, with own cranes (geared) — flexible deployment",
  Ultramax: "60,000–65,000 DWT, modern Supramax variant with improved efficiency",
  Handymax: "40,000–50,000 DWT, with cranes, for smaller ports",
  Handysize: "15,000–40,000 DWT, with cranes, very flexible for small ports",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  laid_up: "Laid Up",
  scrapped: "Scrapped",
  under_construction: "Under Construction",
};

export const CARGO_STATUS_LABELS: Record<string, string> = {
  loaded: "Loaded",
  in_ballast: "In Ballast",
  loading: "Loading",
  discharging: "Discharging",
};

export const RECOMMENDATION_COLORS: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  HOLD: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SELL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const RECOMMENDATION_LABELS: Record<string, string> = {
  BUY: "Buy",
  HOLD: "WATCH",
  SELL: "AVOID",
};
