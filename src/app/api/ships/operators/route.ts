import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT operator FROM ships WHERE operator IS NOT NULL AND operator != '' ORDER BY operator").all() as { operator: string }[];
  return NextResponse.json({ operators: rows.map(r => r.operator) });
}
