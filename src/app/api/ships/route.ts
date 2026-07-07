import { getDb } from "@/lib/db";
import { toShip } from "@/lib/shipMapper";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";



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
    conditions.push("operator LIKE ?");
    params.push(`%${operator}%`);
  }
  if (hasPosition) {
    conditions.push("lat IS NOT NULL AND lat != 0");
  }

  const status = searchParams.get("status") || "";
  if (status) { conditions.push("status = ?"); params.push(status); }

  // Age filter (years since built)
  const ageMin = searchParams.get("age_min");
  const ageMax = searchParams.get("age_max");
  const currentYear = new Date().getFullYear();
  if (ageMin) {
    conditions.push("year_built > 0 AND year_built <= ?");
    params.push(currentYear - parseInt(ageMin));
  }
  if (ageMax) {
    conditions.push("year_built > 0 AND year_built >= ?");
    params.push(currentYear - parseInt(ageMax));
  }

  // DWT range filter
  const dwtMin = searchParams.get("dwt_min");
  const dwtMax = searchParams.get("dwt_max");
  if (dwtMin) { conditions.push("dwt >= ?"); params.push(parseInt(dwtMin)); }
  if (dwtMax) { conditions.push("dwt <= ?"); params.push(parseInt(dwtMax)); }

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
  // Enrich with operator contact details
  const rawShips = (db.prepare(`SELECT * FROM ships ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset) as Record<string, unknown>[]);
  const opCache = new Map<string, Record<string, unknown>>();
  const ships = rawShips.map(row => {
    const op = row.operator as string;
    if (op && !opCache.has(op)) {
      const opRow = db.prepare("SELECT website, email, phone, city, country FROM operators WHERE name = ?").get(op) as Record<string, unknown> | undefined;
      opCache.set(op, opRow || {});
    }
    const opData = op ? opCache.get(op) || {} : {};
    return toShip({ ...row, op_website: opData.website, op_email: opData.email, op_phone: opData.phone, op_city: opData.city, op_country: opData.country });
  });

  return NextResponse.json({ ships, total, page, totalPages: Math.ceil(total / limit) });
}
