import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("vessel_session")?.value;
  if (!session) return NextResponse.json({ user: null });
  try {
    const data = JSON.parse(session);
    if (data.username) return NextResponse.json({ user: data });
  } catch {}
  return NextResponse.json({ user: null });
}
