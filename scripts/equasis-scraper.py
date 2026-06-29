#!/usr/bin/env python3
"""Equasis Scraper — enriches ship data (GT, year_built, type, flag) from equasis.org.
Targets ships with placeholder DWT or missing year_built.
Cron: 0 2 * * * (nightly, max 100 ships per run — Equasis rate limits aggressively)"""
import sqlite3, time, re, sys

DB = "/opt/bulkwatch/db/ships.db"
MAX_PER_RUN = 100
DELAY = 6.0  # Equasis limits to ~10 req/min

EMAIL = "kayconrad@posteo.de"
PASSWORD = "!nfinitY!981"


def create_session():
    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Login
    page.goto("https://www.equasis.org/EquasisWeb/public/HomePage", wait_until="networkidle", timeout=20000)
    page.wait_for_timeout(2000)

    inputs = page.query_selector_all("input[name=j_email]")
    for inp in inputs:
        if inp.is_visible():
            inp.fill(EMAIL)
            break
    pwds = page.query_selector_all("input[name=j_password]")
    for pw in pwds:
        if pw.is_visible():
            pw.fill(PASSWORD)
            break
    submits = page.query_selector_all("input[type=submit]")
    for s in submits:
        if s.is_visible():
            s.click()
            break

    page.wait_for_timeout(3000)
    logged_in = "Search" in page.inner_text("body")
    if not logged_in:
        print("Login failed!", flush=True)
        browser.close()
        p.stop()
        return None, None, None

    print("Equasis login OK", flush=True)
    return p, browser, page


def search_ship(page, imo):
    """Search for a ship by IMO and extract data from results."""
    # Use the home search field
    home = page.query_selector("input[name=P_ENTREE_HOME]")
    if not home or not home.is_visible():
        # Navigate back to home
        page.goto("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage",
                   wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(1000)
        home = page.query_selector("input[name=P_ENTREE_HOME]")

    if not home:
        return None

    home.fill("")
    home.fill(str(imo))
    page.keyboard.press("Enter")
    page.wait_for_timeout(3000)

    text = page.inner_text("body")

    # Parse results table: "IMO number	Name of ship	Gross tonnage	Type of ship	Year of build	Flag"
    lines = text.split("\n")
    for line in lines:
        if str(imo) in line:
            parts = line.split("\t")
            if len(parts) >= 6:
                return {
                    "imo": parts[0].strip(),
                    "name": parts[1].strip(),
                    "gross_tonnage": int(parts[2].strip()) if parts[2].strip().isdigit() else None,
                    "type": parts[3].strip(),
                    "year_built": int(parts[4].strip()) if parts[4].strip().isdigit() else None,
                    "flag": parts[5].strip(),
                }
            # Try space-separated
            m = re.match(r"(\d{7})\s+(.+?)\s+(\d+)\s+(.*?)\s+(\d{4})\s+(.+)", line)
            if m:
                return {
                    "imo": m.group(1),
                    "name": m.group(2).strip(),
                    "gross_tonnage": int(m.group(3)),
                    "type": m.group(4).strip(),
                    "year_built": int(m.group(5)),
                    "flag": m.group(6).strip(),
                }
    return None


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # Ships needing enrichment
    DEFAULT_DWTS = (5000, 10000, 15000, 20000, 45000, 50000, 55000)
    placeholders = ",".join("?" * len(DEFAULT_DWTS))
    ships = con.execute(f"""
        SELECT imo, name, dwt, year_built, gross_tonnage FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (
            (dwt IN ({placeholders}) AND (year_built IS NULL OR year_built = 0))
            OR (year_built IS NULL OR year_built = 0)
            OR (gross_tonnage IS NULL OR gross_tonnage = 0)
        )
        ORDER BY dwt DESC
        LIMIT ?
    """, (*DEFAULT_DWTS, MAX_PER_RUN)).fetchall()

    print(f"Enriching {len(ships)} ships from Equasis...", flush=True)

    p, browser, page = create_session()
    if not page:
        return

    enriched = 0
    try:
        for i, (imo, name, dwt, year_built, gt) in enumerate(ships):
            if i % 20 == 0 and i > 0:
                print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)

            data = search_ship(page, imo)
            if not data:
                time.sleep(DELAY)
                continue

            updates = []
            params = []

            # Update gross_tonnage (always trust Equasis)
            if data.get("gross_tonnage") and data["gross_tonnage"] > 0:
                updates.append("gross_tonnage = ?")
                params.append(data["gross_tonnage"])

            # Update year_built if missing
            if data.get("year_built") and (not year_built or year_built == 0):
                updates.append("year_built = ?")
                params.append(data["year_built"])

            # Update flag if from Equasis (more reliable)
            if data.get("flag"):
                # Extract country name from "Ireland (IRL)" format
                flag = re.sub(r"\s*\([A-Z]+\)\s*$", "", data["flag"]).strip()
                if flag:
                    updates.append("flag = ?")
                    params.append(flag)

            if updates:
                params.append(imo)
                con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
                con.commit()
                enriched += 1

                changes = []
                if data.get("gross_tonnage"):
                    changes.append(f"GT={data['gross_tonnage']}")
                if data.get("year_built") and (not year_built or year_built == 0):
                    changes.append(f"Year={data['year_built']}")
                if data.get("flag"):
                    changes.append(f"Flag={data['flag']}")
                print(f"  OK  {name[:25]:25} {' | '.join(changes)}", flush=True)

            time.sleep(DELAY)

    finally:
        browser.close()
        p.stop()

    con.close()
    print(f"\nDone: {enriched} ships enriched from Equasis", flush=True)


if __name__ == "__main__":
    main()
