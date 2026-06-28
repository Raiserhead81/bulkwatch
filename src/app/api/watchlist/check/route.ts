import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const STATE_FILE = "/opt/bulkwatch/db/watchlist_state.json";

interface ShipState {
  imageUrl: string | null;
  lat: number | null;
  lon: number | null;
  status: string;
  lastSeen: number | null;
}

interface WatchlistState {
  [imo: string]: ShipState;
}

function loadState(): WatchlistState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return {};
}

function saveState(state: WatchlistState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imos: string[] = body.imos;

    if (!Array.isArray(imos) || imos.length === 0) {
      return NextResponse.json({ error: "imos array required" }, { status: 400 });
    }

    // Limit to 100 IMOs
    const limitedImos = imos.slice(0, 100);
    const db = getDb();
    const prevState = loadState();
    const changes: Array<{
      imo: string;
      name: string;
      type: string;
      changes: Array<{ field: string; old: string | null; new: string | null }>;
    }> = [];

    const placeholders = limitedImos.map(() => "?").join(",");
    const rows = db.prepare(
      `SELECT imo, name, type, image_url, lat, lon, status, last_seen FROM ships WHERE imo IN (${placeholders})`
    ).all(...limitedImos) as Array<Record<string, unknown>>;

    const newState: WatchlistState = { ...prevState };

    for (const row of rows) {
      const imo = row.imo as string;
      const current: ShipState = {
        imageUrl: (row.image_url as string) || null,
        lat: (row.lat as number) || null,
        lon: (row.lon as number) || null,
        status: (row.status as string) || "active",
        lastSeen: (row.last_seen as number) || null,
      };

      const prev = prevState[imo];
      const shipChanges: Array<{ field: string; old: string | null; new: string | null }> = [];

      if (prev) {
        // Check image change
        if (prev.imageUrl !== current.imageUrl && current.imageUrl) {
          shipChanges.push({
            field: "image",
            old: prev.imageUrl ? "had image" : "no image",
            new: "new image available",
          });
        }

        // Check position change (significant movement: > 0.5 degrees)
        if (prev.lat && prev.lon && current.lat && current.lon) {
          const dlat = Math.abs((prev.lat) - (current.lat));
          const dlon = Math.abs((prev.lon) - (current.lon));
          if (dlat > 0.5 || dlon > 0.5) {
            shipChanges.push({
              field: "position",
              old: `${prev.lat.toFixed(2)}, ${prev.lon.toFixed(2)}`,
              new: `${current.lat.toFixed(2)}, ${current.lon.toFixed(2)}`,
            });
          }
        } else if (!prev.lat && current.lat) {
          shipChanges.push({
            field: "position",
            old: "unknown",
            new: `${current.lat.toFixed(2)}, ${current.lon!.toFixed(2)}`,
          });
        }

        // Check status change
        if (prev.status !== current.status) {
          shipChanges.push({
            field: "status",
            old: prev.status,
            new: current.status,
          });
        }
      }

      if (shipChanges.length > 0) {
        changes.push({
          imo,
          name: row.name as string,
          type: row.type as string,
          changes: shipChanges,
        });
      }

      newState[imo] = current;
    }

    // Save updated state
    saveState(newState);

    return NextResponse.json({
      checked: rows.length,
      changes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request", details: String(err) },
      { status: 400 }
    );
  }
}
