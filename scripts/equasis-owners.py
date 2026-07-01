#!/usr/bin/env python3
"""Equasis Owner/P&I Scraper v2 — direct URL navigation, no search needed.
Cron: 30 5 * * *"""
import sqlite3, re, time

DB = "/opt/bulkwatch/db/ships.db"
import sys as _sys
MAX_PER_RUN = int(_sys.argv[_sys.argv.index("--limit")+1]) if "--limit" in _sys.argv else 200
DELAY = 10.0
ACCOUNTS = [
    ("kayconrad81@googlemail.com", "!nfinitY!981"),
    ("kayconrad@posteo.de", "!nfinitY!981"),
]


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    ships = con.execute("""
        SELECT imo, name FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND classification IS NOT NULL AND classification != ''
        AND (owner IS NULL OR owner = '' OR p_and_i IS NULL OR p_and_i = '')
        ORDER BY RANDOM()
        LIMIT ?
    """, (MAX_PER_RUN,)).fetchall()

    if not ships:
        print("No ships need Owner/P&I enrichment.", flush=True)
        return

    print(f"Enriching Owner/P&I for {len(ships)} ships...", flush=True)

    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Login - try each account
    logged_in = False
    for email, password in ACCOUNTS:
        try:
            page.goto("https://www.equasis.org/EquasisWeb/public/HomePage", wait_until="networkidle", timeout=90000)
            page.wait_for_timeout(2000)
            for inp in page.query_selector_all("input[name=j_email]"):
                if inp.is_visible(): inp.fill(email); break
            for pw in page.query_selector_all("input[name=j_password]"):
                if pw.is_visible(): pw.fill(password); break
            for s in page.query_selector_all("input[type=submit]"):
                if s.is_visible(): s.click(); break
            page.wait_for_timeout(5000)
            body = page.inner_text("body")
            if "locked" in body.lower():
                print(f"  {email} locked, trying next...", flush=True)
                continue
            logged_in = True
            print(f"  Logged in as {email}", flush=True)
            break
        except Exception as e:
            print(f"  {email} failed: {e}", flush=True)
            continue
    if not logged_in:
        print("All accounts failed!", flush=True)
        browser.close(); p.stop(); return

    print("Equasis login OK", flush=True)
    enriched = 0
    consecutive_fails = 0

    try:
        for i, (imo, name) in enumerate(ships):
            if i % 50 == 0 and i > 0:
                print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)

            if consecutive_fails >= 5:
                print("  5 consecutive fails, re-logging in...", flush=True)
                time.sleep(60)
                relogged = False
                for email, password in ACCOUNTS:
                    try:
                        page.goto("https://www.equasis.org/EquasisWeb/public/HomePage", wait_until="networkidle", timeout=90000)
                        page.wait_for_timeout(2000)
                        for inp in page.query_selector_all("input[name=j_email]"):
                            if inp.is_visible(): inp.fill(email); break
                        for pw in page.query_selector_all("input[name=j_password]"):
                            if pw.is_visible(): pw.fill(password); break
                        for s in page.query_selector_all("input[type=submit]"):
                            if s.is_visible(): s.click(); break
                        page.wait_for_timeout(5000)
                        body = page.inner_text("body")
                        if "locked" not in body.lower():
                            consecutive_fails = 0
                            relogged = True
                            print(f"  Re-login OK ({email})", flush=True)
                            break
                    except:
                        continue
                if not relogged:
                    print("  All accounts failed, stopping.", flush=True)
                    break

            try:
                # First search to establish context
                page.goto(f"https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage", wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(1000)

                home = page.query_selector("input[name=P_ENTREE_HOME]")
                if home and home.is_visible():
                    home.fill(str(imo))
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(3000)

                # Open detail via JS
                page.evaluate(f'document.formShip.P_IMO.value="{imo}";document.formShip.submit();')
                page.wait_for_timeout(4000)

                # Check we're on the right page
                body = page.inner_text("body")
                if str(imo) not in body:
                    consecutive_fails += 1
                    time.sleep(DELAY)
                    continue

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
                m = re.search(r"Registered owner\s+([^\n\t]+)", text)
                if m:
                    owner = m.group(1).strip()
                    if owner and len(owner) > 2 and not owner.startswith("IMO"):
                        updates.append("owner = ?"); params.append(owner[:100])

                # Manager
                m = re.search(r"Ship manager[/\w\s]*\s+([^\n\t]+)", text)
                if m:
                    mgr = m.group(1).strip()
                    if mgr and len(mgr) > 2 and not mgr.startswith("IMO"):
                        updates.append("manager = ?"); params.append(mgr[:100])

                # ISM Manager
                m = re.search(r"ISM Manager\s+([^\n\t]+)", text)
                if m:
                    ism = m.group(1).strip()
                    if ism and len(ism) > 2 and not ism.startswith("IMO"):
                        updates.append("ism_manager = ?"); params.append(ism[:100])
                        cur_op = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
                        if cur_op and (not cur_op[0] or cur_op[0] == ""):
                            updates.append("operator = ?"); params.append(ism[:100])

                # P&I
                m = re.search(r"P&I Information\s*\n\s*([^\n]+)", text)
                if m:
                    pi = m.group(1).strip()
                    if pi and len(pi) > 3 and "Equasis" not in pi and "Geographical" not in pi and "Convention" not in pi:
                        updates.append("p_and_i = ?"); params.append(pi[:100])

                if updates:
                    params.append(imo)
                    con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
                    con.commit()
                    enriched += 1
                    consecutive_fails = 0
                    parts = []
                    if any("owner" in u for u in updates): parts.append("Owner")
                    if any("p_and_i" in u for u in updates): parts.append("P&I")
                    if any("ism" in u for u in updates): parts.append("ISM")
                    print(f"  OK  {name[:25]:25} {' | '.join(parts)}", flush=True)
                else:
                    consecutive_fails = 0  # page loaded but no new data

            except Exception as e:
                if "Timeout" in str(e):
                    consecutive_fails += 1
                continue

            time.sleep(DELAY)

    finally:
        browser.close()
        p.stop()

    con.close()
    print(f"\nDone: {enriched}/{len(ships)} enriched with Owner/P&I", flush=True)


if __name__ == "__main__":
    main()
