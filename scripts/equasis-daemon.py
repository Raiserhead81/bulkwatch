#!/usr/bin/env python3
"""Equasis Enrichment Daemon v9 — round-robin scraping with monitoring.

Equasis enforces a cumulative PAGE DOWNLOAD limit, not a request-rate limit.
Slowing down does not help; only fetching fewer pages does. Each ship costs
PAGES_PER_SHIP page views (Search + ShipInfo), so the budget is counted in
pages, not ships.

Two distinct block types, never conflate them:
  rate_locked — "page download limit reached ... locked for 7 days"
                clears by itself after lock_until.
  blocked     — "your account is blocked" / "password has expired"
                NEVER clears by itself; needs a manual Lost-password reset.

Lock state is persisted to STATE_FILE so restarts do not re-attempt logins
against blocked accounts (failed logins are what triggers `blocked`).
"""
import sqlite3, urllib.request, urllib.parse, http.cookiejar, ssl, re, time, sys, signal, json, os
from datetime import datetime, timedelta

DB = "/opt/bulkwatch/db/ships.db"
STATUS_FILE = "/opt/bulkwatch/equasis-status.json"
STATE_FILE = "/opt/bulkwatch/equasis-state.json"
DELAY_BETWEEN_REQUESTS = 30  # seconds between each request (shared across all accounts)
RESCRAPE_DAYS = 14
LOG_EVERY = 10  # print progress every N ships
PAGES_PER_SHIP = 2  # Search + ShipInfo — both count against Equasis' page budget
DAILY_PAGE_LIMIT = 100  # max page views per account per day (= 50 ships)

ACCOUNTS_FILE = "/opt/bulkwatch/config/equasis-accounts.json"


def classify_block(html):
    """Return 'rate_locked', 'blocked' or None. Never substring-match "locked":
    it also matches "blocked", which is a completely different failure."""
    low = html.lower()
    if "page download limit" in low:
        return "rate_locked"
    if "account is blocked" in low or "password has expired" in low:
        return "blocked"
    return None

def load_accounts():
    """Load accounts from JSON config file. Exit if not found."""
    if not os.path.exists(ACCOUNTS_FILE):
        sys.exit(f"ERROR: {ACCOUNTS_FILE} not found. Cannot start without credentials.")
    try:
        with open(ACCOUNTS_FILE) as f:
            data = json.load(f)
        accts = [(a["email"], a["password"]) for a in data.get("accounts", [])]
        if not accts:
            sys.exit(f"ERROR: No accounts found in {ACCOUNTS_FILE}")
        print(f"Loaded {len(accts)} accounts from {ACCOUNTS_FILE}")
        return accts
    except Exception as e:
        sys.exit(f"ERROR: Failed to load {ACCOUNTS_FILE}: {e}")

ACCOUNTS = load_accounts()

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


def nap(seconds):
    """Sleep in short slices, abortable via SIGTERM.

    Plain time.sleep() resumes after a signal handler returns (PEP 475), so a
    daemon parked in sleep(7200) ignores `systemctl stop` until systemd SIGKILLs
    it — which loses the in-memory page counter. Poll `running` instead.
    """
    deadline = time.time() + seconds
    while running and time.time() < deadline:
        time.sleep(max(0.0, min(2.0, deadline - time.time())))


class EquasisSession:
    """Persistent session for one Equasis account with SSL and daily page budget."""
    def __init__(self, email, password):
        self.email = email
        self.password = password
        self.opener = None
        self.locked = False        # rate_locked: clears after lock_until
        self.lock_until = None
        self.blocked = False       # needs manual password reset, never self-clears
        self.consecutive_fails = 0
        self.pages_today = 0
        self.daily_date = datetime.now().strftime("%Y-%m-%d")
        self.total_enriched = 0
        self.total_errors = 0

    @property
    def short(self):
        return self.email.split("@")[0]

    def _reset_daily(self):
        today = datetime.now().strftime("%Y-%m-%d")
        if self.daily_date != today:
            self.pages_today = 0
            self.daily_date = today

    def _apply_block(self, kind):
        """Record a block. Returns True if this is a state change."""
        if kind == "blocked":
            if self.blocked:
                return False
            self.blocked = True
            self.opener = None
            print(f"  ⛔ BLOCKED: {self.email} — Passwort abgelaufen / zu viele Fehl-Logins. "
                  f"Manueller Reset via 'Lost password' nötig!", flush=True)
            return True
        if kind == "rate_locked":
            if self.locked:
                return False
            self.locked = True
            self.lock_until = datetime.now() + timedelta(days=7)
            self.opener = None
            print(f"  ⚠ RATE-LOCK: {self.email} — Page-Download-Limit, 7 Tage Sperre "
                  f"(bis {self.lock_until:%Y-%m-%d})", flush=True)
            return True
        return False

    def login(self):
        """Create fresh session with SSL and login. Never call on a blocked account."""
        if self.blocked:
            return False
        ctx = ssl.create_default_context()
        cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cj),
            urllib.request.HTTPSHandler(context=ctx)
        )
        self.opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]
        try:
            self.opener.open("https://www.equasis.org/EquasisWeb/public/HomePage", timeout=30)
            data = urllib.parse.urlencode({"j_email": self.email, "j_password": self.password}).encode()
            r = self.opener.open("https://www.equasis.org/EquasisWeb/authen/HomePage?fs=HomePage", data, timeout=30)
            html = r.read().decode("utf-8", errors="ignore")
            kind = classify_block(html)
            if kind:
                self._apply_block(kind)
                self.opener = None
                return False
            self.locked = False
            self.consecutive_fails = 0
            return True
        except Exception as e:
            print(f"  Login failed ({self.email}): {e}", flush=True)
            self.opener = None
            self._last_login_error = str(e)
            return False

    def is_available(self):
        self._reset_daily()
        if self.blocked:
            return False
        if self.locked:
            if self.lock_until and datetime.now() > self.lock_until:
                self.locked = False
            else:
                return False
        if self.pages_today + PAGES_PER_SHIP > DAILY_PAGE_LIMIT:
            return False
        return True

    def scrape(self, imo):
        """Scrape one ship. Returns dict or None."""
        if not self.opener:
            if not self.login():
                return None

        self._reset_daily()
        # Both requests below are page views and count against Equasis' budget.
        self.pages_today += PAGES_PER_SHIP
        result = {}
        try:
            # Search
            sd = urllib.parse.urlencode({"P_ENTREE_HOME": str(imo)}).encode()
            self.opener.open("https://www.equasis.org/EquasisWeb/restricted/Search?fs=HomePage", sd, timeout=20)

            # Detail
            dd = urllib.parse.urlencode({"P_IMO": str(imo)}).encode()
            r = self.opener.open("https://www.equasis.org/EquasisWeb/restricted/ShipInfo?fs=Search", dd, timeout=20)
            html = r.read().decode("utf-8", errors="ignore")

            kind = classify_block(html)
            if kind:
                self._apply_block(kind)
                return {"_error": True}

            if "CtrlGeneralError" in html or len(html) < 5000:
                self.consecutive_fails += 1
                self.total_errors += 1
                err_detail = "CtrlGeneralError" if "CtrlGeneralError" in html else f"short_response({len(html)})"
                print(f"  ERR {self.short}: IMO {imo} — {err_detail} (fails: {self.consecutive_fails})", flush=True)
                if self.consecutive_fails >= 3:
                    print(f"  → Re-login {self.short}...", flush=True)
                    self.opener = None
                    self.consecutive_fails = 0
                    if not self.login():
                        print(f"  → Re-login FAILED", flush=True)
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

            # Detention %
            m = re.search(r"([\d.]+)%\s*Of inspections.*?detention", html, re.DOTALL|re.I)
            if m:
                try: result["detention_pct"] = float(m.group(1))
                except: pass

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
            self.total_errors += 1
            print(f"  ERR {self.short}: IMO {imo} — HTTP {e.code}", flush=True)
            if e.code == 429:
                self._apply_block("rate_locked")
            elif e.code in (404, 403):
                return {"_error": True}
        except Exception as e:
            self.total_errors += 1
            print(f"  ERR {self.short}: IMO {imo} — {type(e).__name__}: {e}", flush=True)

        # Sanity check
        real_fields = [k for k in result if k not in ("classification", "equasis_status", "flag_paris_mou", "flag_tokyo_mou")]
        if len(real_fields) == 0 and "classification" in result:
            return {"_error": True}

        return result


def get_next_ship(con, cutoff):
    """Get next ship to scrape. Prioritizes: 1) never scraped + no year_built, 
    2) never scraped, 3) needs re-scrape + no year_built, 4) needs re-scrape."""
    return con.execute("""
        SELECT imo, name, dwt FROM ships
        WHERE imo NOT LIKE 'cat-%'
        AND (equasis_last_scraped IS NULL OR equasis_last_scraped < ?)
        ORDER BY
            CASE 
                WHEN equasis_last_scraped IS NULL AND (year_built IS NULL OR year_built = 0) THEN 0
                WHEN equasis_last_scraped IS NULL THEN 1
                WHEN year_built IS NULL OR year_built = 0 THEN 2
                ELSE 3
            END,
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
        "detention_pct": "detention_pct = ?",
        "owner": "owner = ?",
        "manager": "manager = ?",
        "ism_manager": "ism_manager = ?",
    }

    for key, sql in field_map.items():
        val = data.get(key)
        if val is not None:
            if key == "dwt" and val > 0 and dwt not in DEFAULT_DWTS:
                continue
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
    return len(updates) - 1


def save_state(sessions):
    """Persist lock/block state so a restart does not re-attempt logins.
    Failed logins against a locked account are what escalates it to `blocked`."""
    state = {}
    for s in sessions:
        state[s.email] = {
            "locked": s.locked,
            "lock_until": s.lock_until.isoformat() if s.lock_until else None,
            "blocked": s.blocked,
            "pages_today": s.pages_today,
            "daily_date": s.daily_date,
        }
    try:
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
        os.replace(tmp, STATE_FILE)
    except Exception as e:
        print(f"  WARN: could not write {STATE_FILE}: {e}", flush=True)


def load_state(sessions):
    """Restore lock/block state from disk."""
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE) as f:
            state = json.load(f)
    except Exception as e:
        print(f"  WARN: could not read {STATE_FILE}: {e}", flush=True)
        return
    today = datetime.now().strftime("%Y-%m-%d")
    for s in sessions:
        st = state.get(s.email)
        if not st:
            continue
        s.blocked = st.get("blocked", False)
        s.locked = st.get("locked", False)
        lu = st.get("lock_until")
        s.lock_until = datetime.fromisoformat(lu) if lu else None
        # Only carry the page budget over within the same calendar day.
        if st.get("daily_date") == today:
            s.pages_today = st.get("pages_today", 0)
            s.daily_date = today
        if s.locked and s.lock_until and datetime.now() > s.lock_until:
            s.locked = False
            s.lock_until = None
            print(f"  Lock abgelaufen: {s.short}", flush=True)


def write_status(sessions, enriched, errors, start_time):
    """Write JSON status file for external monitoring."""
    elapsed = (time.time() - start_time) / 3600
    rate = enriched / elapsed if elapsed > 0.01 else 0
    status = {
        "daemon": "running",
        "started": datetime.fromtimestamp(start_time).strftime("%Y-%m-%d %H:%M"),
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "enriched": enriched,
        "errors": errors,
        "rate_per_hour": round(rate, 1),
        "runtime_hours": round(elapsed, 2),
        "accounts": []
    }
    for s in sessions:
        if s.blocked:
            st = "blocked"
        elif s.locked:
            st = "rate_locked"
        elif s.pages_today + PAGES_PER_SHIP > DAILY_PAGE_LIMIT:
            st = "limit"
        else:
            st = "active"
        status["accounts"].append({
            "email": s.email,
            "status": st,
            "lock_until": s.lock_until.strftime("%Y-%m-%d %H:%M") if s.lock_until else None,
            "needs_password_reset": s.blocked,
            "pages_today": s.pages_today,
            "daily_page_limit": DAILY_PAGE_LIMIT,
            "enriched": s.total_enriched,
            "errors": s.total_errors,
            "consecutive_fails": s.consecutive_fails,
        })
    try:
        with open(STATUS_FILE, "w") as f:
            json.dump(status, f, indent=2)
    except Exception:
        pass


def main():
    print(f"Equasis Daemon v9 started — {datetime.now().strftime('%Y-%m-%d %H:%M')}", flush=True)
    print(f"Accounts: {len(ACCOUNTS)}, Delay: {DELAY_BETWEEN_REQUESTS}s, "
          f"Budget: {DAILY_PAGE_LIMIT} pages/account/day (= {DAILY_PAGE_LIMIT // PAGES_PER_SHIP} ships)", flush=True)

    sessions = [EquasisSession(email, pw) for email, pw in ACCOUNTS]

    # Restore persisted locks BEFORE any login attempt.
    load_state(sessions)
    for s in sessions:
        if s.blocked:
            print(f"  ⛔ BLOCKED (persistiert): {s.email} — braucht Passwort-Reset, kein Login-Versuch", flush=True)
        elif s.locked:
            print(f"  ⚠ RATE-LOCK (persistiert): {s.email} — bis {s.lock_until:%Y-%m-%d %H:%M}, kein Login-Versuch", flush=True)

    # Login with retry for temporary errors (503, timeouts).
    # Skip locked/blocked accounts entirely — failed logins escalate to `blocked`.
    for attempt in range(3):
        pending = [s for s in sessions if s.is_available() and s.opener is None]
        if not pending:
            break
        if attempt > 0:
            print(f"  Retry {attempt}/2 in 60s...", flush=True)
            nap(60)
        for s in pending:
            if s.login():
                print(f"  OK: {s.email}", flush=True)
            elif s.blocked or s.locked:
                pass  # already reported by _apply_block
            else:
                err = getattr(s, '_last_login_error', 'unknown')
                print(f"  TEMP-FAIL: {s.email} ({err})", flush=True)
    save_state(sessions)

    if not any(s.is_available() for s in sessions):
        blocked = [s.short for s in sessions if s.blocked]
        if blocked and len(blocked) == len(sessions):
            print(f"\nAlle Accounts BLOCKED ({', '.join(blocked)}). Passwort-Reset nötig — "
                  f"Warten hilft nicht. Daemon beendet sich.", flush=True)
            write_status(sessions, 0, 0, time.time())
            return

    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    cutoff = (datetime.now() - timedelta(days=RESCRAPE_DAYS)).strftime("%Y-%m-%d")

    enriched = 0
    errors = 0
    consecutive_errors = 0
    account_idx = 0
    start_time = time.time()
    last_status_write = 0

    while running:
        # Write status every 60s
        now = time.time()
        if now - last_status_write > 60:
            write_status(sessions, enriched, errors, start_time)
            save_state(sessions)  # survive SIGKILL without losing the page budget
            last_status_write = now

        # Reset daily page budget at midnight
        today = datetime.now().strftime("%Y-%m-%d")
        for s in sessions:
            if s.daily_date != today:
                old = s.pages_today
                s.pages_today = 0
                s.daily_date = today
                if old > 0:
                    print(f"  Tages-Reset: {s.short} ({old} Seiten gestern)", flush=True)
                save_state(sessions)

        # Get next ship
        ship = get_next_ship(con, cutoff)
        if not ship:
            print("No more ships to scrape. Sleeping 1h...", flush=True)
            nap(3600)
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
            save_state(sessions)
            blocked = [s for s in sessions if s.blocked]
            locked = [s for s in sessions if s.locked and not s.blocked]
            at_limit = [s for s in sessions if not s.blocked and not s.locked
                        and s.pages_today + PAGES_PER_SHIP > DAILY_PAGE_LIMIT]

            if len(blocked) == len(sessions):
                print(f"  ⛔ Alle {len(blocked)} Accounts BLOCKED — Passwort-Reset nötig. "
                      f"Warten bringt nichts, Daemon beendet sich.", flush=True)
                write_status(sessions, enriched, errors, start_time)
                break

            if at_limit and not locked:
                # All at daily page budget — wait until midnight
                now_dt = datetime.now()
                tomorrow = (now_dt + timedelta(days=1)).replace(hour=0, minute=5, second=0)
                wait = (tomorrow - now_dt).total_seconds()
                print(f"  Alle Accounts am Tages-Seitenbudget ({DAILY_PAGE_LIMIT}). "
                      f"Pause bis Mitternacht ({wait/3600:.1f}h)...", flush=True)
                write_status(sessions, enriched, errors, start_time)
                nap(min(wait, 7200))
            elif locked:
                nxt = min(s.lock_until for s in locked if s.lock_until)
                print(f"  Alle verfügbaren Accounts rate-locked ({len(locked)} locked, "
                      f"{len(blocked)} blocked). Nächster frei: {nxt:%Y-%m-%d %H:%M}. Sleeping 2h...", flush=True)
                nap(7200)
            else:
                print(f"  Kein Account verfügbar ({len(blocked)} blocked, rest temp-fail). Retry in 5min...", flush=True)
                nap(300)

            # Re-login ONLY accounts whose lock genuinely expired. Never clear
            # `blocked` here — it only clears via a manual password reset.
            for s in sessions:
                if s.locked and s.lock_until and datetime.now() > s.lock_until:
                    s.locked = False
                    s.lock_until = None
                    print(f"  Lock abgelaufen: {s.short}", flush=True)
                if s.is_available() and s.opener is None:
                    if s.login():
                        print(f"  Back online: {s.email}", flush=True)
            save_state(sessions)
            continue

        # Scrape
        data = session.scrape(imo)

        if data and "_error" not in data and len(data) > 0:
            fields = update_ship(con, imo, dwt, data)
            enriched += 1
            session.total_enriched += 1
            consecutive_errors = 0

            # Quality monitor every 50 ships
            if enriched % 50 == 0 and enriched > 0:
                bad = con.execute("""SELECT COUNT(*) FROM ships
                    WHERE equasis_last_scraped = ?
                    AND classification IS NOT NULL
                    AND owner IS NULL AND manager IS NULL AND mmsi IS NULL
                    AND dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
                """, (today,)).fetchone()[0]
                if bad > 0:
                    con.execute("""UPDATE ships SET classification = NULL, equasis_last_scraped = NULL
                        WHERE equasis_last_scraped = ?
                        AND classification IS NOT NULL
                        AND owner IS NULL AND manager IS NULL AND mmsi IS NULL
                        AND dwt IN (0,5000,10000,12000,15000,18000,20000,45000,46000,47000,50000,55000)
                    """, (today,))
                    con.commit()
                    print(f"  ⚠ QUALITY CHECK: {bad} fake records reset", flush=True)
                    for s in sessions:
                        s.opener = None
                        s.consecutive_fails = 0
                    print(f"  ⚠ All sessions re-login...", flush=True)
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
                print(f"  [{enriched:4d}] {name[:22]:22} [{fields:2d}] {' | '.join(parts[:4])}  "
                      f"({rate:.0f}/h via {session.short}, {session.pages_today}/{DAILY_PAGE_LIMIT} Seiten)", flush=True)
        else:
            errors += 1
            consecutive_errors += 1
            if consecutive_errors >= 10:
                save_state(sessions)
                available = [s for s in sessions if s.is_available()]
                if not available:
                    print(f"  10+ Errors, kein Account verfügbar. Sleeping 2h...", flush=True)
                    nap(7200)
                    # Drop stale sessions, but never resurrect a lock/block:
                    # is_available() decides who may log in again.
                    for s in sessions:
                        s.opener = None
                    for s in sessions:
                        if s.is_available() and s.login():
                            print(f"  Back online: {s.email}", flush=True)
                else:
                    for s in available:
                        s.opener = None
                consecutive_errors = 0

        # Fixed delay between every request
        nap(DELAY_BETWEEN_REQUESTS)

    # Shutdown
    write_status(sessions, enriched, errors, start_time)
    save_state(sessions)
    elapsed = (time.time() - start_time) / 3600
    print(f"\nDaemon stopped. Enriched: {enriched}, Errors: {errors}, Runtime: {elapsed:.1f}h", flush=True)

    if enriched > 0:
        print("Recalculating valuations...", flush=True)
        import subprocess
        r = subprocess.run(["python3", "/opt/bulkwatch/scripts/daily-valuations.py"],
                           capture_output=True, text=True, cwd="/opt/bulkwatch")
        print(r.stdout, flush=True)

    con.close()

if __name__ == "__main__":
    main()
