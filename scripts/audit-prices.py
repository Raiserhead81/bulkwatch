import sqlite3

DB = "/opt/bulkwatch/db/ships.db"
con = sqlite3.connect(DB)

operators = ["Arklow Shipping", "Oldendorff Carriers", "Berge Bulk", "Star Bulk Carriers",
             "MSC", "Maersk", "CMA CGM", "Hapag-Lloyd", "Genco Shipping", "Pacific Basin Shipping"]

problems = []

for op in operators:
    ships = con.execute(
        "SELECT s.imo, s.name, s.dwt, s.year_built, s.type, ph.estimated_value "
        "FROM ships s LEFT JOIN price_history ph ON ph.imo = s.imo AND ph.date = (SELECT MAX(date) FROM price_history) "
        "WHERE s.operator = ? AND s.dwt NOT IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000) "
        "ORDER BY s.name", (op,)).fetchall()

    if not ships:
        continue

    print(f"\n{'='*60}")
    print(f"  {op} ({len(ships)} Schiffe)")
    print(f"{'='*60}")

    for imo, name, dwt, yb, stype, price in ships:
        issues = []

        if not price or price == 0:
            issues.append("KEIN PREIS")

        if price and dwt and dwt > 0:
            per_dwt = price / dwt
            if per_dwt > 3000:
                issues.append(f"${per_dwt:.0f}/DWT ZU HOCH")
            elif per_dwt < 50:
                issues.append(f"${per_dwt:.0f}/DWT ZU NIEDRIG")

        dupes = con.execute("SELECT COUNT(*) FROM ships WHERE name = ? AND imo != ?", (name, imo)).fetchone()[0]
        if dupes > 0:
            issues.append(f"DUPLIKAT {dupes+1}x")

        if stype == "General Cargo" and dwt > 30000:
            issues.append(f"GenCargo {dwt}DWT")

        similar = con.execute(
            "SELECT s2.name, ph2.estimated_value FROM ships s2 "
            "JOIN price_history ph2 ON ph2.imo = s2.imo AND ph2.date = (SELECT MAX(date) FROM price_history) "
            "WHERE s2.operator = ? AND s2.imo != ? AND ABS(s2.dwt - ?) < 500 AND s2.year_built = ? AND s2.year_built > 0",
            (op, imo, dwt, yb)).fetchall()

        for sname, sprice in similar:
            if price and sprice and min(price, sprice) > 0:
                ratio = max(price, sprice) / min(price, sprice)
                if ratio > 1.3:
                    issues.append(f"vs {sname}: {ratio:.1f}x diff!")

        if issues:
            problems.append((op, name, issues))
            ps = f"${price/1e6:.1f}M" if price else "NONE"
            ys = str(yb) if yb and yb > 0 else "????"
            print(f"  !! {name:25} {dwt:>7}DWT {ys:4} {ps:>8}  {', '.join(issues)}")

print(f"\n{'='*60}")
print(f"  ZUSAMMENFASSUNG")
print(f"{'='*60}")
print(f"  Probleme: {len(problems)}")

jumps = con.execute(
    "SELECT COUNT(*) FROM ("
    "SELECT ph1.imo FROM price_history ph1 "
    "JOIN price_history ph2 ON ph1.imo = ph2.imo "
    "WHERE ph2.date = (SELECT MIN(p.date) FROM price_history p WHERE p.imo = ph1.imo AND p.date > ph1.date) "
    "AND ABS(ph2.estimated_value - ph1.estimated_value) * 100.0 / ph1.estimated_value > 10 "
    "AND SUBSTR(ph1.date,1,4) = SUBSTR(ph2.date,1,4))").fetchone()[0]
print(f"  History Spruenge >10%: {jumps}")

print(f"\n  $/DWT pro Typ:")
for row in con.execute(
    "SELECT s.type, COUNT(*), ROUND(AVG(ph.estimated_value*1.0/s.dwt)), "
    "ROUND(MIN(ph.estimated_value*1.0/s.dwt)), ROUND(MAX(ph.estimated_value*1.0/s.dwt)) "
    "FROM price_history ph JOIN ships s ON s.imo=ph.imo "
    "WHERE ph.date=(SELECT MAX(date) FROM price_history) AND s.dwt>1000 "
    "GROUP BY s.type HAVING COUNT(*)>=5 ORDER BY AVG(ph.estimated_value*1.0/s.dwt) DESC"):
    t, n, avg, mn, mx = row
    spread = mx/mn if mn > 0 else 0
    flag = " !! SPREAD" if spread > 5 else ""
    print(f"    {t:20} n={n:>4} avg=${avg:>5}/DWT range ${mn}-${mx}{flag}")
