#!/usr/bin/env python3
"""
scrape-fleet-pages.py — Scrapt Flottenseiten der Reedereien und verknüpft Schiffe mit Operatoren.

Strategie:
1. Für jeden Operator mit Website: lade /fleet, /our-fleet, /vessels etc.
2. Extrahiere IMO-Nummern und Schiffsnamen aus dem HTML
3. Matche mit ships.db per IMO oder Name
4. Update das operator-Feld
"""

import sqlite3
import requests
import re
import time
import logging
import sys
import os
from datetime import datetime
from bs4 import BeautifulSoup
from urllib.parse import urljoin

# --- Config ---
DB_PATH = "/opt/bulkwatch/db/ships.db"
LOG_PATH = "/opt/bulkwatch/fleet-scraper.log"
USER_AGENT = "VesselDB/1.0 (BulkWatch fleet enrichment)"
REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 3

FLEET_PATHS = [
    "/fleet",
    "/our-fleet",
    "/vessels",
    "/ships",
    "/fleet-list",
    "/fleet/",
    "/our-fleet/",
    "/vessels/",
    "/en/fleet",
    "/en/our-fleet",
    "/en/vessels",
    "/about/fleet",
    "/about-us/fleet",
    "/about/our-fleet",
    "/services/fleet",
    "/fleet-list/",
    "/our-vessels",
]

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("fleet-scraper")

# --- Session ---
session = requests.Session()
session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
})


def fetch_page(url: str) -> str | None:
    """Fetch a page, return HTML or None on error."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        if resp.status_code == 200:
            return resp.text
        return None
    except Exception as e:
        log.debug(f"  Fetch error {url}: {e}")
        return None


def extract_imos(html: str) -> set[str]:
    """Extract 7-digit IMO numbers from HTML, only when near 'IMO' context."""
    imos = set()
    # Pattern 1: "IMO" followed by optional separator then 7 digits
    for m in re.finditer(r'IMO[\s:.\-#]*(\d{7})\b', html, re.IGNORECASE):
        imos.add(m.group(1))
    # Pattern 2: 7 digits followed by "(IMO)" or similar
    for m in re.finditer(r'\b(\d{7})\s*\(?IMO\)?', html, re.IGNORECASE):
        imos.add(m.group(1))
    return imos


def extract_ship_names(html: str) -> list[str]:
    """
    Extract potential ship names from structured HTML elements.
    Looks in tables, lists, headings, and specific class patterns.
    """
    soup = BeautifulSoup(html, "lxml")
    names = []

    # Remove script/style
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    # Strategy 1: Table cells — often fleet pages use tables
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if cells:
                first_text = cells[0].get_text(strip=True)
                # Ship names: typically uppercase, multiple words, 3-40 chars
                if first_text and 3 <= len(first_text) <= 50:
                    # Check if it looks like a ship name (mostly uppercase or title case)
                    if re.match(r'^[A-Z][A-Za-z0-9\s.\-]+$', first_text):
                        names.append(first_text)

    # Strategy 2: Elements with fleet/vessel/ship related classes or data attributes
    fleet_patterns = re.compile(r'(vessel|ship|fleet|boat)', re.IGNORECASE)
    for el in soup.find_all(attrs={"class": fleet_patterns}):
        text = el.get_text(strip=True)
        if text and 3 <= len(text) <= 50 and '\n' not in text:
            names.append(text)

    # Strategy 3: H2/H3/H4 headings that look like vessel names
    for tag in soup.find_all(["h2", "h3", "h4"]):
        text = tag.get_text(strip=True)
        if text and 3 <= len(text) <= 50:
            if re.match(r'^[A-Z][A-Za-z0-9\s.\-]+$', text):
                names.append(text)

    # Strategy 4: Links with vessel-like text
    for a in soup.find_all("a"):
        href = a.get("href", "")
        if any(kw in href.lower() for kw in ["vessel", "ship", "fleet"]):
            text = a.get_text(strip=True)
            if text and 3 <= len(text) <= 50:
                names.append(text)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for n in names:
        nl = n.upper().strip()
        if nl not in seen:
            seen.add(nl)
            unique.append(n.strip())
    return unique


def match_imos_in_db(db: sqlite3.Connection, imos: set[str], operator_name: str) -> int:
    """Match IMO numbers against DB and update operator. Returns count of updates."""
    if not imos:
        return 0
    updated = 0
    for imo in imos:
        cur = db.execute(
            "SELECT imo, operator FROM ships WHERE imo = ?", (imo,)
        )
        row = cur.fetchone()
        if row:
            current_op = row[1]
            if not current_op or current_op.strip() == "":
                db.execute(
                    "UPDATE ships SET operator = ? WHERE imo = ?",
                    (operator_name, imo),
                )
                updated += 1
                log.info(f"  ✓ IMO {imo} → operator '{operator_name}'")
            elif current_op != operator_name:
                log.debug(f"  IMO {imo} already has operator '{current_op}', skip")
    return updated


def match_names_in_db(db: sqlite3.Connection, names: list[str], operator_name: str) -> int:
    """Match ship names against DB and update operator. Returns count of updates."""
    if not names:
        return 0
    updated = 0
    for name in names:
        # Exact match first (case insensitive)
        cur = db.execute(
            "SELECT imo, name, operator FROM ships WHERE name = ? COLLATE NOCASE AND (operator IS NULL OR operator = '')",
            (name,),
        )
        rows = cur.fetchall()
        if len(rows) == 1:
            imo = rows[0][0]
            db.execute(
                "UPDATE ships SET operator = ? WHERE imo = ?",
                (operator_name, imo),
            )
            updated += 1
            log.info(f"  ✓ Name '{name}' (IMO {imo}) → operator '{operator_name}'")
        elif len(rows) > 1:
            log.debug(f"  Name '{name}' has {len(rows)} matches, skip (ambiguous)")
    return updated


def scrape_operator(db: sqlite3.Connection, operator_name: str, website: str) -> dict:
    """Scrape fleet pages for one operator. Returns stats dict."""
    stats = {"imo_found": 0, "name_found": 0, "imo_matched": 0, "name_matched": 0, "pages_ok": 0, "pages_fail": 0}
    log.info(f"--- {operator_name} ({website}) ---")

    # Normalize base URL
    base = website.rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base

    all_imos = set()
    all_names = []
    pages_html = {}

    # Try each fleet path
    urls_to_try = [base] + [base + p for p in FLEET_PATHS]
    seen_urls = set()

    for url in urls_to_try:
        if url in seen_urls:
            continue
        seen_urls.add(url)

        html = fetch_page(url)
        time.sleep(DELAY_BETWEEN_REQUESTS)

        if html is None:
            stats["pages_fail"] += 1
            continue

        stats["pages_ok"] += 1
        pages_html[url] = html

        # Extract IMOs
        imos = extract_imos(html)
        if imos:
            log.info(f"  Found {len(imos)} IMOs on {url}")
            all_imos.update(imos)

        # Extract names
        names = extract_ship_names(html)
        if names:
            log.info(f"  Found {len(names)} potential ship names on {url}")
            all_names.extend(names)

        # If we found IMOs on a fleet page, no need to try more paths
        if imos and url != base:
            log.info(f"  Fleet page found at {url}, stopping path search")
            break

    stats["imo_found"] = len(all_imos)
    stats["name_found"] = len(set(n.upper() for n in all_names))

    # Match against DB
    imo_matches = match_imos_in_db(db, all_imos, operator_name)
    stats["imo_matched"] = imo_matches

    # Only try name matching if we didn't find many IMOs
    if len(all_imos) < 3 and all_names:
        # Deduplicate names
        unique_names = list(dict.fromkeys(all_names))
        name_matches = match_names_in_db(db, unique_names, operator_name)
        stats["name_matched"] = name_matches

    return stats


def main():
    log.info("=" * 60)
    log.info(f"Fleet Scraper started at {datetime.now().isoformat()}")
    log.info("=" * 60)

    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA busy_timeout=5000")

    # Get operators with websites
    cur = db.execute(
        "SELECT name, website FROM operators WHERE website IS NOT NULL AND website != '' ORDER BY fleet_size DESC"
    )
    operators = cur.fetchall()
    log.info(f"Found {len(operators)} operators with websites")

    # Count ships without operator before
    before = db.execute(
        "SELECT COUNT(*) FROM ships WHERE operator IS NULL OR operator = ''"
    ).fetchone()[0]
    log.info(f"Ships without operator before: {before}")

    total_stats = {
        "operators_scraped": 0,
        "total_imo_found": 0,
        "total_name_found": 0,
        "total_imo_matched": 0,
        "total_name_matched": 0,
        "total_pages_ok": 0,
        "total_pages_fail": 0,
    }

    for op_name, website in operators:
        try:
            stats = scrape_operator(db, op_name, website)
            db.commit()
            total_stats["operators_scraped"] += 1
            total_stats["total_imo_found"] += stats["imo_found"]
            total_stats["total_name_found"] += stats["name_found"]
            total_stats["total_imo_matched"] += stats["imo_matched"]
            total_stats["total_name_matched"] += stats["name_matched"]
            total_stats["total_pages_ok"] += stats["pages_ok"]
            total_stats["total_pages_fail"] += stats["pages_fail"]
        except Exception as e:
            log.error(f"Error scraping {op_name}: {e}")
            db.rollback()
            continue

    # Count ships without operator after
    after = db.execute(
        "SELECT COUNT(*) FROM ships WHERE operator IS NULL OR operator = ''"
    ).fetchone()[0]

    newly_assigned = before - after

    log.info("")
    log.info("=" * 60)
    log.info("RESULTS")
    log.info("=" * 60)
    log.info(f"Operators scraped:      {total_stats['operators_scraped']}/{len(operators)}")
    log.info(f"Pages fetched OK:       {total_stats['total_pages_ok']}")
    log.info(f"Pages failed:           {total_stats['total_pages_fail']}")
    log.info(f"IMO numbers found:      {total_stats['total_imo_found']}")
    log.info(f"Ship names found:       {total_stats['total_name_found']}")
    log.info(f"IMO matches (updated):  {total_stats['total_imo_matched']}")
    log.info(f"Name matches (updated): {total_stats['total_name_matched']}")
    log.info(f"Ships without operator: {before} → {after}")
    log.info(f"Newly assigned:         {newly_assigned}")
    log.info("=" * 60)

    db.close()
    log.info("Done.")


if __name__ == "__main__":
    main()
