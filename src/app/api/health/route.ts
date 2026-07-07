import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";

const startTime = Date.now();

export const dynamic = "force-dynamic";

export async function GET() {
  const uptime = Math.round((Date.now() - startTime) / 1000);

  // DB check
  let dbStatus = "error";
  let shipsCount = 0;
  let equasisEnriched = 0;
  try {
    const db = getDb();
    db.prepare("SELECT 1 FROM ships LIMIT 1").get();
    dbStatus = "ok";
    shipsCount = (db.prepare("SELECT COUNT(*) as n FROM ships").get() as { n: number }).n;
    equasisEnriched = (db.prepare("SELECT COUNT(*) as n FROM ships WHERE classification IS NOT NULL AND classification != ''").get() as { n: number }).n;
  } catch {
    dbStatus = "error";
  }

  // Equasis status
  let equasisStatus: Record<string, unknown> | null = null;
  try {
    const statusPath = "/opt/bulkwatch/equasis-status.json";
    if (existsSync(statusPath)) {
      equasisStatus = JSON.parse(readFileSync(statusPath, "utf-8"));
    }
  } catch {
    // ignore
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json({
    status,
    db: dbStatus,
    uptime,
    ships_count: shipsCount,
    equasis_enriched: equasisEnriched,
    equasis: equasisStatus,
    timestamp: new Date().toISOString(),
  }, { status: status === "ok" ? 200 : 503 });
}
