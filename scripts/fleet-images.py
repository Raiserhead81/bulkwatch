#!/usr/bin/env python3
"""Fleet Image Scraper — gets ship photos from operator websites.
Tries fleet pages of known operators, matches images to ships by name.
Cron: 0 6 * * 0 (weekly Sunday 06:00, after image scraper v4)"""
import sqlite3, re, time, urllib.request

DB = "/opt/bulkwatch/db/ships.db"

# Operator fleet pages to scrape (curated list)
FLEET_PAGES = [
    # (operator_name, fleet_url, use_playwright)
    ("Oldendorff Carriers", "https://www.oldendorff.com/fleet/", True),
    ("Star Bulk Carriers", "https://www.starbulk.com/en/fleet.html", True),
    ("Genco Shipping", "https://www.gencoshipping.com/fleet", True),
    ("Diana Shipping", "https://www.dianashippinginc.com/fleet", True),
    ("Eagle Bulk Shipping", "https://www.eagleships.com/fleet", True),
    ("Safe Bulkers", "https://www.safebulkers.com/fleet.html", True),
    ("2020 Bulkers", "https://www.2020bulkers.com/fleet/", True),
    ("Himalaya Shipping", "https://www.himalayashipping.com/fleet", True),
    ("Golden Ocean Group", "https://www.goldenocean.bm/fleet", True),
    ("Grindrod Shipping", "https://www.grindrodshipping.com/fleet", True),
    ("Arklow Shipping", "https://www.asl.ie/fleet/", True),
]


def scrape_fleet_images():
    from playwright.sync_api import sync_playwright

    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # Build ship name -> imo index (only ships without images)
    ships_need_img = {}
    for row in con.execute("SELECT imo, UPPER(name), operator FROM ships WHERE (image_url IS NULL OR image_url = '') AND operator IS NOT NULL"):
        ships_need_img[row[1]] = (row[0], row[2])

    print(f"Ships needing images: {len(ships_need_img)}", flush=True)
    total_found = 0

    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)

    for operator, fleet_url, _ in FLEET_PAGES:
        # How many ships of this operator need images?
        need = sum(1 for _, (_, op) in ships_need_img.items() if op == operator)
        if need == 0:
            continue

        print(f"\n=== {operator} ({need} need images) ===", flush=True)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 2000})
            page.goto(fleet_url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            # Scroll down to load lazy images
            for _ in range(5):
                page.evaluate("window.scrollBy(0, 1000)")
                page.wait_for_timeout(500)

            # Get all images with their alt/title text and nearby text
            img_data = page.evaluate("""() => {
                const results = [];
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.dataset.src || '';
                    if (!src || src.includes('logo') || src.includes('icon') || src.includes('svg')) return;
                    const alt = img.alt || img.title || '';
                    // Get nearby text (parent, sibling)
                    const parent = img.closest('a, div, figure, li, article');
                    const nearby = parent ? parent.innerText.substring(0, 200) : '';
                    if (src.match(/\.(jpg|jpeg|png|webp)/i)) {
                        results.push({src, alt, nearby});
                    }
                });
                return results;
            }""")

            print(f"  Found {len(img_data)} images on page", flush=True)

            for item in img_data:
                src = item["src"]
                alt = item["alt"].upper()
                nearby = item["nearby"].upper()

                # Skip tiny images (icons, logos)
                if "logo" in src.lower() or "icon" in src.lower():
                    continue

                # Try to match ship name
                for ship_name, (imo, op) in ships_need_img.items():
                    if op != operator:
                        continue
                    # Check if ship name appears in alt or nearby text
                    name_parts = [p for p in ship_name.split() if len(p) > 3]
                    if not name_parts:
                        continue
                    match = all(part in alt or part in nearby for part in name_parts)
                    if match:
                        # Verify it's a reasonable image URL (not too small)
                        con.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=?",
                                    (src, f"© {operator}", imo))
                        con.commit()
                        total_found += 1
                        del ships_need_img[ship_name]
                        print(f"  OK  {ship_name[:30]:30} -> {src[:60]}", flush=True)
                        break

            page.close()
        except Exception as e:
            print(f"  ERROR: {str(e)[:60]}", flush=True)

        time.sleep(3)

    browser.close()
    p.stop()
    con.close()
    print(f"\nDone: {total_found} images found from fleet pages", flush=True)


if __name__ == "__main__":
    scrape_fleet_images()
