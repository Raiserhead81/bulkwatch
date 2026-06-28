import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const operator = searchParams.get("operator") || "";

  if (!operator) {
    return NextResponse.json({ error: "operator parameter required" }, { status: 400 });
  }

  const db = getDb();

  // Get operator details
  const opRow = db.prepare("SELECT * FROM operators WHERE name = ?").get(operator) as Record<string, unknown> | undefined;

  // Get ships for this operator
  const ships = (db.prepare(
    "SELECT * FROM ships WHERE operator LIKE ? ORDER BY dwt DESC"
  ).all(`%${operator}%`) as Record<string, unknown>[]).map(row => ({
    imo: row.imo,
    name: row.name,
    type: row.type,
    dwt: row.dwt || 0,
    length: row.length || 0,
    beam: row.beam || 0,
    draft: row.draft || 0,
    yearBuilt: row.year_built || 0,
    builder: row.builder,
    flag: row.flag || "Unknown",
    operator: row.operator,
    imageUrl: row.image_url,
    status: row.status || "active",
    grossTonnage: row.gross_tonnage || 0,
    engineType: row.engine_type,
    enginePowerKw: row.engine_power_kw || 0,
    speedKnots: row.speed_knots || 0,
    fuelConsumption: row.fuel_consumption_tons_day || 0,
    fuelType: row.fuel_type,
    crewSize: row.crew_size || 0,
    lat: row.lat,
    lon: row.lon,
  }));

  // Fleet stats
  const currentYear = new Date().getFullYear();
  const totalDwt = ships.reduce((s, sh) => s + (sh.dwt as number), 0);
  const ages = ships.filter(s => (s.yearBuilt as number) > 0).map(s => currentYear - (s.yearBuilt as number));
  const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const types: Record<string, number> = {};
  for (const s of ships) { const t = s.type as string; types[t] = (types[t] || 0) + 1; }

  const operatorDetails = opRow ? {
    name: opRow.name,
    country: opRow.country,
    city: opRow.city,
    website: opRow.website,
    email: opRow.email,
    phone: opRow.phone,
    fleetSize: opRow.fleet_size,
  } : null;

  return NextResponse.json({
    operator: operatorDetails,
    ships,
    stats: {
      count: ships.length,
      totalDwt,
      avgAge: Math.round(avgAge * 10) / 10,
      types,
    },
  });
}
