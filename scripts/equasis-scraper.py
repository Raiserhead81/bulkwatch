#!/usr/bin/env python3
"""Equasis Scraper v6 — full enrichment in one pass.
Extracts ALL available fields: DWT, GT, Year, Flag, Type, MMSI, Call Sign,
Classification, P&I clubs, MOU colors, Inspections, Surveys,
Owner, Manager, ISM Manager, Status.
Skips ships scraped in the last 14 days via equasis_last_scraped."""
import sqlite3, urllib.request, urllib.parse, http.cookiejar, re, time, sys
from datetime import datetime, timedelta

DB = "/opt/bulkwatch/db/ships.db"
MAX_PER_RUN = int(sys.argv[sys.argv.index("--limit")+1]) if "--limit" in sys.argv else 800
DELAY = 8.0
RESCRAPE_DAYS = 14
ACCOUNTS = [
    ("kayconrad@posteo.de", "!nfinitY!981"),
    ("kayconrad81@googlemail.com", "!nfinitY!981"),
    ("kpoffen@proton.me", "!nfinitY!981"),
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
CLASS_NAMES = [
    "Lloyd's Register", "DNV", "Bureau Veritas", "Nippon Kaiji Kyokai",
    "American Bureau of Shipping", "ClassNK", "RINA", "Korean Register",
    "China Classification Society", "Indian Register", "Russian Maritime",
    "Registro Italiano Navale", "Croatian Register", "Polish Register",
    "Turk Loydu", "Biro Klasifikasi Indonesia",
]


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
            if account_idx < len(ACCOUNTS) * 2:
                return login(account_idx)
            return None
        print(f"  Logged in as {email}", flush=True)
        return opener
    except Exception as e:
        print(f"Login failed ({email}): {e}", flush=True)
        return None


def scrape_ship(opener, imo):
    """Search + detail page. Returns dict with all extracted data."""
    result = {}
    try:
        # Step 1: Search (sets server-side session context)
        sd = urllib.parse.urlencode({"P_ENTREE_HOME": str(imo)}).encode()
        r = opener.open("https://www.equasis.org/EquasisWeb/restricted/Search?fs=HomePage", sd, timeout=20)
        r.read()  # consume response

        # Step 2: Detail page
        dd = urllib.parse.urlencode({"P_IMO": str(imo)}).encode()
        r2 = opener.open("https://www.equasis.org/EquasisWeb/restricted/ShipInfo?fs=Search", dd, timeout=20)
        html = r2.read().decode("utf-8", errors="ignore")

        # Check for error page
        if "CtrlGeneralError" in html:
            result["_session_expired"] = True
            return result

        # --- Header fields (Bootstrap div grid) ---
        def extract_field(label):
            m = re.search(label + r'\s*</b>.*?<div[^>]*class="col-[^"]*"[^>]*>\s*([^<\r\n]+)',
                          html, re.DOTALL | re.I)
            return m.group(1).strip() if m else None

        # DWT
        val = extract_field("DWT")
        if val and val.replace(",", "").isdigit():
            result["dwt"] = int(val.replace(",", ""))

        # Gross Tonnage
        val = extract_field("Gross tonnage")
        if val and val.replace(",", "").isdigit():
            result["gross_tonnage"] = int(val.replace(",", ""))

        # Year of build
        val = extract_field("Year of build")
        if val and val.strip().isdigit():
            result["year_built"] = int(val)

        # Type of ship
        val = extract_field("Type of ship")
        if val and len(val) > 2:
            result["type"] = val[:50]

        # Flag — extract from text, strip country code suffix
        val = extract_field("Flag")
        if val and len(val) > 1:
            flag = re.sub(r"\s*\([A-Z]+\)\s*$", "", val).strip()
            flag = flag.replace("&nbsp;", "").replace("\xa0", "").strip()
            if flag and flag not in ("&nbsp;", ""):
                result["flag"] = flag

        # MMSI
        val = extract_field("MMSI")
        if val and re.match(r"\d{9}$", val.strip()):
            result["mmsi"] = val.strip()

        # Call Sign
        val = extract_field("Call Sign")
        if val and re.match(r"[A-Z0-9]{3,10}$", val.strip()):
            result["call_sign"] = val.strip()

        # Status
        val = extract_field("Status")
        if val:
            for key in STATUS_MAP:
                if key.lower() in val.lower():
                    result["equasis_status"] = STATUS_MAP[key]
                    break

        # --- Classification (substring search in HTML) ---
        # Look specifically in the Classification section, not the whole page
        class_section = ""
        cs_start = html.find("Classification")
        if cs_start > 0:
            cs_end = html.find("Surveys", cs_start + 20)
            if cs_end < 0:
                cs_end = cs_start + 2000
            class_section = html[cs_start:cs_end]

        for cls in CLASS_NAMES:
            if cls in class_section:
                result["classification"] = cls
                break

        # If not found in section, try broader search but with (IACS) suffix
        if not result.get("classification"):
            for cls in CLASS_NAMES:
                pattern = cls + r'\s*\(IACS\)'
                if re.search(pattern, html):
                    result["classification"] = cls
                    break
            # Last resort: any mention
            if not result.get("classification"):
                for cls in CLASS_NAMES:
                    if cls in html:
                        result["classification"] = cls
                        break

        # --- Paris/Tokyo MOU ---
        m = re.search(r'Paris MOU.*?(White|Grey|Black)', html, re.DOTALL | re.I)
        if m:
            result["flag_paris_mou"] = m.group(1).capitalize()
        m = re.search(r'Tokyo MOU.*?(White|Grey|Black)', html, re.DOTALL | re.I)
        if m:
            result["flag_tokyo_mou"] = m.group(1).capitalize()

        # --- Inspections count ---
        m = re.search(r'Inspections\s*\((\d+)\)', html)
        if m:
            result["inspections_count"] = int(m.group(1))

        # --- Surveys: last/next renewal ---
        m = re.search(r'Last renewal survey[^<]*?(\d{4}-\d{2}-\d{2})', html, re.DOTALL | re.I)
        if m:
            result["last_survey"] = m.group(1)
        m = re.search(r'Next renewal survey[^<]*?(\d{4}-\d{2}-\d{2})', html, re.DOTALL | re.I)
        if m:
            result["next_survey"] = m.group(1)

        # --- P&I Clubs ---
        pi_start = html.find("P&amp;I Information")
        if pi_start < 0:
            pi_start = html.find("P&I Information")
        if pi_start > 0:
            pi_end = html.find("Geographical", pi_start)
            if pi_end < 0:
                pi_end = pi_start + 2000
            pi_section = html[pi_start:pi_end]
            # Extract club names — they appear as text between tags
            pi_section = re.sub(r"<a[^>]*>", "", pi_section)
            pi_section = re.sub(r"</a>", "", pi_section)
            pi_text = re.sub(r"<[^>]+>", "\n", pi_section)
            pi_lines = [l.strip() for l in pi_text.split("\n") if l.strip()]
            clubs = []
            for line in pi_lines:
                if (len(line) > 5 and "P&I" not in line and "P&amp;I" not in line
                    and "Inception" not in line and "Geographical" not in line
                    and "Information" not in line and not line.startswith("20")
                    and not line.startswith("<") and "href" not in line
                    and "modal" not in line):
                    clean_line = re.sub(r"<[^>]+>", "", line).strip()
                    if clean_line and len(clean_line) > 3:
                        clubs.append(clean_line[:60])
            if clubs:
                result["p_and_i"] = "; ".join(clubs[:3])  # max 3 clubs

        # --- Management: Owner, Manager, ISM ---
        mgmt_start = html.find("Management detail")
        mgmt_end = html.find("Classification", mgmt_start + 20) if mgmt_start > 0 else -1
        mgmt = html[mgmt_start:mgmt_end] if mgmt_start > 0 and mgmt_end > 0 else ""
        if mgmt:
            def extract_role(role_name, section):
                m = re.search(role_name + r'\s*</td>\s*<td[^>]*>\s*(.*?)\s*</td>',
                              section, re.DOTALL | re.I)
                if m:
                    val = re.sub(r'<[^>]+>', ' ', m.group(1)).strip()
                    val = re.sub(r'\s+', ' ', val).strip()
                    return val[:100] if val and len(val) > 2 else None
                return None

            result["owner"] = extract_role("Registered owner", mgmt)
            result["manager"] = (extract_role("Ship manager", mgmt)
                                 or extract_role("Commercial manager", mgmt)
                                 or extract_role("manager", mgmt))
            result["ism_manager"] = extract_role("ISM Manager", mgmt)

    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited, waiting 60s...", flush=True)
            time.sleep(60)
        elif e.code in (404, 403):
            result["_session_expired"] = True
    except Exception:
        pass

    return result


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    cutoff = (datetime.now() - timedelta(days=RESCRAPE_DAYS)).strftime("%Y-%m-%d")

    ships = con.execute("""
        SELECT imo, name, dwt, year_built, gross_tonnage FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (equasis_last_scraped IS NULL OR equasis_last_scraped < ?)
        ORDER BY
            CASE WHEN equasis_last_scraped IS NULL THEN 0 ELSE 1 END,
            RANDOM()
        LIMIT ?
    """, (cutoff, MAX_PER_RUN)).fetchall()

    print(f"Enriching {len(ships)} ships from Equasis (v6, full extraction)...", flush=True)

    global account_idx
    opener = login()
    if not opener:
        return

    print("Equasis login OK", flush=True)
    enriched = 0
    today = datetime.now().strftime("%Y-%m-%d")

    for i, (imo, name, dwt, year_built, gt) in enumerate(ships):
        if i % 100 == 0 and i > 0:
            print(f"  [{i}/{len(ships)}] enriched={enriched}", flush=True)
            if enriched > 0:
                import subprocess
                subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
                               capture_output=True, cwd="/opt/bulkwatch")
                print(f"  Valuations recalculated", flush=True)

        data = scrape_ship(opener, imo)

        # Session expired? Switch account
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
            data = scrape_ship(opener, imo)

        if not data or data.get("_session_expired"):
            time.sleep(DELAY)
            continue

        # Build UPDATE
        updates = []
        params = []

        field_map = {
            "gross_tonnage": ("gross_tonnage = ?", lambda v: v and v > 0),
            "dwt": ("dwt = ?", lambda v: v and v > 0 and dwt in DEFAULT_DWTS),
            "year_built": ("year_built = ?", lambda v: v and (not year_built or year_built == 0)),
            "flag": ("flag = ?", lambda v: v),
            "type": ("type = ?", lambda v: v),
            "mmsi": ("mmsi = ?", lambda v: v),
            "call_sign": ("call_sign = ?", lambda v: v),
            "classification": ("classification = ?", lambda v: v),
            "p_and_i": ("p_and_i = ?", lambda v: v),
            "flag_paris_mou": ("flag_paris_mou = ?", lambda v: v),
            "flag_tokyo_mou": ("flag_tokyo_mou = ?", lambda v: v),
            "inspections_count": ("inspections_count = ?", lambda v: v is not None),
            "last_survey": ("last_survey = ?", lambda v: v),
            "next_survey": ("next_survey = ?", lambda v: v),
            "detention_pct": ("detention_pct = ?", lambda v: v is not None),
            "equasis_status": ("status = ?", lambda v: v),
            "owner": ("owner = ?", lambda v: v),
            "manager": ("manager = ?", lambda v: v),
            "ism_manager": ("ism_manager = ?", lambda v: v),
        }

        for key, (sql, check) in field_map.items():
            val = data.get(key)
            if check(val):
                updates.append(sql)
                params.append(val)

        # ISM → operator fallback
        if data.get("ism_manager"):
            cur_op = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
            if cur_op and (not cur_op[0] or cur_op[0] == ""):
                updates.append("operator = ?")
                params.append(data["ism_manager"])

        # Always mark as scraped
        updates.append("equasis_last_scraped = ?")
        params.append(today)

        params.append(imo)
        con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
        con.commit()

        # Count fields actually extracted (excluding timestamp)
        field_count = len(updates) - 1  # minus the timestamp
        if field_count > 0:
            enriched += 1

        # Log with all fields
        parts = []
        if data.get("dwt"): parts.append(f"DWT={data['dwt']}")
        if data.get("gross_tonnage"): parts.append(f"GT={data['gross_tonnage']}")
        if data.get("year_built") and (not year_built or year_built == 0): parts.append(f"Y={data['year_built']}")
        if data.get("type"): parts.append(f"T={data['type'][:15]}")
        if data.get("flag"): parts.append(f"F={data['flag'][:12]}")
        if data.get("mmsi"): parts.append(f"MMSI={data['mmsi']}")
        if data.get("call_sign"): parts.append(f"CS={data['call_sign']}")
        if data.get("classification"): parts.append(f"C={data['classification'][:12]}")
        if data.get("owner"): parts.append(f"O={data['owner'][:20]}")
        if data.get("manager"): parts.append(f"M={data['manager'][:20]}")
        if data.get("ism_manager"): parts.append(f"ISM={data['ism_manager'][:20]}")
        if data.get("p_and_i"): parts.append(f"PI={data['p_and_i'][:25]}")
        if data.get("flag_paris_mou"): parts.append(f"PMou={data['flag_paris_mou']}")
        if data.get("flag_tokyo_mou"): parts.append(f"TMou={data['flag_tokyo_mou']}")
        if data.get("inspections_count"): parts.append(f"Insp={data['inspections_count']}")
        if data.get("last_survey"): parts.append(f"Srv={data['last_survey']}")
        if data.get("equasis_status") and data["equasis_status"] != "active": parts.append(f"S={data['equasis_status']}")

        status = "OK" if field_count > 0 else "--"
        print(f"  {status}  {name[:25]:25} [{field_count:2d}] {' | '.join(parts)}", flush=True)

        time.sleep(DELAY)

    con.close()
    print(f"\nDone: {enriched}/{len(ships)} enriched", flush=True)

    if enriched > 0:
        print("Recalculating valuations...", flush=True)
        import subprocess
        r = subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
                           capture_output=True, text=True, cwd="/opt/bulkwatch")
        print(r.stdout, flush=True)


if __name__ == "__main__":
    main()
