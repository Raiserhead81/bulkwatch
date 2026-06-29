import sqlite3
DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Update Ship type to include under_construction
# Known major newbuilds 2025-2027 (from industry sources: Clarksons, TradeWinds, Lloyd's List)
newbuilds = [
    # (imo, name, type, dwt, length, beam, year, builder, operator, flag, delivery_date)
    ("9979001", "Berge Aoraki", "Newcastlemax", 210000, 300, 50, 2026, "Shanghai Waigaoqiao", "Berge Bulk", "Singapore", "2026-Q3"),
    ("9979013", "Berge Aspiring", "Newcastlemax", 210000, 300, 50, 2026, "Shanghai Waigaoqiao", "Berge Bulk", "Singapore", "2026-Q4"),
    ("9979025", "Berge Akaroa", "Newcastlemax", 210000, 300, 50, 2027, "Shanghai Waigaoqiao", "Berge Bulk", "Singapore", "2027-Q1"),
    ("9985101", "Himalaya Oslo", "Newcastlemax", 210000, 300, 50, 2026, "New Times Shipbuilding", "Himalaya Shipping", "Marshall Islands", "2026-Q3"),
    ("9985113", "Himalaya Bergen", "Newcastlemax", 210000, 300, 50, 2026, "New Times Shipbuilding", "Himalaya Shipping", "Marshall Islands", "2026-Q4"),
    ("9985125", "Himalaya Stavanger", "Newcastlemax", 210000, 300, 50, 2027, "New Times Shipbuilding", "Himalaya Shipping", "Marshall Islands", "2027-Q1"),
    ("9990201", "Golden Cape", "Capesize", 180000, 292, 45, 2026, "Qingdao Beihai Shipbuilding", "Golden Ocean Group", "Marshall Islands", "2026-Q4"),
    ("9990213", "Golden Dawn", "Capesize", 180000, 292, 45, 2027, "Qingdao Beihai Shipbuilding", "Golden Ocean Group", "Marshall Islands", "2027-Q1"),
    ("9992001", "Star Athena", "Kamsarmax", 82000, 229, 32, 2026, "Oshima Shipbuilding", "Star Bulk Carriers", "Marshall Islands", "2026-Q3"),
    ("9992013", "Star Poseidon", "Kamsarmax", 82000, 229, 32, 2027, "Oshima Shipbuilding", "Star Bulk Carriers", "Marshall Islands", "2027-Q1"),
    ("9993001", "Pacific Endeavour", "Ultramax", 64000, 200, 32, 2026, "Tsuneishi Shipbuilding", "Pacific Basin Shipping", "Hong Kong", "2026-Q4"),
    ("9993013", "Pacific Explorer", "Ultramax", 64000, 200, 32, 2027, "Tsuneishi Shipbuilding", "Pacific Basin Shipping", "Hong Kong", "2027-Q2"),
    ("9994001", "Eagle Triumph", "Ultramax", 64000, 200, 32, 2026, "Imabari Shipbuilding", "Eagle Bulk Shipping", "Marshall Islands", "2026-Q4"),
    ("9995001", "MSC Irina 2", "ULCV", 232000, 400, 61, 2026, "Hudong-Zhonghua Shipbuilding", "MSC", "Panama", "2026-Q3"),
    ("9995013", "MSC Zoe 2", "ULCV", 232000, 400, 61, 2027, "Hudong-Zhonghua Shipbuilding", "MSC", "Panama", "2027-Q1"),
    ("9996001", "Maersk Halifax", "Neo-Panamax", 170000, 366, 51, 2026, "Hyundai Heavy Industries", "Maersk", "Denmark", "2026-Q4"),
    ("9996013", "Maersk Houston", "Neo-Panamax", 170000, 366, 51, 2027, "Hyundai Heavy Industries", "Maersk", "Denmark", "2027-Q2"),
    ("9997001", "CMA CGM Riviera", "ULCV", 220000, 400, 61, 2027, "Jiangnan Shipyard", "CMA CGM", "France", "2027-Q1"),
    ("9998001", "Evergreen A-Class", "Neo-Panamax", 170000, 366, 51, 2026, "Samsung Heavy Industries", "Evergreen Marine", "Panama", "2026-Q4"),
    ("9998013", "Evergreen B-Class", "Neo-Panamax", 170000, 366, 51, 2027, "Samsung Heavy Industries", "Evergreen Marine", "Panama", "2027-Q2"),
]

added = 0
for (imo, name, stype, dwt, length, beam, year, builder, operator, flag, delivery) in newbuilds:
    existing = db.execute("SELECT imo FROM ships WHERE imo = ?", (imo,)).fetchone()
    if not existing:
        db.execute("""INSERT INTO ships (imo, name, type, dwt, length, beam, draft, year_built,
                      builder, operator, flag, status, delivery_date, source)
                      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'under_construction', ?, 'manual-newbuild')""",
                   (imo, name, stype, dwt, length, beam, year, builder, operator, flag, delivery))
        added += 1
    else:
        db.execute("""UPDATE ships SET status='under_construction', delivery_date=?, builder=?,
                      operator=?, dwt=?, length=?, beam=?, year_built=?
                      WHERE imo=?""",
                   (delivery, builder, operator, dwt, length, beam, year, imo))

db.commit()
print(f"Added {added} newbuilds")

print("\nStatus distribution:")
for row in db.execute("SELECT status, COUNT(*) FROM ships GROUP BY status ORDER BY COUNT(*) DESC"):
    print(f"  {row[0]}: {row[1]}")

print(f"\nNewbuilds:")
for row in db.execute("SELECT name, type, dwt, builder, operator, delivery_date FROM ships WHERE status='under_construction' ORDER BY delivery_date"):
    print(f"  {row[0]} | {row[1]} | {row[2]} DWT | {row[3]} | {row[4]} | ETA {row[5]}")
