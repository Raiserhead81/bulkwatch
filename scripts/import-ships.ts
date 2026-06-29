import { Database } from "bun:sqlite";
import path from "path";
import { readFileSync } from "fs";

const DB_PATH = path.join(import.meta.dir, "../db/ships.db");
const db = new Database(DB_PATH, { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");
db.run(`CREATE TABLE IF NOT EXISTS ships (
  imo TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mmsi TEXT,
  type TEXT NOT NULL DEFAULT 'Other',
  dwt INTEGER DEFAULT 0,
  length REAL DEFAULT 0,
  beam REAL DEFAULT 0,
  draft REAL DEFAULT 0,
  year_built INTEGER DEFAULT 0,
  builder TEXT,
  flag TEXT DEFAULT 'Unknown',
  operator TEXT,
  home_port TEXT,
  image_url TEXT,
  image_attribution TEXT,
  lat REAL,
  lon REAL,
  last_seen INTEGER,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'wikidata'
)`);
db.run("CREATE INDEX IF NOT EXISTS idx_type ON ships(type)");
db.run("CREATE INDEX IF NOT EXISTS idx_flag ON ships(flag)");
db.run("CREATE INDEX IF NOT EXISTS idx_name ON ships(name COLLATE NOCASE)");

const { SHIPS } = await import("../src/data/ships");

const insert = db.prepare(`INSERT OR REPLACE INTO ships 
  (imo, name, mmsi, type, dwt, length, beam, draft, year_built, builder, flag, operator, home_port, image_url, image_attribution, status, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertMany = db.transaction((ships: typeof SHIPS) => {
  for (const s of ships) {
    if (!s.imo || s.imo.length < 5) continue;
    const source = s.imageUrl && !s.imageUrl.includes("wikimedia") ? "real" :
                   s.imageUrl ? "wikimedia" : "wikidata";
    insert.run(
      s.imo, s.name, (s as any).mmsi || null, s.type,
      s.dwt || 0, s.length || 0, s.beam || 0, s.draft || 0,
      s.yearBuilt || 0, s.builder || null, s.flag || "Unknown",
      s.operator || null, s.homePort || null,
      s.imageUrl || null, s.imageAttribution || null,
      s.status || "active", source
    );
  }
});

console.log(`Importing ${SHIPS.length} ships...`);
insertMany(SHIPS);
console.log("Ships imported.");

const aisPath = path.join(import.meta.dir, "../src/data/ais-ships.json");
const aisData = JSON.parse(readFileSync(aisPath, "utf-8"));
const updatePos = db.prepare(`UPDATE ships SET lat=?, lon=?, last_seen=?, mmsi=COALESCE(mmsi,?) WHERE imo=?`);
const updatePositions = db.transaction((ais: Record<string, any>) => {
  let updated = 0;
  for (const [imo, entry] of Object.entries(ais)) {
    if (entry.lat && entry.lon) {
      updatePos.run(entry.lat, entry.lon, entry.lastSeen || null, entry.mmsi || null, imo);
      updated++;
    }
  }
  return updated;
});
const posUpdated = updatePositions(aisData);
console.log(`Updated ${posUpdated} positions from AIS.`);

const total = (db.prepare("SELECT COUNT(*) as c FROM ships").get() as any).c;
console.log(`Total ships in DB: ${total}`);
db.close();