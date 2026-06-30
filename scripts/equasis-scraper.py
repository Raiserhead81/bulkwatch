#!/usr/bin/env python3
"""Equasis Scraper v5 — HTTP-only (no Playwright), 3x faster.
Extracts: DWT, GT, Year, Flag, MMSI, Call Sign, Classification, P&I, MOU,
Detention%, Owner, Manager, ISM Manager, Status."""
import sqlite3, urllib.request, urllib.parse, http.cookiejar, re, time, sys

DB = "/opt/bulkwatch/db/ships.db"
import sys as _sys
MAX_PER_RUN = int(_sys.argv[_sys.argv.index("--limit")+1]) if "--limit" in _sys.argv else 800
DELAY = 8.0
ACCOUNTS = [
    ("kayconrad@posteo.de", "!nfinitY!981"),
    ("kayconrad81@googlemail.com", "!nfinitY!981"),
]
account_idx = 0

DEFAULT_DWTS = {0, 5000, 10000, 12000, 15000, 18000, 20000, 45000, 46000, 47000, 50000, 55000}
STATUS_MAP = {
    "In Service": "active", "In Service/Commission": "active",
    "Under Construction": "under_construction",
    "Broken Up": "scrapped", "Hulked": "scrapped",
    "Total Loss": "lost", "Sunk": "lost", "Scuttled": "lost",
    "Laid Up": "laid_up", "Cancelled": "scrapped", "Converting": "active",
}
CLASS_NAMES = ["Lloyd's Register", "DNV", "Bureau Veritas", "Nippon Kaiji Kyokai",
               "American Bureau of Shipping", "ClassNK", "RINA", "Korean Register",
               "China Classification Society", "Indian Register", "Russian Maritime",
               "Registro Italiano Navale"]


def login(idx=None):
    global account_idx
    if idx is not None:
        account_idx = idx
    email, password = ACCOUNTS[account_idx % len(ACCOUNTS)]
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
    try:
        opener.open("https://www.equasis.org/EquasisWeb/public/HomePage", timeout=30)
        data = urllib.parse.urlencode({"j_email": email, "j_password": password}).encode()
        r = opener.open("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage", data, timeout=30)
        html = r.read().decode("utf-8", errors="ignore")
        if "locked" in html.lower():
            print(f"  Account {email} locked, trying next...", flush=True)
            account_idx += 1
            if account_idx < len(ACCOUNTS) * 2:  # try each account once
                return login(account_idx)
            return None
        print(f"  Logged in as {email}", flush=True)
        return opener
    except Exception as e:
        print(f"Login failed ({email}): {e}", flush=True)
        return None


def search_and_detail(opener, imo):
    """Search + detail in 2 HTTP requests. Returns dict with all data."""
    result = {}
    try:
        # Search
        sd = urllib.parse.urlencode({"P_ENTREE_HOME": str(imo)}).encode()
        r = opener.open("https://www.equasis.org/EquasisWeb/restricted/Search?fs=HomePage", sd, timeout=20)
        search_html = r.read().decode("utf-8", errors="ignore")

        # Parse search result line
        for line in re.findall(r"<tr[^>]*>.*?</tr>", search_html, re.DOTALL):
            if str(imo) in line:
                tds = re.findall(r"<td[^>]*>(.*?)</td>", line, re.DOTALL)
                clean = [re.sub(r"<[^>]+>", "", td).strip() for td in tds]
                if len(clean) >= 6:
                    result["gross_tonnage"] = int(clean[2]) if clean[2].isdigit() else None
                    result["type"] = clean[3] if clean[3] else None
                    result["year_built"] = int(clean[4]) if clean[4].isdigit() else None
                    result["flag"] = clean[5] if clean[5] else None
                break

        # Detail page
        dd = urllib.parse.urlencode({"P_IMO": str(imo)}).encode()
        r2 = opener.open("https://www.equasis.org/EquasisWeb/restricted/ShipInfo?fs=Search", dd, timeout=20)
        html = r2.read().decode("utf-8", errors="ignore")

        # Equasis uses Bootstrap div grid, not tables. Pattern:
        # <b>LABEL </b>...</div>...<div class="col-...">VALUE</div>
        def extract_field(label, html_text):
            m = re.search(label + r'\s*</b>.*?<div[^>]*class="col-[^"]*"[^>]*>\s*([^<\r\n]+)', html_text, re.DOTALL | re.I)
            return m.group(1).strip() if m else None

        # DWT
        val = extract_field("DWT", html)
        if val and val.replace(",", "").isdigit():
            result["dwt"] = int(val.replace(",", ""))

        # MMSI
        val = extract_field("MMSI", html)
        if val and re.match(r"\d{9}$", val):
            result["mmsi"] = val

        # Call Sign
        val = extract_field("Call Sign", html)
        if val and re.match(r"[A-Z0-9]{3,10}$", val):
            result["call_sign"] = val

        # Gross Tonnage (from detail, more reliable)
        val = extract_field("Gross tonnage", html)
        if val and val.replace(",", "").isdigit():
            result["gross_tonnage"] = int(val.replace(",", ""))

        # Status
        val = extract_field("Status", html)
        if val:
            for key in STATUS_MAP:
                if key.lower() in val.lower():
                    result["equasis_status"] = STATUS_MAP[key]
                    break

        # Classification
        for cls in CLASS_NAMES:
            if cls in html:
                result["classification"] = cls
                break

        # Paris/Tokyo MOU (in main page, not AJAX)
        m = re.search(r'Paris MOU.*?(White|Grey|Black)', html, re.DOTALL | re.I)
        if m:
            result["flag_paris_mou"] = m.group(1)
        m = re.search(r'Tokyo MOU.*?(White|Grey|Black)', html, re.DOTALL | re.I)
        if m:
            result["flag_tokyo_mou"] = m.group(1)

        # Detention %
        m = re.search(r'([\d.]+)%\s*Of inspections.*?detention', html, re.DOTALL | re.I)
        if m:
            result["detention_pct"] = float(m.group(1))

        # Management: Owner, Manager, ISM — uses <td> with lots of whitespace
        mgmt_start = html.find("Management detail")
        mgmt_end = html.find("Classification", mgmt_start + 20) if mgmt_start > 0 else -1
        mgmt = html[mgmt_start:mgmt_end] if mgmt_start > 0 and mgmt_end > 0 else ""
        if mgmt:
            def extract_role(role_name, section):
                m = re.search(role_name + r'</td>\s*<td[^>]*>(.*?)</td>', section, re.DOTALL | re.I)
                if m:
                    val = re.sub(r'<[^>]+>', ' ', m.group(1)).strip()
                    val = re.sub(r'\s+', ' ', val).strip()
                    return val[:100] if val and len(val) > 2 else None
                return None

            result["owner"] = extract_role("Registered owner", mgmt)
            result["manager"] = extract_role("Ship manager", mgmt) or extract_role("Commercial manager", mgmt)
            result["ism_manager"] = extract_role("ISM Manager", mgmt)

    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited, waiting 60s...", flush=True)
            time.sleep(60)
        elif e.code in (404, 403):
            result["_session_expired"] = True
    except Exception as e:
        pass

    return result


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    ships = con.execute("""
        SELECT imo, name, dwt, year_built, gross_tonnage FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (
            dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
            OR (year_built IS NULL OR year_built = 0)
            OR (gross_tonnage IS NULL OR gross_tonnage = 0)
            OR (classification IS NULL OR classification = '')
            OR (p_and_i IS NULL OR p_and_i = '')
            OR (owner IS NULL OR owner = '')
        )
        ORDER BY
            CASE WHEN UPPER(name) LIKE '%ARKLOW%' THEN 0
                 WHEN UPPER(name) LIKE '%OLDENDORFF%' THEN 1
                 ELSE 2 END,
            dwt DESC
        LIMIT ?
    """, (MAX_PER_RUN,)).fetchall()

    print(f"Enriching {len(ships)} ships from Equasis (HTTP mode)...", flush=True)

    global account_idx
    opener = login()
    if not opener:
        return

    print("Equasis login OK", flush=True)
    enriched = 0

    for i, (imo, name, dwt, year_built, gt) in enumerate(ships):
        if i % 100 == 0 and i > 0:
            print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)
            # Recalc valuations every 100 ships
            if enriched > 0:
                import subprocess
                subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
                               capture_output=True, cwd="/opt/bulkwatch")
                print(f"  Valuations recalculated", flush=True)

        data = search_and_detail(opener, imo)

        # Session expired? Switch account and re-login
        if data.get("_session_expired"):
            account_idx += 1
            print(f"  Session expired, switching to account {account_idx % len(ACCOUNTS) + 1}...", flush=True)
            time.sleep(30)
            opener = login()
            if not opener:
                print("  All accounts failed, waiting 300s...", flush=True)
                time.sleep(300)
                account_idx = 0
                opener = login()
                if not opener:
                    print("  Still failed, stopping.", flush=True)
                    break
            data = search_and_detail(opener, imo)

        if not data or data.get("_session_expired"):
            time.sleep(DELAY)
            continue

        updates = []
        params = []

        if data.get("gross_tonnage") and data["gross_tonnage"] > 0:
            updates.append("gross_tonnage = ?"); params.append(data["gross_tonnage"])
        if data.get("year_built") and (not year_built or year_built == 0):
            updates.append("year_built = ?"); params.append(data["year_built"])
        if data.get("flag"):
            flag = re.sub(r"\s*\([A-Z]+\)\s*$", "", data["flag"]).strip()
            if flag: updates.append("flag = ?"); params.append(flag)
        if data.get("dwt") and data["dwt"] > 0 and dwt in DEFAULT_DWTS:
            updates.append("dwt = ?"); params.append(data["dwt"])
        if data.get("mmsi"):
            updates.append("mmsi = COALESCE(NULLIF(mmsi, ''), ?)"); params.append(data["mmsi"])
        if data.get("call_sign"):
            updates.append("call_sign = COALESCE(NULLIF(call_sign, ''), ?)"); params.append(data["call_sign"])
        if data.get("classification"):
            updates.append("classification = ?"); params.append(data["classification"])
        if data.get("p_and_i"):
            updates.append("p_and_i = ?"); params.append(data["p_and_i"])
        if data.get("flag_paris_mou"):
            updates.append("flag_paris_mou = ?"); params.append(data["flag_paris_mou"])
        if data.get("flag_tokyo_mou"):
            updates.append("flag_tokyo_mou = ?"); params.append(data["flag_tokyo_mou"])
        if data.get("detention_pct") is not None:
            updates.append("detention_pct = ?"); params.append(data["detention_pct"])
        if data.get("equasis_status"):
            updates.append("status = ?"); params.append(data["equasis_status"])
        if data.get("owner"):
            updates.append("owner = ?"); params.append(data["owner"])
        if data.get("manager"):
            updates.append("manager = ?"); params.append(data["manager"])
        if data.get("ism_manager"):
            updates.append("ism_manager = ?"); params.append(data["ism_manager"])
            cur_op = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
            if cur_op and (not cur_op[0] or cur_op[0] == ""):
                updates.append("operator = ?"); params.append(data["ism_manager"])

        if updates:
            params.append(imo)
            con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
            con.commit()
            enriched += 1
            changes = []
            if data.get("dwt"): changes.append(f"DWT={data['dwt']}")
            if data.get("year_built") and (not year_built or year_built == 0): changes.append(f"Y={data['year_built']}")
            if data.get("classification"): changes.append(f"C={data['classification'][:12]}")
            if data.get("p_and_i"): changes.append(f"PI={data['p_and_i'][:15]}")
            if data.get("owner"): changes.append(f"O={data['owner'][:15]}")
            if data.get("equasis_status") and data["equasis_status"] != "active": changes.append(f"S={data['equasis_status']}")
            print(f"  OK  {name[:25]:25} {' | '.join(changes)}", flush=True)

        time.sleep(DELAY)

    con.close()
    print(f"\nDone: {enriched}/{len(ships)} enriched", flush=True)

    if enriched > 0:
        print("Recalculating valuations...", flush=True)
        import subprocess
        r = subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"], capture_output=True, text=True, cwd="/opt/bulkwatch")
        print(r.stdout, flush=True)


if __name__ == "__main__":
    main()
