import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  // Simple password check — same as the old htpasswd
  const VALID_PASSWORD = process.env.VESSEL_PASSWORD || "vessel2026";

  if (password === VALID_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("vessel_session", "authenticated", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    return res;
  }

  return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
}
