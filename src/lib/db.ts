import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || "/opt/bulkwatch/db/ships.db";

let _db: InstanceType<typeof Database> | null = null;

export function getDb(): InstanceType<typeof Database> {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("synchronous = NORMAL");
    _db.exec(`CREATE TABLE IF NOT EXISTS ships (
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
    _db.exec("CREATE INDEX IF NOT EXISTS idx_type ON ships(type)");
    _db.exec("CREATE INDEX IF NOT EXISTS idx_flag ON ships(flag)");
    _db.exec("CREATE INDEX IF NOT EXISTS idx_name ON ships(name COLLATE NOCASE)");
  }
  return _db;
}