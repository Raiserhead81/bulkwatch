#!/usr/bin/env python3
"""Scrape year_built + owner from DNV Vessel Register using Playwright."""
import sqlite3, re, time, sys

DB = "/opt/bulkwatch/db/ships.db"

def scrape_dnv_ship(page, imo):
    """Search DNV for a single ship by IMO."""
    try:
        page.goto(f"https://vesselregister.dnv.com/vesselregister?searchterm={imo}", timeout=15000)
        page.wait_for_timeout(3000)

        # Try to click on the ship result
        try:
            link = page.query_selector(f'a:has-text("{imo}")')
            if link:
                link.click()
                page.wait_for_timeout(2000)
        except:
            pass

        text = page.text_content("body") or ""
        return text[:5000]
    except Exception as e:
        return ""

def extract_data(text):
    """Extract year_built and owner from page text."""
    year = None
    owner = None

    # Year patterns
    for p in [
        r"(?:Year\s*(?:of\s*)?Build|Built|Build\s*Year|Delivery\s*Date|Year\s*Built)[:\s]*(\d{4})",
        r"(?:Keel\s*Laid|Launch(?:ed)?|Completed)[:\s]*\d{2}[./]\d{2}[./](\d{4})",
        r"(\d{4})\s*(?:Build|Built)",
    ]:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            y = int(m.group(1))
            if 1950 <= y <= 2030:
                year = y
                break

    # Owner patterns
    for p in [
        r"(?:Registered\s*Owner|Ship\s*Owner|Owner)[:\s]*([A-Z][A-Za-z\s&.,'\-()]+?)(?:\n|\r|$|Operator|Manager|Flag|Port)",
        r"(?:Technical\s*Manager|ISM\s*Manager|Manager)[:\s]*([A-Z][A-Za-z\s&.,'\-()]+?)(?:\n|\r|$|Owner|Flag|Port)",
    ]:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            o = m.group(1).strip()
            if len(o) > 3 and len(o) < 100:
                owner = o
                break

    return year, owner

def main():
    from playwright.sync_api import sync_playwright

    db = sqlite3.connect(DB)
    ships = db.execute(
        "SELECT imo, name FROM ships WHERE (year_built = 0 OR year_built IS NULL) ORDER BY dwt DESC LIMIT 200"
    ).fetchall()

    print(f"Scraping DNV for {len(ships)} ships using Playwright...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        updated_year = 0
        updated_owner = 0

        for i, (imo, name) in enumerate(ships):
            if i % 10 == 0:
                print(f"  [{i}/{len(ships)}] years={updated_year} owners={updated_owner}", flush=True)

            text = scrape_dnv_ship(page, imo)
            if not text or len(text) < 100:
                continue

            year, owner = extract_data(text)

            sets = []
            params = []
            if year:
                sets.append("year_built = ?")
                params.append(year)
                updated_year += 1
            if owner:
                sets.append("operator = CASE WHEN operator IS NULL OR operator = '' THEN ? ELSE operator END")
                params.append(owner)
                updated_owner += 1

            if sets:
                params.append(imo)
                db.execute(f"UPDATE ships SET {', '.join(sets)} WHERE imo = ?", params)
                if i % 20 == 0:
                    db.commit()

            time.sleep(1.5)

        browser.close()

    db.commit()

    known = db.execute("SELECT COUNT(*) FROM ships WHERE year_built > 1900").fetchone()[0]
    total = db.execute("SELECT COUNT(*) FROM ships").fetchone()[0]
    print(f"\nDone! Updated years: {updated_year}, owners: {updated_owner}")
    print(f"Total with year_built: {known} / {total}")

if __name__ == "__main__":
    main()
