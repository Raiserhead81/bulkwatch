import type WebSocket from "ws";

export interface AisCacheEntry {
  mmsi: string;
  imo?: string;
  name?: string;
  lat: number;
  lon: number;
  sog?: number;
  cog?: number;
  heading?: number;
  navStatus?: number;
  shipType?: number;
  destination?: string;
  timestamp: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __aisCache: Map<string, AisCacheEntry> | undefined;
  // eslint-disable-next-line no-var
  var __aisWs: WebSocket | null | undefined;
}
