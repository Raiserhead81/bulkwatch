#!/usr/bin/env python3
"""Scrape ship data from DNV Vessel Register using Playwright."""
import sqlite3, json, time, subprocess, sys

DB = "/opt/bulkwatch/db/ships.db"

def scrape_dnv(imo):
    """Use Playwright to load DNV page and extract ship data."""
    script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
    const browser = await chromium.launch({{ headless: true }});
    const page = await browser.newPage();
    try {{
        await page.goto('https://vesselregister.dnv.com/vesselregister', {{ timeout: 15000 }});
        await page.waitForTimeout(2000);
        // Search for IMO
        const input = await page.$('input[type="text"], input[placeholder*="Search"], input[name*="search"]');
        if (input) {{
            await input.fill('{imo}');
            await input.press('Enter');
            await page.waitForTimeout(3000);
            // Click first result
            const link = await page.$('a[href*="vessel"], tr td a, .search-result a');
            if (link) {{
                await link.click();
                await page.waitForTimeout(3000);
            }}
        }}
        const text = await page.textContent('body');
        console.log(JSON.stringify({{ text: text.substring(0, 5000) }}));
    }} catch(e) {{
        console.log(JSON.stringify({{ error: e.message }}));
    }}
    await browser.close();
}})();
"""
    try:
        result = subprocess.run(
            ["node", "-e", script],
            capture_output=True, text=True, timeout=30,
            env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": "/root"}
        )
        if result.stdout.strip():
            data = json.loads(result.stdout.strip())
            return data.get("text", "")
    except Exception as e:
        print(f"  Error: {e}")
    return ""

def extract_year(text):
    """Extract year built from page text."""
    import re
    patterns = [
        r"(?:Year\s*(?:of\s*)?(?:Build|Built|Construction|Delivery))[:\s]*(\d{4})",
        r"(?:Built|Delivered|Completed)[:\s]*(\d{4})",
        r"Build\s*Year[:\s]*(\d{4})",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            y = int(m.group(1))
            if 1950 <= y <= 2030:
                return y
    return None

def extract_owner(text):
    """Extract owner/operator from page text."""
    import re
    patterns = [
        r"(?:Registered\s*Owner|Ship\s*Owner|Owner)[:\s]*([A-Z][A-Za-z\s&.,'-]+?)(?:\n|$|\|)",
        r"(?:Manager|Operator|ISM\s*Manager)[:\s]*([A-Z][A-Za-z\s&.,'-]+?)(?:\n|$|\|)",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:100]
    return None

# Get ships without year_built
db = sqlite3.connect(DB)
ships = db.execute(
    "SELECT imo, name FROM ships WHERE (year_built = 0 OR year_built IS NULL) ORDER BY dwt DESC LIMIT 50"
).fetchall()

print(f"Scraping DNV for {len(ships)} ships...")
updated_year = 0
updated_owner = 0

for i, (imo, name) in enumerate(ships):
    print(f"  [{i+1}/{len(ships)}] {name} (IMO {imo})...", end=" ", flush=True)
    text = scrape_dnv(imo)
    if not text:
        print("no data")
        continue

    year = extract_year(text)
    owner = extract_owner(text)

    updates = []
    params = []
    if year:
        updates.append("year_built = ?")
        params.append(year)
        updated_year += 1
    if owner:
        updates.append("operator = CASE WHEN operator IS NULL OR operator = '' THEN ? ELSE operator END")
        params.append(owner)
        updated_owner += 1

    if updates:
        params.append(imo)
        db.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
        db.commit()
        print(f"year={year} owner={owner}")
    else:
        print("no match in text")

    time.sleep(2)

print(f"\nDone! Updated years: {updated_year}, owners: {updated_owner}")
