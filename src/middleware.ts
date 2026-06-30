import { NextRequest, NextResponse } from "next/server";

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

  const session = req.cookies.get("vessel_session")?.value;
  if (session) {
    // Only accept JSON sessions with username (not old "authenticated" string)
    try {
      const data = JSON.parse(session);
      if (data.username) return NextResponse.next();
    } catch {}
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon|manifest|.*\\.png$|.*\\.svg$).*)"],
};
