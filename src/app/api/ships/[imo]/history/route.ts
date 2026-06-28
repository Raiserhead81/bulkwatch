import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;
  const db = getDb();

  const rows = db.prepare(
    "SELECT date, estimated_value, confidence, recommendation, bdi FROM price_history WHERE imo = ? ORDER BY date ASC"
  ).all(imo) as { date: string; estimated_value: number; confidence: number; recommendation: string; bdi: number }[];

  if (rows.length === 0) {
    return NextResponse.json({ error: "No price history" }, { status: 404 });
  }

  // Calculate stats
  const values = rows.map(r => r.estimated_value);
  const current = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const change30d = rows.length > 2 ? current - values[Math.max(0, values.length - 3)] : 0;
  const change1y = rows.length > 24 ? current - values[Math.max(0, values.length - 25)] : 0;

  return NextResponse.json({
    imo,
    dataPoints: rows.length,
    current,
    min, max, avg,
    change30d,
    change30dPct: rows.length > 2 ? +(change30d / values[Math.max(0, values.length - 3)] * 100).toFixed(1) : 0,
    change1y,
    change1yPct: rows.length > 24 ? +(change1y / values[Math.max(0, values.length - 25)] * 100).toFixed(1) : 0,
    history: rows.map(r => ({
      date: r.date,
      value: r.estimated_value,
      bdi: r.bdi,
      recommendation: r.recommendation,
    })),
  });
}
