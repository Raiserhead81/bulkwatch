import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toShip(row: Record<string, unknown>) {
  return {
    id: `imo-${row.imo}`,
    imo: row.imo,
    name: row.name,
    mmsi: row.mmsi,
    type: row.type,
    dwt: row.dwt || 0,
    length: row.length || 0,
    beam: row.beam || 0,
    draft: row.draft || 0,
    yearBuilt: row.year_built || 0,
    builder: row.builder,
    flag: row.flag || "Unknown",
    operator: row.operator,
    homePort: row.home_port,
    imageUrl: row.image_url,
    imageAttribution: row.image_attribution,
    position: row.lat ? { lat: row.lat, lon: row.lon } : undefined,
    lastSeen: row.last_seen,
    status: row.status || "active",
    deliveryDate: row.delivery_date,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM ships WHERE imo = ?").get(imo) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ship = toShip(row);

  // Operator contact details
  if (ship.operator) {
    const op = db.prepare("SELECT * FROM operators WHERE name = ?").get(ship.operator) as Record<string, unknown> | undefined;
    if (op) {
      (ship as Record<string, unknown>).operatorDetails = {
        country: op.country,
        city: op.city,
        website: op.website,
        email: op.email,
        phone: op.phone,
        fleetSize: op.fleet_size,
      };
    }
  }

  return NextResponse.json(ship);
}