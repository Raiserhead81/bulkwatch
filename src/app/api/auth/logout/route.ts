import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("vessel_session", "", {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0,
  });
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", "https://vessels.gemivo.de"));
  res.cookies.set("vessel_session", "", {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0,
  });
  return res;
}
