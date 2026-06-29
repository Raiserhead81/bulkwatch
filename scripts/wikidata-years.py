#!/usr/bin/env python3
"""Fetch year_built from Wikidata for all ships."""
import urllib.request, urllib.parse, json, sqlite3, time

DB = "/opt/bulkwatch/db/ships.db"

query = """SELECT ?imo (YEAR(?date) AS ?yearBuilt) WHERE {
  ?ship wdt:P458 ?imo .
  { ?ship wdt:P729 ?date } UNION { ?ship wdt:P571 ?date }
} LIMIT 10000"""

url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query, "format": "json"})
req = urllib.request.Request(url, headers={"User-Agent": "VesselDB/1.0 (hallo@gemivo.de)", "Accept": "application/json"})

try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    results = data.get("results", {}).get("bindings", [])
    print(f"Wikidata: {len(results)} ships with year_built")
except Exception as e:
    print(f"Wikidata error: {e}")
    results = []

if results:
    db = sqlite3.connect(DB)
    updated = 0
    for r in results:
        imo = r.get("imo", {}).get("value", "")
        year = r.get("yearBuilt", {}).get("value", "")
        if not imo or not year:
            continue
        try:
            y = int(year)
            if 1900 < y <= 2030:
                result = db.execute("UPDATE ships SET year_built = ? WHERE imo = ? AND (year_built = 0 OR year_built IS NULL)", (y, imo))
                if result.rowcount > 0:
                    updated += 1
        except:
            pass
    db.commit()

    known = db.execute("SELECT COUNT(*) FROM ships WHERE year_built > 1900").fetchone()[0]
    total = db.execute("SELECT COUNT(*) FROM ships").fetchone()[0]
    print(f"Updated {updated} ships with year_built")
    print(f"Total with year_built: {known} / {total}")
