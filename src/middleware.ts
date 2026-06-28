import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static + API: always pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = req.cookies.get("vessel_session")?.value;
  if (session === "authenticated") {
    return NextResponse.next();
  }

  // No session -> login page
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon|manifest|.*\\.png$|.*\\.svg$).*)"],
};
