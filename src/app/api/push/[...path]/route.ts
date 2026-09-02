// Same-Origin-Proxy zum zentralen Gemivo-Push-Hub.
// Noetig, weil die CSP dieser App (connect-src self) direkte Hub-Aufrufe blockt.
// Bewusst NUR die clientseitigen Endpunkte; /send (Admin-Token) wird nicht durchgereicht.
import { NextRequest, NextResponse } from "next/server";

const HUB = "http://127.0.0.1:3102";
const ALLOWED = new Set(["vapid", "subscribe", "unsubscribe"]);

async function proxy(req: NextRequest, path: string[]) {
  const p = path.join("/");
  if (!ALLOWED.has(p)) return NextResponse.json({ error: "not allowed" }, { status: 404 });
  const init: RequestInit = { method: req.method };
  if (req.method === "POST") {
    init.body = await req.text();
    init.headers = { "Content-Type": "application/json" };
  }
  const r = await fetch(`${HUB}/${p}`, init);
  return NextResponse.json(await r.json(), { status: r.status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
