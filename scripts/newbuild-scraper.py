#!/usr/bin/env python3
"""Fetch newbuilding orders from Wikidata — ships under construction or recently ordered."""
import sqlite3, urllib.request, urllib.parse, json, time

DB = "/opt/bulkwatch/db/ships.db"

def query_wikidata_newbuilds():
    """Find ships launched/ordered 2024-2027 from Wikidata."""
    sparql = """
    SELECT ?imo ?name ?dwt ?length ?beam ?draft ?yearBuilt ?operatorLabel ?builderLabel ?flagLabel ?typeLabel
    WHERE {
      ?ship wdt:P458 ?imo .
      ?ship rdfs:label ?name . FILTER(LANG(?name) = "en")
      OPTIONAL { ?ship wdt:P1093 ?dwt }
      OPTIONAL { ?ship wdt:P2043 ?length }
      OPTIONAL { ?ship wdt:P2261 ?beam }
      OPTIONAL { ?ship wdt:P2262 ?draft }
      OPTIONAL { ?ship wdt:P729 ?launchDate }
      OPTIONAL { ?ship wdt:P571 ?inception }
      OPTIONAL { ?ship wdt:P8047 ?operator }
      OPTIONAL { ?ship wdt:P176 ?builder }
      OPTIONAL { ?ship wdt:P17 ?flag }
      OPTIONAL { ?ship wdt:P31 ?type }
      BIND(YEAR(COALESCE(?launchDate, ?inception)) AS ?yearBuilt)
      FILTER(?yearBuilt >= 2024)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de" }
    }
    LIMIT 500
    """
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
    req = urllib.request.Request(url, headers={
        "User-Agent": "VesselDB/1.0 (hallo@gemivo.de)",
        "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
        return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"Wikidata error: {e}")
        return []

def main():
    db = sqlite3.connect(DB)

    print("Fetching newbuilds from Wikidata...")
    results = query_wikidata_newbuilds()
    print(f"Got {len(results)} results")

    added = 0
    updated = 0

    for r in results:
        imo = r.get("imo", {}).get("value", "")
        name = r.get("name", {}).get("value", "")
        if not imo or not name:
            continue

        dwt = int(float(r.get("dwt", {}).get("value", "0") or "0"))
        length = float(r.get("length", {}).get("value", "0") or "0")
        beam = float(r.get("beam", {}).get("value", "0") or "0")
        draft = float(r.get("draft", {}).get("value", "0") or "0")
        year = int(r.get("yearBuilt", {}).get("value", "0") or "0")
        operator = r.get("operatorLabel", {}).get("value", "")
        builder = r.get("builderLabel", {}).get("value", "")
        flag = r.get("flagLabel", {}).get("value", "")
        ship_type = r.get("typeLabel", {}).get("value", "")

        if operator and operator.startswith("Q"): operator = ""
        if builder and builder.startswith("Q"): builder = ""
        if flag and flag.startswith("Q"): flag = ""

        # Determine type
        t = ship_type.lower() if ship_type else ""
        if "bulk" in t: ship_type = "Bulk Carrier"
        elif "container" in t: ship_type = "Container Ship"
        elif "tanker" in t or "oil" in t: ship_type = "Tanker"
        elif "lng" in t or "gas" in t: ship_type = "LNG Tanker"
        elif "cargo" in t: ship_type = "General Cargo"
        elif not ship_type or ship_type.startswith("Q"): ship_type = "Other"

        # Determine status
        from datetime import datetime
        current_year = datetime.now().year
        status = "under_construction" if year >= current_year else "active"

        existing = db.execute("SELECT imo FROM ships WHERE imo = ?", (imo,)).fetchone()
        if existing:
            db.execute("""UPDATE ships SET
                dwt = CASE WHEN ? > 0 THEN ? ELSE dwt END,
                length = CASE WHEN ? > 0 THEN ? ELSE length END,
                beam = CASE WHEN ? > 0 THEN ? ELSE beam END,
                draft = CASE WHEN ? > 0 THEN ? ELSE draft END,
                year_built = CASE WHEN ? > 0 THEN ? ELSE year_built END,
                operator = CASE WHEN ? != '' THEN ? ELSE operator END,
                builder = CASE WHEN ? != '' THEN ? ELSE builder END,
                flag = CASE WHEN ? != '' THEN ? ELSE flag END,
                status = ?
                WHERE imo = ?""",
                (dwt, dwt, length, length, beam, beam, draft, draft,
                 year, year, operator, operator, builder, builder, flag, flag,
                 status, imo))
            updated += 1
        else:
            db.execute("""INSERT INTO ships (imo, name, type, dwt, length, beam, draft, year_built,
                          operator, builder, flag, status, source)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'wikidata-newbuild')""",
                       (imo, name, ship_type, dwt, length, beam, draft, year,
                        operator, builder, flag, status))
            added += 1

    db.commit()

    # Also update status in DB schema if needed
    uc = db.execute("SELECT COUNT(*) FROM ships WHERE status = 'under_construction'").fetchone()[0]

    print(f"\nAdded: {added}, Updated: {updated}")
    print(f"Under construction: {uc}")
    print(f"\nStatus distribution:")
    for row in db.execute("SELECT status, COUNT(*) FROM ships GROUP BY status ORDER BY COUNT(*) DESC"):
        print(f"  {row[0]}: {row[1]}")

if __name__ == "__main__":
    main()
