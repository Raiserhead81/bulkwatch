#!/usr/bin/env python3
"""Enrich operator field — extended patterns + Equasis-style matching."""
import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Extended naming patterns — way more operators
# Format: (name_pattern, operator_name, match_type)
# match_type: "contains" = name contains pattern, "prefix" = name starts with pattern
PATTERNS = [
    # Container lines — Express/Bay naming
    ("Express", "Hapag-Lloyd", "suffix"),  # **** Express = Hapag-Lloyd
    ("Bay", "Hapag-Lloyd", "suffix_special"),  # Only if not matched by others

    # MSC naming: MSC + name
    ("MSC ", "MSC", "prefix"),

    # Maersk naming
    ("Maersk", "Maersk", "contains"),
    ("MAERSK", "Maersk", "contains"),

    # CMA CGM
    ("CMA CGM", "CMA CGM", "prefix"),
    ("CMA-CGM", "CMA CGM", "contains"),

    # COSCO
    ("COSCO", "COSCO Shipping", "contains"),

    # Evergreen — all start with "Ever"
    ("Ever ", "Evergreen Marine", "prefix"),
    ("EVER ", "Evergreen Marine", "prefix"),

    # Yang Ming — YM prefix
    ("YM ", "Yang Ming", "prefix"),

    # Wan Hai
    ("Wan Hai", "Wan Hai Lines", "contains"),
    ("WAN HAI", "Wan Hai Lines", "contains"),

    # NYK
    ("NYK ", "NYK Line", "prefix"),

    # MOL
    ("MOL ", "MOL", "prefix"),

    # K Line — starts with name + "Highway" for car carriers
    ("Highway", "K Line", "suffix"),

    # PIL
    ("Kota ", "PIL", "prefix"),  # PIL names: Kota ****

    # ZIM
    ("ZIM ", "ZIM", "prefix"),

    # ONE (Ocean Network Express) — merger of NYK/MOL/K Line container ops
    ("ONE ", "Ocean Network Express", "prefix"),

    # Oldendorff
    ("Oldendorff", "Oldendorff Carriers", "contains"),

    # Star Bulk
    ("Star ", "Star Bulk Carriers", "prefix"),

    # Berge
    ("Berge ", "Berge Bulk", "prefix"),

    # Diana
    ("Diana", "Diana Shipping", "prefix"),

    # Navios
    ("Navios", "Navios Maritime Partners", "prefix"),

    # Genco
    ("Genco ", "Genco Shipping", "prefix"),
    ("Baltic ", "Genco Shipping", "prefix_maybe"),

    # Scorpio
    ("Scorpio", "Scorpio Bulkers", "prefix"),
    ("SBI ", "Scorpio Bulkers", "prefix"),

    # Safe Bulkers
    ("Safe ", "Safe Bulkers", "prefix_maybe"),

    # Eagle Bulk
    ("Eagle ", "Eagle Bulk Shipping", "prefix_maybe"),

    # Pacific Basin
    ("Pacific ", "Pacific Basin Shipping", "prefix_maybe"),

    # Golden Ocean
    ("Golden ", "Golden Ocean Group", "prefix_maybe"),

    # Himalaya
    ("Himalaya", "Himalaya Shipping", "prefix"),

    # Polaris
    ("Polaris", "Polaris Shipping", "prefix"),

    # Stena
    ("Stena ", "Stena Bulk", "prefix"),

    # Torm
    ("Torm ", "Torm", "prefix"),

    # Frontline — typically named after historical/nature themes
    ("Front ", "Frontline", "prefix"),

    # BW Group
    ("BW ", "BW Group", "prefix"),

    # Euronav
    ("Euronav", "Euronav", "contains"),

    # Teekay
    ("Teekay", "Teekay", "contains"),

    # Hanjin
    ("Hanjin", "Hanjin Shipping", "prefix"),

    # Hyundai
    ("Hyundai", "Hyundai Merchant Marine", "prefix"),

    # Swire
    ("Swire", "Swire Shipping", "prefix"),

    # Wallenius Wilhelmsen
    ("Wallenius", "Wallenius Wilhelmsen", "prefix"),
    ("Wilhelmsen", "Wallenius Wilhelmsen", "contains"),
    ("Tønsberg", "Wallenius Wilhelmsen", "suffix"),

    # Danaos — container lessor
    ("Danaos", "Danaos Corporation", "prefix"),

    # Costamare — container lessor
    ("Costamare", "Costamare", "prefix"),

    # Seaspan — container lessor
    ("Seaspan", "Seaspan Corporation", "prefix"),

    # Shoei Kisen (Japanese)
    ("Shoei", "Shoei Kisen Kaisha", "prefix"),

    # Anglo-Eastern
    ("Anglo", "Anglo-Eastern", "prefix_maybe"),

    # Pan Ocean (Korean)
    ("Pan ", "Pan Ocean", "prefix_maybe"),

    # MISC (Malaysian)
    ("MISC ", "MISC Berhad", "prefix"),

    # Wilh. Wilhelmsen
    ("Wilh.", "Wallenius Wilhelmsen", "prefix"),

    # Grimaldi
    ("Grimaldi", "Grimaldi Group", "contains"),
    ("Grande ", "Grimaldi Group", "prefix"),

    # Höegh
    ("Hoegh", "Höegh Autoliners", "contains"),

    # Cido Shipping (Hong Kong)
    ("Cido", "Cido Shipping", "prefix"),
]

updated = 0
for pattern, operator, match_type in PATTERNS:
    if match_type == "prefix":
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?"
        param = f"{pattern}%"
    elif match_type == "suffix":
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?"
        param = f"% {pattern}"
    elif match_type == "suffix_special":
        continue  # skip ambiguous
    elif match_type == "prefix_maybe":
        # Only match if name has exactly 2 words (e.g. "Golden Brilliant" but not "Golden Gate Bridge")
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ? AND name NOT LIKE '% % %'"
        param = f"{pattern}%"
    else:
        sql = "UPDATE ships SET operator = ? WHERE (operator IS NULL OR operator = '') AND name LIKE ?"
        param = f"%{pattern}%"

    result = db.execute(sql, (operator, param))
    count = result.rowcount
    if count > 0:
        updated += count
        print(f"  {pattern} → {operator}: {count} ships")

db.commit()

# Update fleet sizes
db.execute("""
    UPDATE operators SET fleet_size = (
        SELECT COUNT(*) FROM ships WHERE ships.operator = operators.name
    )
""")

# Add new operators that we found but aren't in the operators table
new_ops = db.execute("""
    SELECT operator, COUNT(*) as cnt FROM ships
    WHERE operator IS NOT NULL AND operator != ''
    AND operator NOT IN (SELECT name FROM operators)
    GROUP BY operator HAVING cnt >= 2
    ORDER BY cnt DESC
""").fetchall()

for op, cnt in new_ops:
    db.execute("INSERT OR IGNORE INTO operators (name, fleet_size) VALUES (?, ?)", (op, cnt))
    print(f"  NEW operator: {op} ({cnt} ships)")

db.commit()

# Stats
total_with = db.execute("SELECT COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != ''").fetchone()[0]
total = db.execute("SELECT COUNT(*) FROM ships").fetchone()[0]
print(f"\nTotal ships with operator: {total_with} / {total} ({total_with*100//total}%)")

print("\nTop 20 operators:")
for row in db.execute("SELECT operator, COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != '' GROUP BY operator ORDER BY COUNT(*) DESC LIMIT 20"):
    print(f"  {row[0]}: {row[1]}")
