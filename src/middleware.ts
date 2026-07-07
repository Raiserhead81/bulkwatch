import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════════
// In-memory rate limiting (per IP, per route category)
// ═══════════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, number[]>();

interface RateRule { max: number; windowMs: number }

const RATE_RULES: Array<{ match: (p: string) => boolean; key: string; rule: RateRule }> = [
  { match: p => p.startsWith("/api/chat"),     key: "chat",   rule: { max: 10, windowMs: 60_000 } },
  { match: p => p.endsWith("/pdf"),            key: "pdf",    rule: { max: 30, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/admin"),    key: "admin",  rule: { max: 30, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/users"),    key: "users",  rule: { max: 30, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/ais"),      key: "ais",    rule: { max: 60, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/market"),   key: "market", rule: { max: 60, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/ships"),    key: "ships",  rule: { max: 60, windowMs: 60_000 } },
  { match: p => p.startsWith("/api/"),         key: "api",    rule: { max: 60, windowMs: 60_000 } },
];

function isRateLimited(ip: string, pathname: string): boolean {
  const matched = RATE_RULES.find(r => r.match(pathname));
  if (!matched) return false;

  const key = ip + ":" + matched.key;
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) ?? [];
  const recent = timestamps.filter(t => now - t < matched.rule.windowMs);

  if (recent.length >= matched.rule.max) return true;

  recent.push(now);
  rateLimitMap.set(key, recent);

  // Periodic cleanup
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap) {
      const fresh = v.filter(t => now - t < 120_000);
      if (fresh.length === 0) rateLimitMap.delete(k);
      else rateLimitMap.set(k, fresh);
    }
  }

  return false;
}

const ALLOWED_ORIGINS = [
  "https://vessels.gemivo.de",
  "http://localhost:3099",
];

function isOriginAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (origin) return ALLOWED_ORIGINS.some(o => origin === o);
  if (referer) return ALLOWED_ORIGINS.some(o => referer.startsWith(o));
  // No origin/referer = same-site navigation (browser forms, curl, etc.)
  return true;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF protection: block mutating requests from foreign origins
  const method = req.method;
  if (pathname.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    if (!isOriginAllowed(req)) {
      return NextResponse.json(
        { error: "CSRF check failed: origin not allowed" },
        { status: 403 }
      );
    }
  }

  // Rate limiting for all API endpoints
  if (pathname.startsWith("/api/")) {
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

  // Public paths that need no auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Public API endpoints (no auth required)
  const publicApiPaths = ["/api/auth/login", "/api/auth/logout", "/api/version"];
  if (publicApiPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other API endpoints require auth
  if (pathname.startsWith("/api")) {
    const cookie = req.cookies.get("vessel_session")?.value;
    if (!cookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = verifySession(cookie);
    if (!session || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const cookie = req.cookies.get("vessel_session")?.value;
  if (cookie) {
    const session = verifySession(cookie);
    if (session && session.username) return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|icon|manifest|.*\\.png$|.*\\.svg$).*)"],
};
