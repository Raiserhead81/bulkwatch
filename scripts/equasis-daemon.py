#!/usr/bin/env python3
"""Equasis Enrichment Daemon v7 — continuous round-robin scraping.
Rotates through 3 accounts: 1 request per account, 10s pause per cycle.
Each account gets ~1 request every 30 seconds. Runs 24/7 as systemd service.
"""
import sqlite3, urllib.request, urllib.parse, http.cookiejar, re, time, sys, signal
from datetime import datetime, timedelta

DB = "/opt/bulkwatch/db/ships.db"
DELAY_PER_CYCLE = 10  # seconds between each 3-request cycle
RESCRAPE_DAYS = 14
LOG_EVERY = 10  # print progress every N ships

ACCOUNTS = [
    ("kayconrad@posteo.de", "!nfinitY!981"),
    ("kayconrad81@googlemail.com", "!nfinitY!981"),
    ("kpoffen@proton.me", "!nfinitY!981"),
    ("apmoeller1@proton.me", "!nfinitY!981"),
]

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
DEFAULT_DWTS = {0, 5000, 10000, 12000, 15000, 18000, 20000, 45000, 46000, 47000, 50000, 55000}

running = True
def handle_signal(sig, frame):
    global running
    print(f"\nShutdown signal received, finishing current ship...", flush=True)
    running = False
signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


class EquasisSession:
    """Persistent session for one Equasis account."""
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.opener = None
        self.locked = False
        self.lock_until = None
        self.consecutive_fails = 0
    
    def login(self):
        """Create fresh session and login."""
        cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
        self.opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
        try:
            self.opener.open("https://www.equasis.org/EquasisWeb/public/HomePage", timeout=30)
            data = urllib.parse.urlencode({"j_email": self.email, "j_password": self.password}).encode()
            r = self.opener.open("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage", data, timeout=30)
            html = r.read().decode("utf-8", errors="ignore")
            if "locked" in html.lower():
                self.locked = True
                self.lock_until = datetime.now() + timedelta(hours=6)
                return False
            self.locked = False
            self.consecutive_fails = 0
            return True
        except Exception as e:
            print(f"  Login failed ({self.email}): {e}", flush=True)
            return False
    
    def is_available(self):
        if not self.locked:
            return True
        if self.lock_until and datetime.now() > self.lock_until:
            self.locked = False
            return True
        return False
    
    def scrape(self, imo):
        """Scrape one ship. Returns dict or None."""
        if not self.opener:
            if not self.login():
                return None
        
        result = {}
        try:
            # Search
            sd = urllib.parse.urlencode({"P_ENTREE_HOME": str(imo)}).encode()
            self.opener.open("https://www.equasis.org/EquasisWeb/restricted/Search?fs=HomePage", sd, timeout=20)
            
            # Detail
            dd = urllib.parse.urlencode({"P_IMO": str(imo)}).encode()
            r = self.opener.open("https://www.equasis.org/EquasisWeb/restricted/ShipInfo?fs=Search", dd, timeout=20)
            html = r.read().decode("utf-8", errors="ignore")
            
            if "CtrlGeneralError" in html or len(html) < 5000:
                self.consecutive_fails += 1
                if self.consecutive_fails >= 2:
                    self.opener = None  # force re-login next time
                    self.consecutive_fails = 0
                return {"_error": True}
            
            self.consecutive_fails = 0
            
            # Extract fields
            def ef(label):
                m = re.search(label + r'\s*</b>.*?<div[^>]*class="col-[^"]*"[^>]*>\s*([^<\r\n]+)', html, re.DOTALL | re.I)
                return m.group(1).strip() if m else None
            
            v = ef("DWT")
            if v and v.replace(",","").isdigit(): result["dwt"] = int(v.replace(",",""))
            v = ef("Gross tonnage")
            if v and v.replace(",","").isdigit(): result["gross_tonnage"] = int(v.replace(",",""))
            v = ef("Year of build")
            if v and v.strip().isdigit(): result["year_built"] = int(v)
            v = ef("Type of ship")
            if v and len(v)>2: result["type"] = v[:50]
            v = ef("Flag")
            if v and len(v)>1:
                flag = re.sub(r"\s*\([A-Z]+\)\s*$","",v).strip().replace("&nbsp;","").replace("\xa0","").strip()
                if flag: result["flag"] = flag
            v = ef("MMSI")
            if v and re.match(r"\d{9}$",v.strip()): result["mmsi"] = v.strip()
            v = ef("Call Sign")
            if v and re.match(r"[A-Z0-9]{3,10}$",v.strip()): result["call_sign"] = v.strip()
            v = ef("Status")
            if v:
                for key in STATUS_MAP:
                    if key.lower() in v.lower():
                        result["equasis_status"] = STATUS_MAP[key]; break
            
            # Classification
            cs = html.find("Classification")
            ce = html.find("Surveys", cs+20) if cs>0 else -1
            section = html[cs:ce] if cs>0 and ce>0 else html
            for cls in CLASS_NAMES:
                if cls in section: result["classification"] = cls; break
            
            # MOU
            m = re.search(r'Paris MOU.*?(White|Grey|Black)', html, re.DOTALL|re.I)
            if m: result["flag_paris_mou"] = m.group(1).capitalize()
            m = re.search(r'Tokyo MOU.*?(White|Grey|Black)', html, re.DOTALL|re.I)
            if m: result["flag_tokyo_mou"] = m.group(1).capitalize()
            
            # Inspections
            m = re.search(r'Inspections\s*\((\d+)\)', html)
            if m: result["inspections_count"] = int(m.group(1))
            
            # Surveys
            m = re.search(r'Last renewal survey[^<]*?(\d{4}-\d{2}-\d{2})', html, re.DOTALL|re.I)
            if m: result["last_survey"] = m.group(1)
            m = re.search(r'Next renewal survey[^<]*?(\d{4}-\d{2}-\d{2})', html, re.DOTALL|re.I)
            if m: result["next_survey"] = m.group(1)
            
            # P&I
            pi_start = html.find("P&amp;I Information")
            if pi_start<0: pi_start = html.find("P&I Information")
            if pi_start>0:
                pi_end = html.find("Geographical", pi_start)
                if pi_end<0: pi_end = pi_start+2000
                pi_sec = re.sub(r"<a[^>]*>|</a>","", html[pi_start:pi_end])
                pi_text = re.sub(r"<[^>]+>","\n", pi_sec)
                clubs = []
                for line in pi_text.split("\n"):
                    line = line.strip()
                    if (len(line)>5 and "P&I" not in line and "P&amp;I" not in line
                        and "Inception" not in line and "Geographical" not in line
                        and "Information" not in line and not line.startswith("20")
                        and not line.startswith("<") and "href" not in line
                        and "modal" not in line):
                        cl = re.sub(r"<[^>]+>","",line).strip()
                        if cl and len(cl)>3: clubs.append(cl[:60])
                if clubs: result["p_and_i"] = "; ".join(clubs[:3])
            
            # Management
            mgmt_start = html.find("Management detail")
            mgmt_end = html.find("Classification", mgmt_start+20) if mgmt_start>0 else -1
            mgmt = html[mgmt_start:mgmt_end] if mgmt_start>0 and mgmt_end>0 else ""
            if mgmt:
                def er(role, sec):
                    m = re.search(role+r'\s*</td>\s*<td[^>]*>\s*(.*?)\s*</td>', sec, re.DOTALL|re.I)
                    if m:
                        v = re.sub(r'<[^>]+>',' ',m.group(1)).strip()
                        v = re.sub(r'\s+',' ',v).strip()
                        return v[:100] if v and len(v)>2 else None
                    return None
                result["owner"] = er("Registered owner", mgmt)
                result["manager"] = er("Ship manager", mgmt) or er("Commercial manager", mgmt) or er("manager", mgmt)
                result["ism_manager"] = er("ISM Manager", mgmt)
        
        except urllib.error.HTTPError as e:
            if e.code == 429:
                self.locked = True
                self.lock_until = datetime.now() + timedelta(hours=6)
            elif e.code in (404,403):
                return {"_error": True}
        except Exception:
            pass
        
        # Sanity check: if we only got classification and nothing else,
        # it is a fake match from the error page dropdown
        real_fields = [k for k in result if k not in ("classification", "equasis_status", "flag_paris_mou", "flag_tokyo_mou")]
        if len(real_fields) == 0 and "classification" in result:
            return {"_error": True}
        
        return result


def get_next_ship(con, cutoff):
    """Get next ship to scrape."""
    return con.execute("""
        SELECT imo, name, dwt FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (equasis_last_scraped IS NULL OR equasis_last_scraped < ?)
        ORDER BY
            CASE WHEN equasis_last_scraped IS NULL THEN 0 ELSE 1 END,
            RANDOM()
        LIMIT 1
    """, (cutoff,)).fetchone()


def update_ship(con, imo, dwt, data):
    """Write scraped data to DB."""
    updates = []
    params = []
    
    field_map = {
        "gross_tonnage": "gross_tonnage = ?",
        "dwt": "dwt = ?",
        "year_built": "year_built = ?",
        "flag": "flag = ?",
        "type": "type = ?",
        "mmsi": "mmsi = ?",
        "call_sign": "call_sign = ?",
        "classification": "classification = ?",
        "p_and_i": "p_and_i = ?",
        "flag_paris_mou": "flag_paris_mou = ?",
        "flag_tokyo_mou": "flag_tokyo_mou = ?",
        "inspections_count": "inspections_count = ?",
        "last_survey": "last_survey = ?",
        "next_survey": "next_survey = ?",
        "equasis_status": "status = ?",
        "owner": "owner = ?",
        "manager": "manager = ?",
        "ism_manager": "ism_manager = ?",
    }
    
    for key, sql in field_map.items():
        val = data.get(key)
        if val is not None:
            if key == "dwt" and val > 0 and dwt not in DEFAULT_DWTS:
                continue  # don't overwrite good DWT
            if key == "dwt" and val <= 0:
                continue
            updates.append(sql)
            params.append(val)
    
    if data.get("ism_manager"):
        cur = con.execute("SELECT operator FROM ships WHERE imo=?", (imo,)).fetchone()
        if cur and (not cur[0] or cur[0] == ""):
            updates.append("operator = ?")
            params.append(data["ism_manager"])
    
    updates.append("equasis_last_scraped = ?")
    params.append(datetime.now().strftime("%Y-%m-%d"))
    params.append(imo)
    
    con.execute(f"UPDATE ships SET {', '.join(updates)} WHERE imo = ?", params)
    con.commit()
    return len(updates) - 1  # minus the timestamp


def main():
    print(f"Equasis Daemon v7 started — {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print(f"Accounts: {len(ACCOUNTS)}, Delay: {DELAY_PER_CYCLE}s per cycle", flush=True)
    
    # Create sessions
    sessions = [EquasisSession(email, pw) for email, pw in ACCOUNTS]
    
    # Login all
    for s in sessions:
        if s.login():
            print(f"  Logged in: {s.email}", flush=True)
        else:
            print(f"  LOCKED: {s.email}", flush=True)
    
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cutoff = (datetime.now() - timedelta(days=RESCRAPE_DAYS)).strftime("%Y-%m-%d")
    
    enriched = 0
    errors = 0
    cycle = 0
    account_idx = 0
    start_time = time.time()
    
    while running:
        # Get next ship
        ship = get_next_ship(con, cutoff)
        if not ship:
            print("No more ships to scrape. Sleeping 1h...", flush=True)
            time.sleep(3600)
            cutoff = (datetime.now() - timedelta(days=RESCRAPE_DAYS)).strftime("%Y-%m-%d")
            continue
        
        imo, name, dwt = ship
        
        # Find available account (round-robin)
        session = None
        for _ in range(len(sessions)):
            s = sessions[account_idx % len(sessions)]
            account_idx += 1
            if s.is_available():
                session = s
                break
        
        if not session:
            # All locked — wait and retry
            print("All accounts locked. Waiting 30min...", flush=True)
            time.sleep(1800)
            for s in sessions:
                s.locked = False
                s.opener = None
            continue
        
        # Scrape
        data = session.scrape(imo)
        
        if data and "_error" not in data and len(data) > 0:
            fields = update_ship(con, imo, dwt, data)
            enriched += 1
            
            # Quality monitor every 50 ships
            if enriched % 50 == 0 and enriched > 0:
                bad = con.execute("""SELECT COUNT(*) FROM ships 
                    WHERE equasis_last_scraped = ? 
                    AND classification IS NOT NULL 
                    AND owner IS NULL AND manager IS NULL AND mmsi IS NULL
                    AND dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
                """, (datetime.now().strftime("%Y-%m-%d"),)).fetchone()[0]
                if bad > 0:
                    # Auto-repair: reset bad records
                    con.execute("""UPDATE ships SET classification = NULL, equasis_last_scraped = NULL
                        WHERE equasis_last_scraped = ?
                        AND classification IS NOT NULL
                        AND owner IS NULL AND manager IS NULL AND mmsi IS NULL
                        AND dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
                    """, (datetime.now().strftime("%Y-%m-%d"),))
                    con.commit()
                    print(f"  ⚠ QUALITY CHECK: {bad} fake records detected and reset", flush=True)
                    # Force re-login all sessions
                    for s in sessions:
                        s.opener = None
                        s.consecutive_fails = 0
                    print(f"  ⚠ All sessions reset — re-logging in...", flush=True)
                    for s in sessions:
                        if s.is_available():
                            s.login()

            if enriched % LOG_EVERY == 0 or enriched <= 3:
                parts = []
                if data.get("dwt"): parts.append(f"DWT={data['dwt']}")
                if data.get("classification"): parts.append(f"C={data['classification'][:12]}")
                if data.get("owner"): parts.append(f"O={data['owner'][:20]}")
                elapsed = (time.time() - start_time) / 3600
                rate = enriched / elapsed if elapsed > 0 else 0
                print(f"  [{enriched:4d}] {name[:22]:22} [{fields:2d}] {' | '.join(parts[:4])}  ({rate:.0f}/h via {session.email.split('@')[0]})", flush=True)
        else:
            errors += 1
            # Force re-login on the session that failed
            session.consecutive_fails += 1
            if session.consecutive_fails >= 3:
                session.opener = None
                session.consecutive_fails = 0
        
        # Pause after every 3rd request (one full rotation)
        cycle += 1
        if cycle % len(sessions) == 0:
            time.sleep(DELAY_PER_CYCLE)
        else:
            time.sleep(2)  # small pause between accounts
    
    # Shutdown
    elapsed = (time.time() - start_time) / 3600
    print(f"\nDaemon stopped. Enriched: {enriched}, Errors: {errors}, Runtime: {elapsed:.1f}h", flush=True)
    
    # Recalculate valuations
    if enriched > 0:
        print("Recalculating valuations...", flush=True)
        import subprocess
        r = subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
                           capture_output=True, text=True, cwd="/opt/bulkwatch")
        print(r.stdout, flush=True)
    
    con.close()

if __name__ == "__main__":
    main()
