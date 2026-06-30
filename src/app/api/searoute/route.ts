import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromLat = searchParams.get("fromLat");
  const fromLon = searchParams.get("fromLon");
  const toLat = searchParams.get("toLat");
  const toLon = searchParams.get("toLon");

  if (!fromLat || !fromLon || !toLat || !toLon) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `http://127.0.0.1:8799/?fromLat=${fromLat}&fromLon=${fromLon}&toLat=${toLat}&toLon=${toLon}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // Fallback: straight line
    return NextResponse.json({
      points: [[+fromLat, +fromLon], [+toLat, +toLon]],
      distanceKm: 0,
      distanceNm: 0,
      numPoints: 2,
    });
  }
}
