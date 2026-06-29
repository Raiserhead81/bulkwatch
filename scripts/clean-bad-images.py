#!/usr/bin/env python3
"""Clean up bad/wrong images from vessel database."""
import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

before = db.execute("SELECT COUNT(*) FROM ships WHERE image_url IS NOT NULL AND image_url != ''").fetchone()[0]

# Bad URL patterns — images that are clearly not ships
BAD_PATTERNS = [
    # Non-ship objects
    "%flag%", "%Flag%", "%logo%", "%Logo%", "%emblem%", "%Emblem%",
    "%coat_of_arms%", "%Coat_of_Arms%", "%seal_of%", "%Seal_of%",
    "%stamp%", "%Stamp%", "%coin%", "%Coin%", "%medal%", "%Medal%",
    "%pottery%", "%ceramic%", "%vase%", "%Vase%", "%amphora%", "%jug%",
    "%painting%", "%Painting%", "%portrait%", "%Portrait%",
    "%statue%", "%Statue%", "%monument%", "%Monument%",
    "%automobile%", "%Automobile%", "%truck%", "%Truck%",
    "%aircraft%", "%Aircraft%", "%airplane%", "%helicopter%",
    "%building%", "%Building%", "%church%", "%Church%",
    "%castle%", "%Castle%", "%tower%", "%Tower%",
    "%person%", "%people%", "%woman%", "%Woman%",
    "%icon%", "%Icon%",

    # Disasters/fires (wrong context)
    "%on_fire%", "%_fire.%", "%burning%", "%explosion%", "%sinking%",
    "%wreck_%", "%wreckage%",

    # Catalogues and documents
    "%Catalogue%", "%catalogue%", "%catalog%",
    "%Collection_of%", "%collection_of%",

    # Maps and charts
    "%map_of%", "%Map_of%", "%chart_of%",

    # PDF thumbnails (usually wrong)
    "%.pdf%",

    # Other non-ship content
    "%diagram%", "%Diagram%", "%graph%", "%Graph%",
    "%postcard%", "%Postcard%",
    "%drawing%", "%Drawing%",
    "%illustration%", "%Illustration%",
    "%cartoon%",
    "%aerial_view%",
    "%screenshot%",
    "%model_of%", "%Model_of%",
    "%replica%",
    "%badge%", "%Badge%",
    "%uniform%",
    "%anchor%", "%Anchor%",
    "%compass%",
]

removed = 0
for pattern in BAD_PATTERNS:
    result = db.execute(
        "UPDATE ships SET image_url = NULL, image_attribution = NULL WHERE image_url LIKE ?",
        (pattern,)
    )
    if result.rowcount > 0:
        removed += result.rowcount

# Also remove images that are clearly wrong:
# - Fireboat images for non-fireboat ships (but keep if ship name contains "fire")
db.execute("""
    UPDATE ships SET image_url = NULL, image_attribution = NULL
    WHERE image_url LIKE '%fire%'
    AND LOWER(name) NOT LIKE '%fire%'
    AND LOWER(name) NOT LIKE '%wildfire%'
    AND LOWER(type) NOT LIKE '%fire%'
""")
removed += db.execute("SELECT changes()").fetchone()[0]

# Remove images of other ships (image URL contains a different IMO than the ship)
# This is tricky but we can check if the image URL contains an IMO that doesn't match
import re
rows = db.execute("SELECT imo, image_url FROM ships WHERE image_url IS NOT NULL AND image_url != ''").fetchall()
wrong_imo = 0
for imo, url in rows:
    # Find all 7-digit numbers in URL that look like IMOs
    imos_in_url = re.findall(r'IMO[_\-\s]*(\d{7})', url, re.IGNORECASE)
    if imos_in_url:
        # Check if any of them match our ship
        if imo not in imos_in_url:
            # URL contains a different ship's IMO — wrong image!
            db.execute("UPDATE ships SET image_url = NULL, image_attribution = NULL WHERE imo = ?", (imo,))
            wrong_imo += 1

db.commit()

after = db.execute("SELECT COUNT(*) FROM ships WHERE image_url IS NOT NULL AND image_url != ''").fetchone()[0]

print(f"Before: {before} images")
print(f"Removed by pattern: {removed}")
print(f"Removed wrong IMO: {wrong_imo}")
print(f"After: {after} images")
print(f"Total removed: {before - after}")
