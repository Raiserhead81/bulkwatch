import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ version: "1783039150" }, {
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
  });
}
