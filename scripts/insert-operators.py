import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
db = sqlite3.connect(DB)

operators = [
    ("Oldendorff Carriers", "Germany", "Luebeck", "https://www.oldendorff.com", "info@oldendorff.com", "+49 451 1500-0"),
    ("Berge Bulk", "Singapore", "Singapore", "https://www.bergebulk.com", "info@bergebulk.com", "+65 6818 9000"),
    ("Star Bulk Carriers", "Greece", "Athens", "https://www.starbulk.com", "info@starbulk.com", "+30 210 617 8400"),
    ("Golden Ocean Group", "Bermuda", "Hamilton", "https://www.goldenocean.bm", "mail@goldenocean.no", "+47 22 01 73 00"),
    ("Pacific Basin Shipping", "Hong Kong", "Hong Kong", "https://www.pacificbasin.com", "info@pacificbasin.com", "+852 2233 7000"),
    ("Eagle Bulk Shipping", "USA", "Stamford", "https://www.eagleships.com", "info@eagleships.com", "+1 203 276 8100"),
    ("Diana Shipping", "Greece", "Athens", "https://www.dianashippinginc.com", "ds@dfrshipping.com", "+30 210 947 0100"),
    ("Safe Bulkers", "Greece", "Athens", "https://www.safebulkers.com", "info@safebulkers.com", "+30 210 947 0500"),
    ("Navios Maritime Partners", "Greece", "Piraeus", "https://www.navios-mlp.com", "info@navios.com", "+30 210 417 2050"),
    ("Scorpio Bulkers", "Monaco", "Monaco", "https://www.scorpiobulkers.com", "info@scorpiobulkers.com", "+377 9798 5715"),
    ("Genco Shipping", "USA", "New York", "https://www.gencoshipping.com", "info@gencoshipping.com", "+1 646 443 8550"),
    ("Grindrod Shipping", "Singapore", "Singapore", "https://www.grindrodshipping.com", "info@grindrodshipping.com", "+65 6323 0048"),
    ("Pangaea Logistics Solutions", "USA", "Newport", "https://www.pangaeals.com", "info@pangaeals.com", "+1 401 846 7790"),
    ("2020 Bulkers", "Bermuda", "Hamilton", "https://www.2020bulkers.com", "ir@2020bulkers.com", "+47 22 93 64 00"),
    ("Himalaya Shipping", "Bermuda", "Hamilton", "https://www.himalayashipping.com", "ir@himalayashipping.com", "+47 22 93 64 00"),
    ("Vale", "Brazil", "Rio de Janeiro", "https://www.vale.com", "imprensa@vale.com", "+55 21 3485 5000"),
    ("MSC", "Switzerland", "Geneva", "https://www.msc.com", "info@msc.com", "+41 22 703 8888"),
    ("Maersk", "Denmark", "Copenhagen", "https://www.maersk.com", "info@maersk.com", "+45 33 63 33 63"),
    ("CMA CGM", "France", "Marseille", "https://www.cma-cgm.com", "webmaster@cma-cgm.com", "+33 4 88 91 90 00"),
    ("Hapag-Lloyd", "Germany", "Hamburg", "https://www.hapag-lloyd.com", "info@hlag.com", "+49 40 3001 0"),
    ("COSCO Shipping", "China", "Shanghai", "https://www.coscoshipping.com", "ir@coscoshipping.com", "+86 21 6596 6105"),
    ("Evergreen Marine", "Taiwan", "Taipei", "https://www.evergreen-marine.com", "emc@evergreen-marine.com", "+886 2 2505 7766"),
    ("NYK Line", "Japan", "Tokyo", "https://www.nyk.com", "info@nyk.com", "+81 3 3284 5151"),
    ("MOL", "Japan", "Tokyo", "https://www.mol.co.jp", "mol-ir@molgroup.com", "+81 3 3587 6234"),
    ("K Line", "Japan", "Tokyo", "https://www.kline.com", "ir@kline.com", "+81 3 3595 5063"),
    ("Yang Ming", "Taiwan", "Keelung", "https://www.yangming.com", "pr@yml.com.tw", "+886 2 2455 9988"),
    ("Wan Hai Lines", "Taiwan", "Taipei", "https://www.wanhai.com", "whl@wanhai.com.tw", "+886 2 2567 1618"),
    ("PIL", "Singapore", "Singapore", "https://www.pilship.com", "pilfeedback@pilship.com", "+65 6229 9211"),
    ("ZIM", "Israel", "Haifa", "https://www.zim.com", "ir@zim.com", "+972 4 865 2111"),
    ("Torm", "Denmark", "Copenhagen", "https://www.torm.com", "torm@torm.com", "+45 39 17 92 00"),
    ("Frontline", "Bermuda", "Hamilton", "https://www.frontline.bm", "ir@frontline.bm", "+47 23 11 40 00"),
    ("Euronav", "Belgium", "Antwerp", "https://www.euronav.com", "info@euronav.com", "+32 3 247 44 11"),
    ("Teekay", "Bermuda", "Hamilton", "https://www.teekay.com", "ir@teekay.com", "+1 604 844 6654"),
    ("BW Group", "Singapore", "Singapore", "https://www.bw-group.com", "info@bw-group.com", "+65 6337 6133"),
    ("Stena Bulk", "Sweden", "Gothenburg", "https://www.stenabulk.com", "info@stenabulk.com", "+46 31 85 50 00"),
    ("Wallenius Wilhelmsen", "Norway", "Oslo", "https://www.walleniuswilhelmsen.com", "ir@walwil.com", "+47 67 58 40 00"),
    ("Polaris Shipping", "South Korea", "Seoul", "https://www.polarisshipping.co.kr", "polaris@polarisshipping.co.kr", "+82 2 3483 1600"),
    ("Shoei Kisen Kaisha", "Japan", "Imabari", "https://www.shoeikisen.com", "info@shoeikisen.com", "+81 898 31 9500"),
    ("Kumiai Senpaku", "Japan", "Tokyo", "https://www.kumaisen.co.jp", "", "+81 3 5545 2711"),
    ("Anglo-Eastern", "Hong Kong", "Hong Kong", "https://www.angloeastern.com", "info@angloeastern.com", "+852 2863 7500"),
    ("V.Ships", "Monaco", "Monaco", "https://www.vships.com", "info@vships.com", "+377 9205 1500"),
    ("Fleet Management", "Hong Kong", "Hong Kong", "https://www.fleetship.com", "info@fleetship.com", "+852 2526 8080"),
    ("Bernhard Schulte Shipmanagement", "Germany", "Hamburg", "https://www.bs-shipmanagement.com", "info@schultegroup.com", "+49 40 3609 0"),
    ("Columbia Shipmanagement", "Cyprus", "Limassol", "https://www.columbia-shipmanagement.com", "info@csmcy.com", "+357 25 843 100"),
    ("Wilhelmsen Ship Management", "Norway", "Oslo", "https://www.wilhelmsen.com", "info@wilhelmsen.com", "+47 67 58 40 00"),
    ("OSM Maritime", "Singapore", "Singapore", "https://www.osm.no", "info@osmsg.com", "+65 6220 1828"),
    ("Doun Kisen", "Japan", "Ochi", "https://www.doun-kisen.co.jp", "", "+81 897 56 0550"),
    ("Pan Ocean", "South Korea", "Seoul", "https://www.panocean.com", "ir@panocean.com", "+82 2 316 5000"),
    ("Dryships", "Greece", "Athens", "https://www.dryships.com", "info@dryships.com", "+30 210 809 0570"),
    ("Swire Shipping", "Singapore", "Singapore", "https://www.swireshipping.com", "singapore@swireshipping.com", "+65 6309 3600"),
]

db.executemany(
    "INSERT OR REPLACE INTO operators (name, country, city, website, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
    operators
)
db.commit()

# Update fleet sizes
db.execute("""
    UPDATE operators SET fleet_size = (
        SELECT COUNT(*) FROM ships WHERE ships.operator = operators.name
    )
""")
db.commit()

count = db.execute("SELECT COUNT(*) FROM operators").fetchone()[0]
with_fleet = db.execute("SELECT COUNT(*) FROM operators WHERE fleet_size > 0").fetchone()[0]
print(f"{count} Reedereien eingetragen, {with_fleet} mit Schiffen in der DB")

# Show top operators by fleet
print("\nTop Reedereien:")
for row in db.execute("SELECT name, country, fleet_size FROM operators WHERE fleet_size > 0 ORDER BY fleet_size DESC LIMIT 10"):
    print(f"  {row[0]} ({row[1]}): {row[2]} ships")
