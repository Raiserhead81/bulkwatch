import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { readFileSync, existsSync, statSync } from "fs";

const DB_PATH = process.env.DB_PATH || "/opt/bulkwatch/db/ships.db";

function getUser(req: NextRequest) {
  const session = req.cookies.get("vessel_session")?.value;
  if (!session || session === "authenticated") return { role: "admin" };
  try { return JSON.parse(session); } catch { return null; }
}

// ── Valuation model (mirrors priceEstimator.ts logic for server-side use) ──

const NEWBUILD_PRICES: Record<string, { dwt: number; nb: number }> = {
  "Capesize":          { dwt: 180000, nb: 70_000_000 },
  "Newcastlemax":      { dwt: 210000, nb: 72_000_000 },
  "Kamsarmax":         { dwt: 82000,  nb: 38_000_000 },
  "Panamax":           { dwt: 77000,  nb: 35_000_000 },
  "Post-Panamax":      { dwt: 95000,  nb: 42_000_000 },
  "Ultramax":          { dwt: 64000,  nb: 35_000_000 },
  "Supramax":          { dwt: 58000,  nb: 33_000_000 },
  "Handymax":          { dwt: 50000,  nb: 32_000_000 },
  "Handysize":         { dwt: 38000,  nb: 31_000_000 },
  "Mini-Bulker":       { dwt: 12000,  nb: 18_000_000 },
  "VLCC":              { dwt: 300000, nb: 135_000_000 },
  "Suezmax":           { dwt: 157000, nb: 95_000_000  },
  "Aframax":           { dwt: 115000, nb: 72_000_000  },
  "Product Tanker":    { dwt: 50000,  nb: 48_000_000  },
  "Chemical Tanker":   { dwt: 25000,  nb: 42_000_000  },
  "Crude Oil Tanker":  { dwt: 105000, nb: 60_000_000  },
  "Container Ship":    { dwt: 70000,  nb: 95_000_000  },
  "LNG Tanker":        { dwt: 80000,  nb: 250_000_000 },
  "LPG Tanker":        { dwt: 50000,  nb: 95_000_000  },
  "Car Carrier":       { dwt: 15000,  nb: 70_000_000  },
  "RoRo":              { dwt: 12000,  nb: 45_000_000  },
  "Bulk Carrier":      { dwt: 60000,  nb: 34_000_000  },
  "General Cargo":     { dwt: 10000,  nb: 18_000_000  },
  "Multipurpose":      { dwt: 15000,  nb: 22_000_000  },
  "Heavy Lift":        { dwt: 20000,  nb: 45_000_000  },
};

function newbuildPrice(type: string, dwt: number): number {
  const seg = NEWBUILD_PRICES[type];
  if (seg) {
    const scale = Math.pow(dwt / seg.dwt, 0.65);
    return seg.nb * scale;
  }
  // fallback: generic bulk curve
  const base = NEWBUILD_PRICES["Bulk Carrier"];
  const scale = Math.pow(Math.max(dwt, 500) / base.dwt, 0.65);
  return base.nb * scale;
}

function depreciation(age: number): number {
  if (age <= 0) return 1.0;
  if (age <= 5) return 1.0 - age * 0.025;
  if (age <= 10) return 0.875 - (age - 5) * 0.030;
  if (age <= 15) return 0.725 - (age - 10) * 0.030;
  if (age <= 20) return 0.575 - (age - 15) * 0.025;
  if (age <= 25) return 0.450 - (age - 20) * 0.020;
  return Math.max(0.35 - (age - 25) * 0.015, 0.10);
}

function serverEstimate(shipType: string, dwt: number, yearBuilt: number): number {
  const age = new Date().getFullYear() - (yearBuilt > 1900 ? yearBuilt : 2010);
  const effectiveDwt = Math.max(dwt || 0, 500);
  const nb = newbuildPrice(shipType, effectiveDwt);
  const dep = depreciation(age);
  return nb * dep;
}

// ── Pipeline status helper ──
function pipelineStatus(logPath: string): { lastRun: string | null; status: "running" | "ok" | "stale" | "error"; detail: string } {
  if (!existsSync(logPath)) {
    return { lastRun: null, status: "error", detail: "Log file not found" };
  }
  try {
    const stat = statSync(logPath);
    const ageMs = Date.now() - stat.mtimeMs;
    const ageMin = ageMs / 60000;
    const lastRun = stat.mtime.toISOString();
    if (ageMin < 5) return { lastRun, status: "running", detail: `Updated ${Math.round(ageMin)}m ago` };
    if (ageMs < 86400000) return { lastRun, status: "ok", detail: `Updated ${Math.round(ageMin)}m ago` };
    if (ageMs < 172800000) return { lastRun, status: "stale", detail: `Last run ${Math.round(ageMin / 60)}h ago` };
    return { lastRun, status: "error", detail: `No run in ${Math.round(ageMs / 86400000)}d` };
  } catch {
    return { lastRun: null, status: "error", detail: "Cannot read log" };
  }
}

export async function GET(req: NextRequest) {
  const user = getUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const db = new Database(DB_PATH, { readonly: true });

  try {
    // ── Enrichment stats ──
    const total = (db.prepare("SELECT COUNT(*) as n FROM ships").get() as { n: number }).n;

    const equasisScraped = (db.prepare(
      "SELECT COUNT(*) as n FROM ships WHERE equasis_last_scraped IS NOT NULL"
    ).get() as { n: number }).n;

    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const scrapedToday = (db.prepare(
      "SELECT COUNT(*) as n FROM ships WHERE equasis_last_scraped = ?"
    ).get(today) as { n: number }).n;

    const scrapedLast7d = (db.prepare(
      "SELECT COUNT(*) as n FROM ships WHERE equasis_last_scraped >= ?"
    ).get(sevenDaysAgo) as { n: number }).n;

    // Field completeness
    function fieldCount(col: string, zeroIsNull = true): number {
      const cond = zeroIsNull
        ? `${col} IS NOT NULL AND CAST(${col} AS TEXT) != '0' AND ${col} != ''`
        : `${col} IS NOT NULL AND ${col} != ''`;
      return (db.prepare(`SELECT COUNT(*) as n FROM ships WHERE ${cond}`).get() as { n: number }).n;
    }

    const fields = {
      dwt:            { filled: fieldCount("dwt"),              pct: 0 },
      yearBuilt:      { filled: fieldCount("year_built"),       pct: 0 },
      classification: { filled: fieldCount("classification", false), pct: 0 },
      owner:          { filled: fieldCount("owner", false),     pct: 0 },
      manager:        { filled: fieldCount("manager", false),   pct: 0 },
      pAndI:          { filled: fieldCount("p_and_i", false),   pct: 0 },
      mmsi:           { filled: fieldCount("mmsi", false),      pct: 0 },
      flagParisMou:   { filled: fieldCount("flag_paris_mou", false), pct: 0 },
      inspectionsCount: { filled: fieldCount("inspections_count"), pct: 0 },
      hasScrubber:    { filled: fieldCount("has_scrubber"),     pct: 0 },
    };
    for (const k of Object.keys(fields) as Array<keyof typeof fields>) {
      fields[k].pct = Math.round((fields[k].filled / total) * 100);
    }

    // Daily enrichment (last 14 days)
    const dailyRaw = db.prepare(
      `SELECT equasis_last_scraped as date, COUNT(*) as count
       FROM ships WHERE equasis_last_scraped IS NOT NULL
       GROUP BY equasis_last_scraped ORDER BY equasis_last_scraped DESC LIMIT 14`
    ).all() as Array<{ date: string; count: number }>;

    // ── Valuation stats ──
    const valuationRows = db.prepare(
      "SELECT COUNT(*) as n, SUM(estimated_value) as total, AVG(confidence) as avgConf FROM price_history ph WHERE ph.date = (SELECT MAX(date) FROM price_history ph2 WHERE ph2.imo = ph.imo)"
    ).get() as { n: number; total: number | null; avgConf: number | null };

    const shipsValued = valuationRows.n;
    const totalFleetValue = valuationRows.total || 0;
    const avgConfidence = Math.round(valuationRows.avgConf || 0);

    // S&P transactions
    const spCount = (db.prepare("SELECT COUNT(*) as n FROM sp_transactions").get() as { n: number }).n;

    // Model accuracy: compare sp_transactions with model estimates
    const spRows = db.prepare(
      `SELECT ship_type, dwt, year_built, sale_price_usd
       FROM sp_transactions
       WHERE ship_type IS NOT NULL AND dwt IS NOT NULL AND year_built IS NOT NULL AND sale_price_usd > 0`
    ).all() as Array<{ ship_type: string; dwt: number; year_built: number; sale_price_usd: number }>;

    let modelAccuracy = null;
    if (spRows.length >= 3) {
      const errors: number[] = [];
      const pctErrors: number[] = [];
      const biases: number[] = [];

      for (const sp of spRows) {
        const modelVal = serverEstimate(sp.ship_type, sp.dwt, sp.year_built);
        if (modelVal <= 0) continue;
        const actual = sp.sale_price_usd;
        const absErr = Math.abs(modelVal - actual) / actual;
        const bias = (modelVal - actual) / actual;
        errors.push(absErr);
        pctErrors.push(absErr);
        biases.push(bias);
      }

      if (errors.length > 0) {
        const sorted = [...errors].sort((a, b) => a - b);
        const mean = errors.reduce((s, e) => s + e, 0) / errors.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const within10 = errors.filter(e => e <= 0.10).length / errors.length;
        const within15 = errors.filter(e => e <= 0.15).length / errors.length;
        const within20 = errors.filter(e => e <= 0.20).length / errors.length;
        const bias = biases.reduce((s, b) => s + b, 0) / biases.length;

        modelAccuracy = {
          meanAbsError: Math.round(mean * 1000) / 10,
          medianAbsError: Math.round(median * 1000) / 10,
          within10pct: Math.round(within10 * 100),
          within15pct: Math.round(within15 * 100),
          within20pct: Math.round(within20 * 100),
          bias: Math.round(bias * 1000) / 10,
        };
      }
    }

    // ── Market data ──
    let marketData = {
      lastUpdate: "",
      bdi: 0,
      bunkerVLSFO: 0,
      bunkerHSFO: 0,
      bunkerMGO: 0,
      scrapLDT: 0,
      charterCape: 0,
      sources: [] as string[],
      bunkerPorts: 0,
    };
    try {
      const opex = JSON.parse(readFileSync("/opt/bulkwatch/db/opex_rates.json", "utf8"));
      const bunkerPortKeys = Object.keys(opex.bunkerByPort || {});
      marketData = {
        lastUpdate: opex.date || opex.lastAutoUpdate || "",
        bdi: opex.bdiIndex || 0,
        bunkerVLSFO: opex.bunkerVLSFO || 0,
        bunkerHSFO: opex.bunkerHSFO || 0,
        bunkerMGO: opex.bunkerMGO || 0,
        scrapLDT: opex.scrapPriceLDT || 0,
        charterCape: opex.charterRates?.capesize || 0,
        sources: opex.sources || [],
        bunkerPorts: Math.round(bunkerPortKeys.length / 3),
      };
    } catch { /* use defaults */ }

    // ── Pipeline status ──
    const equasisStat  = pipelineStatus("/var/log/bulkwatch-equasis.log");
    const opexStat     = pipelineStatus("/var/log/bulkwatch-opex.log");
    const spStat       = pipelineStatus("/var/log/bulkwatch-sp-scraper.log");
    const valueStat    = pipelineStatus("/var/log/bulkwatch-valuations.log");

    // AIS: check last_seen in ships table
    const aisRow = db.prepare("SELECT MAX(last_seen) as t FROM ships WHERE last_seen IS NOT NULL").get() as { t: number | null };
    const aisLastMs = aisRow.t ? aisRow.t * 1000 : null;
    const aisAgeMs  = aisLastMs ? Date.now() - aisLastMs : Infinity;
    const aisStatus = aisAgeMs < 300000 ? "running"
                    : aisAgeMs < 86400000 ? "ok"
                    : aisAgeMs < 172800000 ? "stale"
                    : "error";
    const aisLastRun = aisLastMs ? new Date(aisLastMs).toISOString() : null;
    const aisDetail  = aisLastMs
      ? `Last position ${Math.round(aisAgeMs / 60000)}m ago`
      : "No AIS data";

    db.close();

    return NextResponse.json({
      enrichment: {
        total,
        equasisScraped,
        equasisPct: Math.round((equasisScraped / total) * 100),
        scrapedToday,
        scrapedLast7d,
        fields,
        daily: dailyRaw,
      },
      valuation: {
        shipsValued,
        totalFleetValue,
        avgConfidence,
        spTransactions: spCount,
        modelAccuracy,
      },
      marketData,
      pipelines: [
        { name: "Equasis Daemon",        ...equasisStat },
        { name: "OPEX Market Updater",   ...opexStat   },
        { name: "S&P Transaction Scraper", ...spStat   },
        { name: "Daily Valuations",      ...valueStat  },
        { name: "AIS Positions",         lastRun: aisLastRun, status: aisStatus, detail: aisDetail },
      ],
    });
  } catch (err) {
    db.close();
    console.error("Admin stats error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
