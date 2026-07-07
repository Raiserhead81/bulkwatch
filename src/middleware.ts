import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════
// In-memory rate limiting (per IP)
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, number[]>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/ships": { max: 60, windowMs: 60_000 },
  "/api/ships/pdf": { max: 30, windowMs: 60_000 },
};

function isRateLimited(ip: string, pathname: string): boolean {
  // Find matching rate limit rule
  let rule: { max: number; windowMs: number } | undefined;
  if (pathname.endsWith("/pdf")) {
    rule = RATE_LIMITS["/api/ships/pdf"];
  } else if (pathname.startsWith("/api/ships")) {
    rule = RATE_LIMITS["/api/ships"];
  }
  if (!rule) return false;

  const key = ip + ":" + (pathname.endsWith("/pdf") ? "pdf" : "ships");
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];

  // Remove old entries outside window
  const recent = timestamps.filter(t => now - t < rule!.windowMs);

  if (recent.length >= rule.max) {
    return true;
  }

  recent.push(now);
  rateLimitMap.set(key, recent);

  // Periodic cleanup: remove stale IPs every ~100 requests
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap) {
      const fresh = v.filter(t => now - t < 120_000);
      if (fresh.length === 0) rateLimitMap.delete(k);
      else rateLimitMap.set(k, fresh);
    }
  }

  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limiting for API endpoints
  if (pathname.startsWith("/api/ships")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            || req.headers.get("x-real-ip")
            || "unknown";
    if (isRateLimited(ip, pathname)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

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
