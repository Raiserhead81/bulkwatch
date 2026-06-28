import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const flags = (db.prepare("SELECT DISTINCT flag FROM ships WHERE flag IS NOT NULL AND flag != 'Unknown' ORDER BY flag").all() as Record<string, string>[]).map(r => r.flag);
  return NextResponse.json({ flags });
}