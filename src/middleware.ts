import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export const runtime = "nodejs";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("vessel_session")?.value;
  if (cookie) {
    // Try signed session first
    const session = verifySession(cookie);
    if (session && session.username) return NextResponse.next();

    // Legacy fallback: plain JSON (will be replaced on next login)
    try {
      const data = JSON.parse(cookie);
      if (data.username) return NextResponse.next();
    } catch {}
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon|manifest|.*\\.png$|.*\\.svg$).*)"],
};
