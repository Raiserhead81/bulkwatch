#!/usr/bin/env python3
"""Enrich operators using AIS ship name patterns and fleet website scraping results.
Also try to find operators from the live AIS cache via the internal API."""
import sqlite3, urllib.request, json, time, re

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Extended operator patterns based on known fleet naming conventions
# Sources: company websites, annual reports, fleet lists
EXTENDED_PATTERNS = [
    # Container lines
    ("APL ", "APL (CMA CGM)", "prefix"),
    ("ANL ", "ANL (CMA CGM)", "prefix"),
    ("Delmas", "CMA CGM", "prefix"),
    ("OOCL", "OOCL", "prefix"),
    ("SITC ", "SITC Lines", "prefix"),
    ("Sinokor", "Sinokor", "prefix"),
    ("RCL ", "Regional Container Lines", "prefix"),
    ("TS ", "T.S. Lines", "prefix"),
    ("X-Press", "X-Press Feeders", "prefix"),
    ("Zhonggu", "Zhonggu Logistics", "prefix"),
    ("Arkas", "Arkas Line", "prefix"),
    ("Turkon", "Turkon Line", "prefix"),
    ("Unifeeder", "Unifeeder", "prefix"),

    # Bulk operators
    ("Cargill", "Cargill Ocean Transportation", "contains"),
    ("Bunge", "Bunge", "prefix"),
    ("Louis Dreyfus", "Louis Dreyfus Armateurs", "contains"),
    ("Koch", "Koch Shipping", "prefix"),
    ("Cobelfret", "Cobelfret", "prefix"),
    ("Western Bulk", "Western Bulk", "prefix"),
    ("Klaveness", "Klaveness Combination Carriers", "prefix"),
    ("Jinhui", "Jinhui Shipping", "prefix"),
    ("Precious Shipping", "Precious Shipping", "contains"),
    ("Thoresen", "Thoresen Thai", "prefix"),
    ("Seanergy", "Seanergy Maritime", "prefix"),
    ("Castor", "Castor Maritime", "prefix"),
    ("Globus", "Globus Maritime", "prefix"),
    ("Good Bulk", "Good Bulk", "prefix"),

    # Tanker operators
    ("Tsakos", "Tsakos Energy Navigation", "prefix"),
    ("Minerva", "Minerva Marine", "prefix"),
    ("Thenamaris", "Thenamaris", "prefix"),
    ("Capital Product", "Capital Product Partners", "prefix"),
    ("Nordic ", "Nordic Tankers", "prefix"),
    ("Concordia", "Concordia Maritime", "prefix"),
    ("International Seaways", "International Seaways", "contains"),
    ("Ridgebury", "Ridgebury Tankers", "prefix"),
    ("Hafnia", "Hafnia", "prefix"),
    ("NORDEN", "Norden", "prefix"),
    ("Ardmore", "Ardmore Shipping", "prefix"),
    ("Dorian", "Dorian LPG", "prefix"),
    ("Navigator ", "Navigator Holdings", "prefix"),
    ("Flex LNG", "Flex LNG", "prefix"),
    ("Awilco", "Awilco LNG", "prefix"),
    ("GasLog", "GasLog", "prefix"),
    ("Dynagas", "Dynagas LNG", "prefix"),
    ("Capital Gas", "Capital Gas", "prefix"),

    # Car carriers
    ("Morning ", "K Line", "prefix_maybe"),  # K Line car carriers: Morning ****
    ("Courageous Ace", "MOL", "contains"),
    ("Heroic Ace", "MOL", "contains"),

    # Offshore
    ("Bourbon", "Bourbon Offshore", "prefix"),
    ("Tidewater", "Tidewater", "prefix"),
    ("Solstad", "Solstad Offshore", "prefix"),
    ("DOF ", "DOF ASA", "prefix"),
    ("Havila", "Havila Shipping", "prefix"),
    ("Olympic ", "Olympic Shipping", "prefix_maybe"),
    ("Farstad", "Solstad Offshore", "prefix"),
    ("COSL ", "COSL", "prefix"),
    ("Maridive", "Maridive", "prefix"),

    # Cruise/Ferry
    ("Symphony of", "Royal Caribbean", "prefix"),
    ("Harmony of", "Royal Caribbean", "prefix"),
    ("Oasis of", "Royal Caribbean", "prefix"),
    ("Wonder of", "Royal Caribbean", "prefix"),
    ("Icon of", "Royal Caribbean", "prefix"),
    ("Norwegian ", "Norwegian Cruise Line", "prefix_maybe"),
    ("Carnival ", "Carnival Corporation", "prefix"),
    ("Costa ", "Costa Cruises", "prefix_maybe"),
    ("Celebrity ", "Celebrity Cruises", "prefix"),
    ("Princess ", "Princess Cruises", "prefix_maybe"),
    ("Viking ", "Viking Ocean Cruises", "prefix_maybe"),
    ("Aida", "AIDA Cruises", "prefix"),
    ("Mein Schiff", "TUI Cruises", "prefix"),
]

updated = 0
for pattern, operator, match_type in EXTENDED_PATTERNS:
    if match_type == "prefix":
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?"
        param = f"{pattern}%"
    elif match_type == "prefix_maybe":
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ? AND name NOT LIKE '% % % %'"
        param = f"{pattern}%"
    elif match_type == "contains":
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?"
        param = f"%{pattern}%"
    else:
        continue

    result = db.execute(sql, (operator, param))
    count = result.rowcount
    if count > 0:
        updated += count
        print(f"  {pattern} → {operator}: {count}")

db.commit()

# Add new operators to operators table
new_ops = db.execute("""
    SELECT operator, COUNT(*) as cnt FROM ships
    WHERE operator IS NOT NULL AND operator != ''
    AND operator NOT IN (SELECT name FROM operators)
    GROUP BY operator HAVING cnt >= 2
    ORDER BY cnt DESC
""").fetchall()

for op, cnt in new_ops:
    db.execute("INSERT OR IGNORE INTO operators (name, fleet_size) VALUES (?, ?)", (op, cnt))

# Update all fleet sizes
db.execute("""
    UPDATE operators SET fleet_size = (
        SELECT COUNT(*) FROM ships WHERE ships.operator = operators.name
    )
""")
db.commit()

total_with = db.execute("SELECT COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != ''").fetchone()[0]
total = db.execute("SELECT COUNT(*) FROM ships").fetchone()[0]
print(f"\nUpdated {updated} additional ships")
print(f"Total with operator: {total_with} / {total} ({total_with*100//total}%)")

print("\nTop 30 operators:")
for row in db.execute("SELECT operator, COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != '' GROUP BY operator ORDER BY COUNT(*) DESC LIMIT 30"):
    print(f"  {row[0]}: {row[1]}")
