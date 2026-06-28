#!/usr/bin/env python3
"""Enrich operator field from ship names and known patterns."""
import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Known naming patterns: if ship name contains X, operator is Y
PATTERNS = [
    ("Oldendorff", "Oldendorff Carriers"),
    ("Star Bulk", "Star Bulk Carriers"),
    ("Star ", "Star Bulk Carriers"),  # Star Laura, Star Mika etc
    ("Berge ", "Berge Bulk"),
    ("Vale ", "Vale"),
    ("MSC ", "MSC"),
    ("Maersk", "Maersk"),
    ("CMA CGM", "CMA CGM"),
    ("Hapag", "Hapag-Lloyd"),
    ("COSCO", "COSCO Shipping"),
    ("Evergreen", "Evergreen Marine"),
    ("Yang Ming", "Yang Ming"),
    ("NYK ", "NYK Line"),
    ("MOL ", "MOL"),
    ("K Line", "K Line"),
    ("Wan Hai", "Wan Hai Lines"),
    ("PIL ", "PIL"),
    ("ZIM ", "ZIM"),
    ("Torm ", "Torm"),
    ("Frontline", "Frontline"),
    ("Euronav", "Euronav"),
    ("Teekay", "Teekay"),
    ("Stena ", "Stena Bulk"),
    ("Wallenius", "Wallenius Wilhelmsen"),
    ("Pacific Basin", "Pacific Basin Shipping"),
    ("Golden Ocean", "Golden Ocean Group"),
    ("Diana ", "Diana Shipping"),
    ("Genco ", "Genco Shipping"),
    ("Navios", "Navios Maritime Partners"),
    ("Scorpio", "Scorpio Bulkers"),
    ("Himalaya", "Himalaya Shipping"),
    ("Polaris", "Polaris Shipping"),
    ("Pan Ocean", "Pan Ocean"),
    ("Swire", "Swire Shipping"),
    ("Anglo-Eastern", "Anglo-Eastern"),
    ("2020 Bulkers", "2020 Bulkers"),
    ("Eagle ", "Eagle Bulk Shipping"),
    ("Grindrod", "Grindrod Shipping"),
    ("BW ", "BW Group"),
    ("Shoei ", "Shoei Kisen Kaisha"),
    ("Doun ", "Doun Kisen"),
    ("Safe Bulkers", "Safe Bulkers"),
    ("Pangaea", "Pangaea Logistics Solutions"),
    ("Hyundai", "Hyundai Merchant Marine"),
    ("Hanjin", "Hanjin Shipping"),
    ("Pacific Carriers", "Pacific Carriers"),
    ("Wisdom Marine", "Wisdom Marine"),
    ("Norden", "Norden"),
    ("Thoresen", "Thoresen Thai"),
    ("Dryships", "Dryships"),
    ("Bulk Carrier", ""),  # skip generic
]

updated = 0
for pattern, operator in PATTERNS:
    if not operator:
        continue
    result = db.execute(
        "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?",
        (operator, f"%{pattern}%")
    )
    count = result.rowcount
    if count > 0:
        updated += count
        print(f"  {pattern} → {operator}: {count} ships")

db.commit()

# Also try to match by flag + builder combinations for known operators
# e.g., Liberian flag + Hyundai builder + Capesize = likely a major operator

# Update fleet_size in operators table
db.execute("""
    UPDATE operators SET fleet_size = (
        SELECT COUNT(*) FROM ships WHERE ships.operator = operators.name
    )
""")
db.commit()

# Stats
total_with = db.execute("SELECT COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != ''").fetchone()[0]
total = db.execute("SELECT COUNT(*) FROM ships").fetchone()[0]
print(f"\nUpdated {updated} ships")
print(f"Ships with operator: {total_with} / {total} ({total_with*100//total}%)")

print("\nTop operators:")
for row in db.execute("SELECT operator, COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != '' GROUP BY operator ORDER BY COUNT(*) DESC LIMIT 15"):
    print(f"  {row[0]}: {row[1]}")
