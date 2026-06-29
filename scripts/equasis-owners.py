#!/usr/bin/env python3
"""Equasis Owner/P&I Scraper — Playwright-based for AJAX sections.
Runs after the HTTP scraper, targets ships that have Classification but no Owner.
Cron: 0 4 * * * (nightly 04:00, after HTTP scraper finishes at ~02:00)"""
import sqlite3, re, time

DB = "/opt/bulkwatch/db/ships.db"
MAX_PER_RUN = 500
DELAY = 4.0
EMAIL = "kayconrad@posteo.de"
PASSWORD = "!nfinitY!981"


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    ships = con.execute("""
        SELECT imo, name FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND classification IS NOT NULL AND classification != ''
        AND (owner IS NULL OR owner = '' OR p_and_i IS NULL OR p_and_i = '')
        ORDER BY
            CASE WHEN UPPER(name) LIKE '%ARKLOW%' THEN 0
                 WHEN UPPER(name) LIKE '%OLDENDORFF%' THEN 1
                 ELSE 2 END,
            dwt DESC
        LIMIT ?
    """, (MAX_PER_RUN,)).fetchall()

    if not ships:
        print("No ships need Owner/P&I enrichment.", flush=True)
        return

    print(f"Enriching Owner/P&I for {len(ships)} ships (Playwright)...", flush=True)

    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Login
    page.goto("https://www.equasis.org/EquasisWeb/public/HomePage", wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2000)
    for inp in page.query_selector_all("input[name=j_email]"):
        if inp.is_visible(): inp.fill(EMAIL); break
    for pw in page.query_selector_all("input[name=j_password]"):
        if pw.is_visible(): pw.fill(PASSWORD); break
    for s in page.query_selector_all("input[type=submit]"):
        if s.is_visible(): s.click(); break
    page.wait_for_timeout(3000)

    if "Search" not in page.inner_text("body"):
        print("Login failed!", flush=True)
        browser.close(); p.stop(); return

    print("Equasis login OK", flush=True)
    enriched = 0

    try:
        for i, (imo, name) in enumerate(ships):
            if i % 50 == 0 and i > 0:
                print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)

            try:
                # Search
                home = page.query_selector("input[name=P_ENTREE_HOME]")
                if not home or not home.is_visible():
                    page.goto("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage",
                              wait_until="networkidle", timeout=60000)
                    page.wait_for_timeout(1000)
                    home = page.query_selector("input[name=P_ENTREE_HOME]")
                if not home:
                    continue

                home.fill("")
                home.fill(str(imo))
                page.keyboard.press("Enter")
                page.wait_for_timeout(3000)

                # Open detail
                page.evaluate(f"document.formShip.P_IMO.value='{imo}';document.formShip.submit();")
                page.wait_for_timeout(4000)

                # Expand Management + P&I
                for section in ["Management detail", "P&I Information"]:
                    try:
                        page.click(f"text={section}", timeout=3000)
                        page.wait_for_timeout(1500)
                    except:
                        pass

                text = page.inner_text("body")
                updates = []
                params = []

                # Owner
                m = re.search(r"Registered owner\s+([^\n]+)", text)
                if m:
                    owner = m.group(1).strip().split("\t")[0].strip()
                    if owner and len(owner) > 2:
                        updates.append("owner = ?"); params.append(owner[:100])

                # Manager
                m = re.search(r"Ship manager[^\n]*\s+([^\n]+)", text)
                if m:
                    mgr = m.group(1).strip().split("\t")[0].strip()
                    if mgr and len(mgr) > 2:
                        updates.append("manager = ?"); params.append(mgr[:100])

                # ISM Manager
                m = re.search(r"ISM Manager\s+([^\n]+)", text)
                if m:
                    ism = m.group(1).strip().split("\t")[0].strip()
                    if ism and len(ism) > 2:
                        updates.append("ism_manager = ?"); params.append(ism[:100])
                        cur_op = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
                        if cur_op and (not cur_op[0] or cur_op[0] == ""):
                            updates.append("operator = ?"); params.append(ism[:100])

                # P&I
                m = re.search(r"P&I Information\s*\n?\s*([^\n]+)", text)
                if m:
                    pi = m.group(1).strip()
                    if pi and len(pi) > 3 and "Equasis" not in pi and "Geographical" not in pi:
                        updates.append("p_and_i = ?"); params.append(pi[:100])

                if updates:
                    params.append(imo)
                    con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
                    con.commit()
                    enriched += 1
                    changes = []
                    if any("owner" in u for u in updates): changes.append(f"O={params[0][:20]}")
                    if any("p_and_i" in u for u in updates): changes.append("P&I")
                    if any("ism_manager" in u for u in updates): changes.append("ISM")
                    print(f"  OK  {name[:25]:25} {' | '.join(changes)}", flush=True)

            except Exception as e:
                if "Timeout" in str(e):
                    print(f"  TIMEOUT {name[:25]}, continuing...", flush=True)
                continue

            time.sleep(DELAY)

    finally:
        browser.close()
        p.stop()

    con.close()
    print(f"\nDone: {enriched}/{len(ships)} enriched with Owner/P&I", flush=True)


if __name__ == "__main__":
    main()
