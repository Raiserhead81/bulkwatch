import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM ships").get() as Record<string, number>).c;
  const withImage = (db.prepare("SELECT COUNT(*) as c FROM ships WHERE image_url IS NOT NULL").get() as Record<string, number>).c;
  const withPosition = (db.prepare("SELECT COUNT(*) as c FROM ships WHERE lat IS NOT NULL").get() as Record<string, number>).c;
  const byType = db.prepare("SELECT type, COUNT(*) as count FROM ships GROUP BY type ORDER BY count DESC LIMIT 30").all();
  const totalDwt = ((db.prepare("SELECT SUM(dwt) as s FROM ships WHERE dwt > 0").get() as Record<string, number>).s) || 0;
  return NextResponse.json({ total, withImage, withPosition, byType, totalDwt });
}