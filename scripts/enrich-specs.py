#!/usr/bin/env python3
"""Enrich ship specs (DWT, year_built, builder) from public vessel databases.
Targets ships with placeholder/missing data. Sources: MarineTraffic, VesselFinder.
Cron: 0 2 * * * (nightly, max 200 ships per run to avoid rate limits)"""
import sqlite3, urllib.request, re, json, time, sys

DB = "/opt/bulkwatch/db/ships.db"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
DELAY = 5.0
MAX_PER_RUN = 200

# Default DWT values that need replacing
DEFAULT_DWTS = {5000, 10000, 15000, 20000, 45000, 50000, 55000}


def fetch_page(url):
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited, waiting 60s...", flush=True)
            time.sleep(60)
        return None
    except Exception:
        return None


def scrape_marinetraffic(imo):
    """Extract specs from MarineTraffic public page."""
    html = fetch_page(f"https://www.marinetraffic.com/en/ais/details/ships/imo:{imo}")
    if not html:
        return {}

    specs = {}

    # DWT
    m = re.search(r'Deadweight[^:]*:\s*([\d,]+)', html, re.I)
    if m:
        specs["dwt"] = int(m.group(1).replace(",", ""))

    # Year Built
    m = re.search(r'Year Built[^:]*:\s*(\d{4})', html, re.I)
    if not m:
        m = re.search(r'Built[^:]*:\s*(\d{4})', html, re.I)
    if m:
        yr = int(m.group(1))
        if 1950 <= yr <= 2030:
            specs["year_built"] = yr

    # Builder/Shipyard
    m = re.search(r'Shipyard[^:]*:\s*([^<\n]+)', html, re.I)
    if not m:
        m = re.search(r'Builder[^:]*:\s*([^<\n]+)', html, re.I)
    if m:
        builder = m.group(1).strip()
        if len(builder) > 2 and builder != "-":
            specs["builder"] = builder[:100]

    # Gross Tonnage
    m = re.search(r'Gross Tonnage[^:]*:\s*([\d,]+)', html, re.I)
    if m:
        specs["gross_tonnage"] = int(m.group(1).replace(",", ""))

    # Length
    m = re.search(r'Length[^:]*:\s*([\d.]+)\s*m', html, re.I)
    if m:
        specs["length"] = float(m.group(1))

    # Beam
    m = re.search(r'Beam[^:]*:\s*([\d.]+)\s*m', html, re.I)
    if m:
        specs["beam"] = float(m.group(1))

    return specs


def scrape_vesselfinder(imo):
    """Extract specs from VesselFinder public page."""
    html = fetch_page(f"https://www.vesselfinder.com/vessels/details/{imo}")
    if not html:
        return {}

    specs = {}

    # DWT
    m = re.search(r'"deadweight"\s*:\s*(\d+)', html)
    if not m:
        m = re.search(r'DWT[^:]*:\s*([\d,]+)', html, re.I)
    if m:
        val = int(str(m.group(1)).replace(",", ""))
        if val > 0:
            specs["dwt"] = val

    # Year Built
    m = re.search(r'"yearBuilt"\s*:\s*(\d{4})', html)
    if not m:
        m = re.search(r'Year[^:]*Built[^:]*:\s*(\d{4})', html, re.I)
    if m:
        yr = int(m.group(1))
        if 1950 <= yr <= 2030:
            specs["year_built"] = yr

    # Builder
    m = re.search(r'"builder"\s*:\s*"([^"]+)"', html)
    if not m:
        m = re.search(r'Builder[^:]*:\s*([^<\n]+)', html, re.I)
    if m:
        builder = m.group(1).strip()
        if len(builder) > 2 and builder != "-":
            specs["builder"] = builder[:100]

    # Gross Tonnage
    m = re.search(r'"grossTonnage"\s*:\s*(\d+)', html)
    if m:
        specs["gross_tonnage"] = int(m.group(1))

    # Length
    m = re.search(r'"length"\s*:\s*([\d.]+)', html)
    if m:
        specs["length"] = float(m.group(1))

    # Beam
    m = re.search(r'"beam"\s*:\s*([\d.]+)', html)
    if m:
        specs["beam"] = float(m.group(1))

    return specs


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # Find ships needing enrichment: placeholder DWT or missing year_built
    ships = con.execute("""
        SELECT imo, name, dwt, year_built, builder FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (
            (dwt IN (5000,10000,15000,20000,45000,50000,55000) AND (year_built IS NULL OR year_built = 0))
            OR (year_built IS NULL OR year_built = 0)
            OR (builder IS NULL OR builder = '')
        )
        ORDER BY dwt DESC
        LIMIT ?
    """, (MAX_PER_RUN,)).fetchall()

    print(f"Enriching specs for {len(ships)} ships...", flush=True)
    enriched = 0
    blocked = False

    for i, (imo, name, dwt, year_built, builder) in enumerate(ships):
        if blocked:
            break

        if i % 50 == 0 and i > 0:
            print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)

        # Try VesselFinder first (usually has better data)
        specs = scrape_vesselfinder(imo)

        # Fallback: MarineTraffic
        if not specs or ("dwt" not in specs and "year_built" not in specs):
            time.sleep(DELAY)
            specs2 = scrape_marinetraffic(imo)
            # Merge (VF takes priority)
            for k, v in specs2.items():
                if k not in specs:
                    specs[k] = v

        if not specs:
            time.sleep(DELAY)
            continue

        # Build UPDATE query — only update fields that are missing/placeholder
        updates = []
        params = []

        new_dwt = specs.get("dwt")
        if new_dwt and new_dwt > 100 and (dwt in DEFAULT_DWTS or dwt == 0):
            updates.append("dwt = ?")
            params.append(new_dwt)

        new_year = specs.get("year_built")
        if new_year and (not year_built or year_built == 0):
            updates.append("year_built = ?")
            params.append(new_year)

        new_builder = specs.get("builder")
        if new_builder and (not builder or builder == ""):
            updates.append("builder = ?")
            params.append(new_builder)

        new_gt = specs.get("gross_tonnage")
        if new_gt:
            updates.append("gross_tonnage = COALESCE(NULLIF(gross_tonnage, 0), ?)")
            params.append(new_gt)

        new_len = specs.get("length")
        if new_len and new_len > 10:
            updates.append("length = COALESCE(NULLIF(length, 0), ?)")
            params.append(new_len)

        new_beam = specs.get("beam")
        if new_beam and new_beam > 5:
            updates.append("beam = COALESCE(NULLIF(beam, 0), ?)")
            params.append(new_beam)

        if updates:
            params.append(imo)
            sql = f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?"
            con.execute(sql, params)
            con.commit()
            enriched += 1

            changes = []
            if new_dwt and (dwt in DEFAULT_DWTS or dwt == 0):
                changes.append(f"DWT {dwt}→{new_dwt}")
            if new_year and (not year_built or year_built == 0):
                changes.append(f"Year →{new_year}")
            if new_builder and (not builder or builder == ""):
                changes.append(f"Builder →{new_builder[:20]}")
            print(f"  OK  {name[:25]:25} {' | '.join(changes)}", flush=True)

        time.sleep(DELAY)

    con.close()
    print(f"\nDone: {enriched} ships enriched out of {len(ships)}", flush=True)


if __name__ == "__main__":
    main()
