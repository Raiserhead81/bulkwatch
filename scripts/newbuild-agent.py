#!/usr/bin/env python3
"""Newbuild Agent — scrapes newbuilding orders from multiple sources daily."""
import sqlite3, urllib.request, urllib.parse, json, time, re, sys
from datetime import datetime

DB = "/opt/bulkwatch/db/ships.db"
LOG = "/opt/bulkwatch/newbuild-agent.log"
UA = "VesselDB/1.0 (hallo@gemivo.de)"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def fetch_url(url, headers=None):
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        log(f"  Fetch error {url}: {e}")
        return None

def fetch_json(url):
    raw = fetch_url(url, {"Accept": "application/json"})
    if raw:
        try:
            return json.loads(raw)
        except:
            pass
    return None

# ── Source 1: Wikidata SPARQL (ships with inception >= 2024) ─────────────────
def scrape_wikidata():
    log("Source 1: Wikidata SPARQL newbuilds...")
    sparql = """
    SELECT ?imo ?name ?dwt ?length ?beam ?draft ?yearBuilt
           ?operatorLabel ?builderLabel ?flagLabel
    WHERE {
      ?ship wdt:P458 ?imo .
      ?ship rdfs:label ?name . FILTER(LANG(?name) = "en")
      { ?ship wdt:P729 ?date } UNION { ?ship wdt:P571 ?date }
      FILTER(YEAR(?date) >= 2025)
      OPTIONAL { ?ship wdt:P1093 ?dwt }
      OPTIONAL { ?ship wdt:P2043 ?length }
      OPTIONAL { ?ship wdt:P2261 ?beam }
      OPTIONAL { ?ship wdt:P2262 ?draft }
      OPTIONAL { ?ship wdt:P8047 ?operator }
      OPTIONAL { ?ship wdt:P176 ?builder }
      OPTIONAL { ?ship wdt:P17 ?flag }
      BIND(YEAR(?date) AS ?yearBuilt)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de" }
    }
    LIMIT 500
    """
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
    data = fetch_json(url)
    if not data:
        log("  Wikidata unavailable (rate limited?)")
        return []

    results = []
    for r in data.get("results", {}).get("bindings", []):
        imo = r.get("imo", {}).get("value", "")
        name = r.get("name", {}).get("value", "")
        if not imo or not name:
            continue
        results.append({
            "imo": imo,
            "name": name,
            "dwt": int(float(r.get("dwt", {}).get("value", "0") or "0")),
            "length": float(r.get("length", {}).get("value", "0") or "0"),
            "beam": float(r.get("beam", {}).get("value", "0") or "0"),
            "draft": float(r.get("draft", {}).get("value", "0") or "0"),
            "year": int(r.get("yearBuilt", {}).get("value", "0") or "0"),
            "operator": r.get("operatorLabel", {}).get("value", ""),
            "builder": r.get("builderLabel", {}).get("value", ""),
            "flag": r.get("flagLabel", {}).get("value", ""),
            "source": "wikidata",
        })
    log(f"  Wikidata: {len(results)} newbuilds found")
    return results

# ── Source 2: VesselsValue / public orderbook pages ──────────────────────────
def scrape_tradewinds_orderbook():
    log("Source 2: TradeWinds/public orderbook scrape...")
    # TradeWinds and Clarksons require paid access, but some data is on
    # MarineTraffic and public news sites. We scrape expected deliveries.
    results = []

    # Try MarineTraffic expected arrivals (limited without API key)
    html = fetch_url("https://www.marinetraffic.com/en/data/?asset_type=newbuildings")
    if html and "newbuild" in html.lower():
        # Parse what we can from the public page
        imos = re.findall(r'IMO[:\s]*(\d{7})', html)
        log(f"  MarineTraffic: found {len(imos)} IMO references")
        for imo in imos[:50]:
            results.append({"imo": imo, "source": "marinetraffic"})
    else:
        log("  MarineTraffic: no public data available")

    return results

# ── Source 3: Scan existing DB for ships with future year_built ──────────────
def check_existing_future_builds(db):
    log("Source 3: Check existing DB for future builds...")
    current_year = datetime.now().year
    rows = db.execute(
        "SELECT imo, name, year_built, builder, operator FROM ships WHERE year_built >= ? AND status != 'under_construction'",
        (current_year,)
    ).fetchall()
    updated = 0
    for imo, name, year, builder, operator in rows:
        db.execute("UPDATE ships SET status = 'under_construction' WHERE imo = ?", (imo,))
        updated += 1
    if updated:
        db.commit()
    log(f"  Reclassified {updated} ships as under_construction")
    return updated

# ── Source 4: Check scrapped (very old ships still marked active) ────────────
def check_scrapped(db):
    log("Source 4: Check for likely scrapped ships...")
    current_year = datetime.now().year
    # Ships built before 1985 without recent AIS = likely scrapped
    rows = db.execute("""
        UPDATE ships SET status = 'scrapped'
        WHERE year_built > 0 AND year_built < 1985
        AND (lat IS NULL OR lat = 0)
        AND status = 'active'
    """)
    db.commit()
    count = db.execute("SELECT changes()").fetchone()[0]
    log(f"  Marked {count} old ships as scrapped")

    # Ships built before 1995 without AIS for > 2 years = likely scrapped
    cutoff = int(time.time()) - (2 * 365 * 86400)
    db.execute("""
        UPDATE ships SET status = 'scrapped'
        WHERE year_built > 0 AND year_built < 1995
        AND last_seen > 0 AND last_seen < ?
        AND status = 'active'
    """, (cutoff,))
    db.commit()
    count2 = db.execute("SELECT changes()").fetchone()[0]
    log(f"  Marked {count2} ships with stale AIS as scrapped")

    return count + count2

# ── Upsert newbuild into DB ──────────────────────────────────────────────────
def upsert_newbuild(db, ship):
    imo = ship.get("imo", "")
    if not imo:
        return False

    name = ship.get("name", "")
    dwt = ship.get("dwt", 0)
    length = ship.get("length", 0)
    beam = ship.get("beam", 0)
    draft = ship.get("draft", 0)
    year = ship.get("year", 0)
    operator = ship.get("operator", "")
    builder = ship.get("builder", "")
    flag = ship.get("flag", "")
    source = ship.get("source", "agent")

    # Clean Wikidata Q-IDs
    if operator and operator.startswith("Q") and operator[1:].isdigit():
        operator = ""
    if builder and builder.startswith("Q") and builder[1:].isdigit():
        builder = ""
    if flag and flag.startswith("Q") and flag[1:].isdigit():
        flag = ""

    # Determine type from DWT if not set
    ship_type = ship.get("type", "")
    if not ship_type and dwt > 0:
        if dwt >= 200000: ship_type = "Newcastlemax"
        elif dwt >= 100000: ship_type = "Capesize"
        elif dwt >= 80000: ship_type = "Kamsarmax"
        elif dwt >= 60000: ship_type = "Ultramax"
        elif dwt >= 40000: ship_type = "Supramax"
        elif dwt >= 25000: ship_type = "Handysize"
        else: ship_type = "Bulk Carrier"
    if not ship_type:
        ship_type = "Other"

    current_year = datetime.now().year
    status = "under_construction" if year >= current_year else "active"
    delivery = f"{year}-Q4" if year else ""

    existing = db.execute("SELECT imo, status FROM ships WHERE imo = ?", (imo,)).fetchone()
    if existing:
        # Only update if we have better data
        sets = []
        params = []
        if dwt > 0:
            sets.append("dwt = ?"); params.append(dwt)
        if length > 0:
            sets.append("length = ?"); params.append(length)
        if beam > 0:
            sets.append("beam = ?"); params.append(beam)
        if draft > 0:
            sets.append("draft = ?"); params.append(draft)
        if year > 0:
            sets.append("year_built = ?"); params.append(year)
        if operator:
            sets.append("operator = ?"); params.append(operator)
        if builder:
            sets.append("builder = ?"); params.append(builder)
        if flag:
            sets.append("flag = ?"); params.append(flag)
        if status == "under_construction":
            sets.append("status = ?"); params.append(status)
            sets.append("delivery_date = ?"); params.append(delivery)
        if sets:
            params.append(imo)
            db.execute(f"UPDATE ships SET {', '.join(sets)} WHERE imo = ?", params)
            return True
    else:
        if not name:
            return False
        db.execute("""INSERT INTO ships (imo, name, type, dwt, length, beam, draft, year_built,
                      builder, operator, flag, status, delivery_date, source)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                   (imo, name, ship_type, dwt, length, beam, draft, year,
                    builder, operator, flag, status, delivery, f"agent-{source}"))
        return True
    return False

# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    log("=" * 60)
    log("Newbuild Agent starting...")

    db = sqlite3.connect(DB)

    # Count before
    before = db.execute("SELECT COUNT(*) FROM ships WHERE status = 'under_construction'").fetchone()[0]

    # Run all sources
    all_ships = []

    wikidata_ships = scrape_wikidata()
    all_ships.extend(wikidata_ships)
    time.sleep(2)

    # Check existing DB
    check_existing_future_builds(db)
    check_scrapped(db)

    # Upsert all found newbuilds
    added = 0
    for ship in all_ships:
        if upsert_newbuild(db, ship):
            added += 1
    db.commit()

    # Count after
    after = db.execute("SELECT COUNT(*) FROM ships WHERE status = 'under_construction'").fetchone()[0]

    log(f"\nResults:")
    log(f"  Sources checked: 3")
    log(f"  New/updated ships: {added}")
    log(f"  Under construction: {before} -> {after}")

    # Status summary
    log("\nStatus distribution:")
    for row in db.execute("SELECT status, COUNT(*) FROM ships GROUP BY status ORDER BY COUNT(*) DESC"):
        log(f"  {row[0]}: {row[1]}")

    db.close()
    log("Newbuild Agent done.")
    log("=" * 60)

if __name__ == "__main__":
    main()
