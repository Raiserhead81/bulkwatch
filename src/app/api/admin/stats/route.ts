import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { estimatePrice } from "@/lib/priceEstimator";
import Database from "better-sqlite3";
import { readFileSync, existsSync, statSync } from "fs";

const DB_PATH = process.env.DB_PATH || "/opt/bulkwatch/db/ships.db";

function getUser(req: NextRequest) {
  const session = req.cookies.get("vessel_session")?.value;
  if (!session) return null;
  return verifySession(session);
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

    // Model accuracy: compare sp_transactions with estimatePrice (shared model).
    // Use the FULL S&P set (sp.* primary, ships.* only for optional enrichment) so the
    // metric reflects the model's true quality, not just the small IMO-matched subset.
    const spRows = db.prepare(
      `SELECT sp.imo,
              COALESCE(s.name, sp.ship_name)                 as name,
              COALESCE(NULLIF(sp.ship_type,''), s.type)      as ship_type,
              COALESCE(sp.dwt, s.dwt)                        as dwt,
              COALESCE(sp.year_built, s.year_built)          as year_built,
              s.flag, s.status, s.builder, s.length, s.beam, s.draft, s.operator,
              s.fuel_consumption_tons_day, s.classification, s.mmsi, sp.sale_price_usd
       FROM sp_transactions sp
       LEFT JOIN ships s ON s.imo = sp.imo
       WHERE sp.dwt > 0 AND sp.year_built > 1970 AND sp.ship_type IS NOT NULL AND sp.sale_price_usd > 0`
    ).all() as Array<Record<string, unknown>>;

    // Plausibility filter: auto-scraped S&P deals contain parse errors (enbloc/fleet prices,
    // swapped columns) and placeholder dwt from enrichment. Drop implausible deals so we
    // don't measure the model against garbage. Mirrors the filter in calibrate-model.py.
    const DUMMY_DWT = new Set([5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000]);
    const isPlausibleDeal = (dwt: number, price: number, age: number): boolean => {
      if (dwt <= 0 || price <= 0 || DUMMY_DWT.has(dwt)) return false;
      const perDwt = price / dwt;                 // $/dwt sanity → kills parse errors
      if (perDwt > 2500 || perDwt < 40) return false;
      if (age > 30 && price > 15e6) return false; // old ship, absurdly expensive
      if (price > 250e6) return false;            // above any bulker/tanker
      return true;
    };

    let modelAccuracy: { meanAbsError: number; medianAbsError: number; within10pct: number; within15pct: number; within20pct: number; bias: number } | null = null;
    if (spRows.length >= 3) {
      const errors: number[] = [];
      const biases: number[] = [];

      for (const sp of spRows) {
        const dwt = (sp.dwt as number) || 0;
        const yearBuilt = (sp.year_built as number) || 0;
        const actual = sp.sale_price_usd as number;
        const age = 2026 - (yearBuilt || 2016);
        if (!isPlausibleDeal(dwt, actual, age)) continue;
        const ship = {
          id: `imo-${sp.imo}`,
          imo: sp.imo as string,
          name: sp.name as string,
          mmsi: (sp.mmsi as string) || "",
          type: sp.ship_type as string,
          dwt,
          length: (sp.length as number) || 0,
          beam: (sp.beam as number) || 0,
          draft: (sp.draft as number) || 0,
          yearBuilt,
          builder: (sp.builder as string) || "",
          flag: (sp.flag as string) || "Unknown",
          operator: (sp.operator as string) || "",
          status: (sp.status as string) || "active",
          fuelConsumption: (sp.fuel_consumption_tons_day as number) || 0,
          classification: (sp.classification as string) || "",
        };
        const est = estimatePrice(ship as any);
        const modelVal = est.estimatedValueUSD;
        if (modelVal <= 0) continue;
        const absErr = Math.abs(modelVal - actual) / actual;
        const bias = (modelVal - actual) / actual;
        errors.push(absErr);
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
