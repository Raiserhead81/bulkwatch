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
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get("limit") || "24")));
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "";
  const flag = searchParams.get("flag") || "";
  const operator = searchParams.get("operator") || "";
  const sort = searchParams.get("sort") || "name";
  const hasPosition = searchParams.get("has_position") === "true";
  const offset = (page - 1) * limit;

  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    conditions.push("(name LIKE ? OR imo LIKE ? OR operator LIKE ?)");
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (type) { conditions.push("type = ?"); params.push(type); }
  if (flag) { conditions.push("flag = ?"); params.push(flag); }
  if (operator) {
    // Search both operator field AND ship name prefix (companies often name ships after themselves)
    conditions.push("(operator LIKE ? OR name LIKE ?)");
    params.push(`%${operator}%`, `%${operator}%`);
  }
  if (hasPosition) {
    conditions.push("lat IS NOT NULL AND lat != 0");
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const orderMap: Record<string, string> = {
    name: "name ASC",
    dwt: "dwt DESC",
    year: "year_built DESC",
    value: "dwt DESC",
    dwt_desc: "dwt DESC",
  };
  const order = orderMap[sort] || "name ASC";

  const total = (db.prepare(`SELECT COUNT(*) as c FROM ships ${where}`).get(...params) as Record<string, number>).c;
  const ships = (db.prepare(`SELECT * FROM ships ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[]).map(toShip);

  return NextResponse.json({ ships, total, page, totalPages: Math.ceil(total / limit) });
}