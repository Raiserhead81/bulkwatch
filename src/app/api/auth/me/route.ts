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



  return NextResponse.json({ user: null });
}
