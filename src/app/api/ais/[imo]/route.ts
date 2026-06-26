import { NextRequest, NextResponse } from "next/server";

declare global {
  var __aisCache: Map<string, { imo?: string; mmsi: string; lat: number; lon: number; timestamp: number }> | undefined;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ imo: string }> }) {
  const { imo } = await params;
  const cache = globalThis.__aisCache;
  if (!cache) {
    return NextResponse.json({ error: "AIS cache not initialized" }, { status: 503 });
  }
  for (const ship of cache.values()) {
    if (ship.imo === imo) {
      return NextResponse.json({ ship });
    }
  }
  return NextResponse.json({ error: "Ship not in live cache" }, { status: 404 });
}
