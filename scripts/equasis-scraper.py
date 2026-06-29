#!/usr/bin/env python3
"""Equasis Scraper — enriches ship data (GT, year_built, type, flag) from equasis.org.
Targets ships with placeholder DWT or missing year_built.
Cron: 0 2 * * * (nightly, max 100 ships per run — Equasis rate limits aggressively)"""
import sqlite3, time, re, sys

DB = "/opt/bulkwatch/db/ships.db"
MAX_PER_RUN = 5000
DELAY = 3.0  # Detail page takes ~4s anyway, so effective rate is ~7s/ship

EMAIL = "kayconrad@posteo.de"
PASSWORD = "!nfinitY!981"


def create_session():
    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Login
    page.goto("https://www.equasis.org/EquasisWeb/public/HomePage", wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2000)

    inputs = page.query_selector_all("input[name=j_email]")
    for inp in inputs:
        if inp.is_visible():
            inp.fill(EMAIL)
            break
    pwds = page.query_selector_all("input[name=j_password]")
    for pw in pwds:
        if pw.is_visible():
            pw.fill(PASSWORD)
            break
    submits = page.query_selector_all("input[type=submit]")
    for s in submits:
        if s.is_visible():
            s.click()
            break

    page.wait_for_timeout(3000)
    logged_in = "Search" in page.inner_text("body")
    if not logged_in:
        print("Login failed!", flush=True)
        browser.close()
        p.stop()
        return None, None, None

    print("Equasis login OK", flush=True)
    return p, browser, page


def search_ship(page, imo):
    """Search for a ship by IMO and extract data from results."""
    # Use the home search field
    home = page.query_selector("input[name=P_ENTREE_HOME]")
    if not home or not home.is_visible():
        # Navigate back to home
        page.goto("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage",
                   wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(1000)
        home = page.query_selector("input[name=P_ENTREE_HOME]")

    if not home:
        return None

    home.fill("")
    home.fill(str(imo))
    page.keyboard.press("Enter")
    page.wait_for_timeout(3000)

    text = page.inner_text("body")

    # Parse results table: "IMO number	Name of ship	Gross tonnage	Type of ship	Year of build	Flag"
    lines = text.split("\n")
    for line in lines:
        if str(imo) in line:
            parts = line.split("\t")
            if len(parts) >= 6:
                result = {
                    "imo": parts[0].strip(),
                    "name": parts[1].strip(),
                    "gross_tonnage": int(parts[2].strip()) if parts[2].strip().isdigit() else None,
                    "type": parts[3].strip(),
                    "year_built": int(parts[4].strip()) if parts[4].strip().isdigit() else None,
                    "flag": parts[5].strip(),
                }
                break
            # Try space-separated
            m = re.match(r"(\d{7})\s+(.+?)\s+(\d+)\s+(.*?)\s+(\d{4})\s+(.+)", line)
            if m:
                result = {
                    "imo": m.group(1),
                    "name": m.group(2).strip(),
                    "gross_tonnage": int(m.group(3)),
                    "type": m.group(4).strip(),
                    "year_built": int(m.group(5)),
                    "flag": m.group(6).strip(),
                }
                break
    else:
        return None

    # Open detail page for DWT, MMSI, Classification, P&I, Flag Performance
    try:
        page.evaluate(f"document.formShip.P_IMO.value='{imo}';document.formShip.submit();")
        page.wait_for_timeout(4000)

        # Expand all sections
        for section in ["Classification", "P&I Information", "Management detail", "Safety management"]:
            try:
                page.click(f"text={section}", timeout=2000)
                page.wait_for_timeout(800)
            except:
                pass

        detail = page.inner_text("body")

        # DWT
        m = re.search(r"DWT\s*\n?\s*([\d,]+)", detail)
        if m:
            result["dwt"] = int(m.group(1).replace(",", ""))

        # MMSI
        m = re.search(r"MMSI\s*\n?\s*(\d{9})", detail)
        if m:
            result["mmsi"] = m.group(1)

        # Call Sign
        m = re.search(r"Call Sign\s*\n?\s*([A-Z0-9]{4,10})", detail)
        if m:
            result["call_sign"] = m.group(1)

        # Classification
        for cls_name in ["Lloyd's Register", "DNV", "Bureau Veritas", "Nippon Kaiji Kyokai",
                         "American Bureau of Shipping", "ClassNK", "RINA", "Korean Register",
                         "China Classification Society", "Indian Register", "Russian Maritime"]:
            if cls_name in detail:
                result["classification"] = cls_name
                break

        # P&I
        m = re.search(r"P&I Information\s*\n?\s*([^\n]+)", detail)
        if m:
            pi = m.group(1).strip()
            if pi and len(pi) > 3 and "Equasis" not in pi:
                result["p_and_i"] = pi

        # Flag Performance (Paris MOU / Tokyo MOU)
        m = re.search(r"Paris MOU\s*\n?\s*(White|Grey|Black)", detail)
        if m:
            result["flag_paris_mou"] = m.group(1)
        m = re.search(r"Tokyo MOU\s*\n?\s*(White|Grey|Black)", detail)
        if m:
            result["flag_tokyo_mou"] = m.group(1)

        # Detention percentage
        m = re.search(r"([\d.]+)%\s*Of inspections.*detention", detail)
        if m:
            result["detention_pct"] = float(m.group(1))

        # Status from Equasis
        m = re.search(r"Status\s*\n?\s*(In Service|Broken Up|Total Loss|Laid Up|Hulked|Scuttled|Sunk|Cancelled|Under Construction|Converting)", detail, re.I)
        if m:
            equasis_status = m.group(1).strip()
            status_map = {
                "In Service": "active", "In Service/Commission": "active",
                "Under Construction": "under_construction",
                "Broken Up": "scrapped", "Hulked": "scrapped",
                "Total Loss": "lost", "Sunk": "lost", "Scuttled": "lost",
                "Laid Up": "laid_up", "Cancelled": "scrapped",
            }
            result["equasis_status"] = status_map.get(equasis_status, "active")

        # Management detail: Owner, Manager
        try:
            page.click("text=Management detail", timeout=2000)
            page.wait_for_timeout(1500)
            mgmt = page.inner_text("body")

            # Registered owner
            m = re.search(r"Registered owner\s+([^\n]+)", mgmt)
            if m:
                owner = m.group(1).strip().split("\t")[0].strip()
                if owner and len(owner) > 2:
                    result["owner"] = owner[:100]

            # Ship manager
            m = re.search(r"Ship manager[^\n]*\s+([^\n]+)", mgmt)
            if m:
                manager = m.group(1).strip().split("\t")[0].strip()
                if manager and len(manager) > 2:
                    result["manager"] = manager[:100]

            # ISM Manager (often the operator)
            m = re.search(r"ISM Manager\s+([^\n]+)", mgmt)
            if m:
                ism = m.group(1).strip().split("\t")[0].strip()
                if ism and len(ism) > 2:
                    result["ism_manager"] = ism[:100]
        except:
            pass

    except Exception:
        pass

    return result


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # Ships needing enrichment
    DEFAULT_DWTS = (5000, 10000, 15000, 20000, 45000, 50000, 55000)
    placeholders = ",".join("?" * len(DEFAULT_DWTS))
    # Priority: Arklow + Oldendorff first, then rest by DWT desc
    ships = con.execute(f"""
        SELECT imo, name, dwt, year_built, gross_tonnage FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (
            (dwt IN ({placeholders}) AND (year_built IS NULL OR year_built = 0))
            OR (year_built IS NULL OR year_built = 0)
            OR (gross_tonnage IS NULL OR gross_tonnage = 0)
            OR (classification IS NULL OR classification = '')
            OR (p_and_i IS NULL OR p_and_i = '')
        )
        ORDER BY
            CASE WHEN UPPER(name) LIKE '%ARKLOW%' THEN 0
                 WHEN UPPER(name) LIKE '%OLDENDORFF%' THEN 1
                 ELSE 2 END,
            dwt DESC
        LIMIT ?
    """, (*DEFAULT_DWTS, MAX_PER_RUN)).fetchall()

    print(f"Enriching {len(ships)} ships from Equasis...", flush=True)

    p, browser, page = create_session()
    if not page:
        return

    enriched = 0
    try:
        for i, (imo, name, dwt, year_built, gt) in enumerate(ships):
            if i % 20 == 0 and i > 0:
                print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)

            data = search_ship(page, imo)
            if not data:
                time.sleep(DELAY)
                continue

            updates = []
            params = []

            # Update gross_tonnage (always trust Equasis)
            if data.get("gross_tonnage") and data["gross_tonnage"] > 0:
                updates.append("gross_tonnage = ?")
                params.append(data["gross_tonnage"])

            # Update year_built if missing
            if data.get("year_built") and (not year_built or year_built == 0):
                updates.append("year_built = ?")
                params.append(data["year_built"])

            # Update flag if from Equasis (more reliable)
            if data.get("flag"):
                # Extract country name from "Ireland (IRL)" format
                flag = re.sub(r"\s*\([A-Z]+\)\s*$", "", data["flag"]).strip()
                if flag:
                    updates.append("flag = ?")
                    params.append(flag)

            # DWT from detail page (replaces placeholder values)
            if data.get("dwt") and data["dwt"] > 0:
                cur_dwt = con.execute("SELECT dwt FROM ships WHERE imo=?", (imo,)).fetchone()
                if cur_dwt and cur_dwt[0] in (0, 5000, 10000, 15000, 20000, 45000, 50000, 55000):
                    updates.append("dwt = ?")
                    params.append(data["dwt"])

            # MMSI
            if data.get("mmsi"):
                updates.append("mmsi = COALESCE(NULLIF(mmsi, ''), ?)")
                params.append(data["mmsi"])

            # Call Sign
            if data.get("call_sign"):
                updates.append("call_sign = COALESCE(NULLIF(call_sign, ''), ?)")
                params.append(data["call_sign"])

            # Classification
            if data.get("classification"):
                updates.append("classification = ?")
                params.append(data["classification"])

            # P&I
            if data.get("p_and_i"):
                updates.append("p_and_i = ?")
                params.append(data["p_and_i"])

            # Flag Performance
            if data.get("flag_paris_mou"):
                updates.append("flag_paris_mou = ?")
                params.append(data["flag_paris_mou"])
            if data.get("flag_tokyo_mou"):
                updates.append("flag_tokyo_mou = ?")
                params.append(data["flag_tokyo_mou"])

            # Detention
            if data.get("detention_pct") is not None:
                updates.append("detention_pct = ?")
                params.append(data["detention_pct"])

            # Status from Equasis (overrides our guess)
            if data.get("equasis_status"):
                updates.append("status = ?")
                params.append(data["equasis_status"])

            # Owner / Manager from Management detail
            if data.get("owner"):
                updates.append("owner = ?")
                params.append(data["owner"])
            if data.get("manager"):
                updates.append("manager = ?")
                params.append(data["manager"])
            if data.get("ism_manager"):
                updates.append("ism_manager = ?")
                params.append(data["ism_manager"])
                # If no operator set, use ISM Manager as operator
                cur_op = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
                if cur_op and (not cur_op[0] or cur_op[0] == ""):
                    updates.append("operator = ?")
                    params.append(data["ism_manager"])

            if updates:
                params.append(imo)
                con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
                con.commit()
                enriched += 1

                changes = []
                if data.get("gross_tonnage"):
                    changes.append(f"GT={data['gross_tonnage']}")
                if data.get("dwt"):
                    changes.append(f"DWT={data['dwt']}")
                if data.get("year_built") and (not year_built or year_built == 0):
                    changes.append(f"Year={data['year_built']}")
                if data.get("flag"):
                    changes.append(f"Flag={data['flag']}")
                if data.get("mmsi"):
                    changes.append(f"MMSI={data['mmsi']}")
                if data.get("classification"):
                    changes.append(f"Class={data['classification'][:15]}")
                if data.get("p_and_i"):
                    changes.append(f"P&I={data['p_and_i'][:20]}")
                if data.get("flag_paris_mou"):
                    changes.append(f"MOU={data['flag_paris_mou']}")
                if data.get("owner"):
                    changes.append(f"Owner={data['owner'][:20]}")
                if data.get("ism_manager"):
                    changes.append(f"ISM={data['ism_manager'][:20]}")
                if data.get("equasis_status") and data["equasis_status"] != "active":
                    changes.append(f"STATUS={data['equasis_status']}")
                print(f"  OK  {name[:25]:25} {' | '.join(changes)}", flush=True)

            time.sleep(DELAY)

    finally:
        browser.close()
        p.stop()

    con.close()
    print(f"\nDone: {enriched} ships enriched from Equasis", flush=True)

    # Recalculate valuations with new data
    if enriched > 0:
        print(f"\nRecalculating daily valuations...", flush=True)
        import subprocess
        result = subprocess.run(
            ["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
            capture_output=True, text=True, cwd="/opt/bulkwatch"
        )
        print(result.stdout, flush=True)
        if result.stderr:
            print(result.stderr, flush=True)


if __name__ == "__main__":
    main()
