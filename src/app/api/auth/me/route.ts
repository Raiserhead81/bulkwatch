import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("vessel_session")?.value;
  if (!cookie) return NextResponse.json({ user: null });

  // Try signed session first
  const session = verifySession(cookie);
  if (session && session.username) {
    return NextResponse.json({ user: session });
  }

  // Legacy fallback: plain JSON (will be replaced on next login)
  try {
    const data = JSON.parse(cookie);
    if (data.username) return NextResponse.json({ user: data });
  } catch {}

  return NextResponse.json({ user: null });
}
