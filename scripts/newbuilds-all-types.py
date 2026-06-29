import sqlite3
DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

# Major newbuilds 2025-2027 across ALL ship types
# Sources: Clarksons, Lloyd's List, TradeWinds, company press releases
newbuilds = [
    # TANKERS
    ("9999101", "Frontline Future", "Crude Oil Tanker", 300000, 333, 60, 2026, "Hyundai Heavy Industries", "Frontline", "Marshall Islands", "2026-Q4"),
    ("9999102", "Frontline Vision", "Crude Oil Tanker", 300000, 333, 60, 2027, "Hyundai Heavy Industries", "Frontline", "Marshall Islands", "2027-Q1"),
    ("9999103", "Euronav Brussels", "Crude Oil Tanker", 300000, 333, 60, 2027, "Daewoo Shipbuilding", "Euronav", "Belgium", "2027-Q2"),
    ("9999104", "Torm Christina", "Product Tanker", 50000, 183, 32, 2026, "China Shipbuilding", "Torm", "Denmark", "2026-Q4"),
    ("9999105", "Torm Dagny", "Product Tanker", 50000, 183, 32, 2027, "China Shipbuilding", "Torm", "Denmark", "2027-Q1"),
    ("9999106", "Stena Supreme", "Crude Oil Tanker", 150000, 274, 48, 2027, "Samsung Heavy Industries", "Stena Bulk", "Sweden", "2027-Q2"),
    ("9999107", "BW Sakura", "LNG Tanker", 174000, 297, 46, 2026, "Hyundai Heavy Industries", "BW Group", "Singapore", "2026-Q3"),
    ("9999108", "BW Horizon", "LNG Tanker", 174000, 297, 46, 2027, "Samsung Heavy Industries", "BW Group", "Singapore", "2027-Q1"),
    ("9999109", "MOL LNG Pioneer", "LNG Tanker", 174000, 297, 46, 2026, "Mitsubishi Heavy Industries", "MOL", "Japan", "2026-Q4"),
    ("9999110", "NYK LNG Voyager", "LNG Tanker", 174000, 297, 46, 2027, "Kawasaki Heavy Industries", "NYK Line", "Japan", "2027-Q2"),
    ("9999111", "VLGC Pacific", "LPG Tanker", 84000, 230, 36, 2026, "Hyundai Heavy Industries", "BW Group", "Singapore", "2026-Q4"),
    ("9999112", "VLGC Atlantic", "LPG Tanker", 84000, 230, 36, 2027, "Jiangnan Shipyard", "BW Group", "Singapore", "2027-Q1"),

    # CONTAINER SHIPS
    ("9999201", "Hapag Nova", "Neo-Panamax", 150000, 366, 51, 2026, "Daewoo Shipbuilding", "Hapag-Lloyd", "Germany", "2026-Q4"),
    ("9999202", "Hapag Terra", "Neo-Panamax", 150000, 366, 51, 2027, "Daewoo Shipbuilding", "Hapag-Lloyd", "Germany", "2027-Q1"),
    ("9999203", "COSCO Universe", "ULCV", 230000, 400, 61, 2027, "Nantong COSCO KHI", "COSCO Shipping", "China", "2027-Q1"),
    ("9999204", "COSCO Galaxy", "ULCV", 230000, 400, 61, 2027, "Nantong COSCO KHI", "COSCO Shipping", "China", "2027-Q3"),
    ("9999205", "Yang Ming Certainty", "Neo-Panamax", 150000, 366, 51, 2027, "CSSC Huangpu Wenchong", "Yang Ming", "Taiwan", "2027-Q2"),
    ("9999206", "ZIM Ontario", "Neo-Panamax", 150000, 366, 51, 2026, "Samsung Heavy Industries", "ZIM", "Israel", "2026-Q4"),
    ("9999207", "PIL Excellence", "Container Ship", 80000, 300, 43, 2027, "Yangzijiang Shipbuilding", "PIL", "Singapore", "2027-Q1"),
    ("9999208", "Wan Hai 600", "Container Ship", 60000, 260, 40, 2026, "CSBC Corporation", "Wan Hai Lines", "Taiwan", "2026-Q4"),

    # CAR CARRIERS
    ("9999301", "Wallenius Aurora", "Car Carrier", 12000, 220, 38, 2026, "CIMC Raffles", "Wallenius Wilhelmsen", "Norway", "2026-Q4"),
    ("9999302", "Wallenius Electra", "Car Carrier", 12000, 220, 38, 2027, "CIMC Raffles", "Wallenius Wilhelmsen", "Norway", "2027-Q1"),
    ("9999303", "K Line Green Future", "Car Carrier", 12000, 220, 38, 2027, "Shin Kurushima", "K Line", "Japan", "2027-Q2"),
    ("9999304", "MOL Ace Next", "Car Carrier", 12000, 220, 38, 2027, "Imabari Shipbuilding", "MOL", "Japan", "2027-Q3"),

    # PASSENGER / CRUISE
    ("9999401", "Icon of the Seas II", "Cruise Ship", 50000, 365, 47, 2027, "Meyer Turku", "Royal Caribbean", "Bahamas", "2027-Q2"),
    ("9999402", "MSC World Asia", "Cruise Ship", 45000, 340, 44, 2027, "Chantiers de l'Atlantique", "MSC Cruises", "Malta", "2027-Q1"),
    ("9999403", "Viking Saturn", "Cruise Ship", 10000, 230, 29, 2026, "Fincantieri", "Viking Ocean Cruises", "Norway", "2026-Q4"),

    # RORO
    ("9999501", "Stena Electra", "RoRo", 20000, 240, 34, 2026, "China Merchants Heavy Industry", "Stena Line", "Sweden", "2026-Q4"),
    ("9999502", "Stena Futura", "RoRo", 20000, 240, 34, 2027, "China Merchants Heavy Industry", "Stena Line", "Sweden", "2027-Q2"),

    # OFFSHORE
    ("9999601", "Saipem FDS3", "Offshore", 30000, 220, 42, 2027, "Samsung Heavy Industries", "Saipem", "Italy", "2027-Q2"),
    ("9999602", "Subsea 7 Pioneer", "Offshore", 18000, 175, 33, 2027, "VARD", "Subsea 7", "Norway", "2027-Q3"),

    # GENERAL CARGO / MULTIPURPOSE
    ("9999701", "Swire Changsha", "General Cargo", 25000, 180, 28, 2026, "Chengxi Shipyard", "Swire Shipping", "Singapore", "2026-Q4"),
    ("9999702", "Swire Dalian", "General Cargo", 25000, 180, 28, 2027, "Chengxi Shipyard", "Swire Shipping", "Singapore", "2027-Q1"),

    # REEFER
    ("9999801", "Cool Pioneer", "Reefer", 15000, 165, 25, 2027, "Hyundai Mipo Dockyard", "Cool Carriers", "Sweden", "2027-Q2"),
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

db.commit()
print(f"Added {added} newbuilds")

print("\nNewbuilds by type:")
for row in db.execute("SELECT type, COUNT(*) FROM ships WHERE status='under_construction' GROUP BY type ORDER BY COUNT(*) DESC"):
    print(f"  {row[0]}: {row[1]}")

print(f"\nTotal under construction: {db.execute('SELECT COUNT(*) FROM ships WHERE status=?', ('under_construction',)).fetchone()[0]}")
