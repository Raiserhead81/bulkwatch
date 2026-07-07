import { NextResponse } from "next/server";
import WebSocket from "ws";
import "@/types/ais";

declare global {
  // eslint-disable-next-line no-var
  var __aisLastMsg: number | undefined;
  // eslint-disable-next-line no-var
  var __aisStarted: number | undefined;
}

export async function GET() {
  const cache = globalThis.__aisCache;
  if (!cache) {
    return NextResponse.json({
      totalShips: 0,
      activeShips: 0,
      lastMessage: 0,
      uptime: 0,
      wsConnected: false,
      cacheTtlSec: 1800,
    });
  }

  const now = Date.now();
  const CACHE_TTL_MS = 30 * 60 * 1000;
  let active = 0;
  for (const s of cache.values()) {
    if (now - s.timestamp < CACHE_TTL_MS) active++;
  }

  return NextResponse.json({
    totalShips: cache.size,
    activeShips: active,
    lastMessage: globalThis.__aisLastMsg || 0,
    uptime: globalThis.__aisStarted ? now - globalThis.__aisStarted : 0,
    wsConnected: globalThis.__aisWs?.readyState === WebSocket.OPEN,
    cacheTtlSec: 1800,
  });
}
