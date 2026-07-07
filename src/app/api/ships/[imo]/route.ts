import { getDb } from "@/lib/db";
import { toShip } from "@/lib/shipMapper";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";


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