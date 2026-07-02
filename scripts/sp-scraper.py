#!/usr/bin/env python3
"""S&P Transaction Scraper v1 — collects real vessel sale prices from public sources.
Sources: Shipping Herald RSS, Frontline RSS, Scorpio Tankers RSS, SEC EDGAR 6-K filings.
Cron: 0 8 * * * (daily at 08:00 UTC)"""

import sqlite3, re, time, json, urllib.request, urllib.parse
from xml.etree import ElementTree as ET
from datetime import datetime

DB = "/opt/bulkwatch/db/ships.db"
USER_AGENT = "Mozilla/5.0 (compatible; BulkWatch/1.0; ship-research)"

# Ship type patterns for classification
TYPE_PATTERNS = [
    (r'\bVLCC\b', "VLCC"), (r'\bSuezmax\b', "Suezmax"), (r'\bAframax\b', "Aframax"),
    (r'\bLR2\b', "Aframax"), (r'\bLR1\b', "Product Tanker"), (r'\bMR2?\b', "Product Tanker"),
    (r'\bProduct\s+tanker\b', "Product Tanker", re.I), (r'\bChemical\s+tanker\b', "Chemical Tanker", re.I),
    (r'\bCapesize\b', "Capesize", re.I), (r'\bNewcastlemax\b', "Capesize", re.I),
    (r'\bKamsarmax\b', "Kamsarmax", re.I), (r'\bPanamax\b', "Panamax", re.I),
    (r'\bUltramax\b', "Bulk Carrier", re.I), (r'\bSupramax\b', "Handymax", re.I),
    (r'\bHandysize\b', "Handysize", re.I), (r'\bHandymax\b', "Handymax", re.I),
    (r'\bbulk\s*carrier\b', "Bulk Carrier", re.I), (r'\bbulker\b', "Bulk Carrier", re.I),
    (r'\btanker\b', "Tanker", re.I), (r'\bcontainer\s*ship\b', "Container Ship", re.I),
    (r'\bVLGC\b', "LPG Tanker"), (r'\bLNG\b', "LNG Tanker"),
    (r'\bRo-?Ro\b', "RoRo", re.I), (r'\bcar\s+carrier\b', "Car Carrier", re.I),
]

def classify_type(text):
    for pattern in TYPE_PATTERNS:
        flags = pattern[2] if len(pattern) > 2 else 0
        if re.search(pattern[0], text, flags):
            return pattern[1]
    return None

def fetch_url(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"  Fetch error {url}: {e}")
        return None

def parse_price(text):
    """Extract USD price from text. Returns price in USD or None."""
    # Patterns: $41.9M, $41.9 million, USD 41.9M, $831.5M, $122M
    patterns = [
        r'\$\s*([\d,.]+)\s*(?:million|mln|mil|m)\b',
        r'USD\s*([\d,.]+)\s*(?:million|mln|mil|m)\b',
        r'\$\s*([\d,.]+)\s*M\b',
        r'USD\s*([\d,.]+)\s*M\b',
        r'\$([\d,.]+)\s*bn\b',
        r'USD\s*([\d,.]+)\s*bn\b',
    ]
    for p in patterns:
        for m in re.finditer(p, text, re.I):
            val = float(m.group(1).replace(",", ""))
            if "bn" in p.lower():
                val *= 1_000_000_000
            else:
                val *= 1_000_000
            if 500_000 < val < 5_000_000_000:  # sanity: $500K to $5B
                return int(val)
    return None

def parse_dwt(text):
    """Extract DWT from text."""
    m = re.search(r'([\d,]+)\s*(?:dwt|DWT|deadweight)', text)
    if m:
        return int(m.group(1).replace(",", ""))
    return None

def parse_year(text):
    """Extract build year from text."""
    for m in re.finditer(r'\b(19[89]\d|20[012]\d)\s*-?\s*(?:built|build|blt|construction)\b', text, re.I):
        return int(m.group(1))
    for m in re.finditer(r'(?:built|build|blt|construction)\s*(?:in\s*)?(19[89]\d|20[012]\d)\b', text, re.I):
        return int(m.group(1))
    # Year in parentheses after ship name: "Magic Saturn (2024-built"
    for m in re.finditer(r'\((\d{4})\s*-?\s*(?:built|blt)\)', text, re.I):
        return int(m.group(1))
    return None

def parse_ship_names(text):
    """Extract vessel names — look for M/V, MV, M/T patterns or quoted names."""
    names = []
    # M/V or M/T patterns
    for m in re.finditer(r'(?:M/[VT]|MV|MT|vessel)\s+["\']?([A-Z][A-Za-z0-9\s\-\.]+?)(?=["\',\.\(\)]|\s+(?:is|was|has|for|to|from|a\s|the\s|built|sold|acquired|purchased|\d{4}))', text):
        name = m.group(1).strip().rstrip(".")
        if 3 < len(name) < 40:
            names.append(name)
    return names

def extract_transactions(title, text, source, url):
    """Extract S&P transactions from article text."""
    transactions = []
    
    # Skip non-S&P articles
    skip_words = ["charter", "freight rate", "earnings", "quarterly", "financial results", "dividend"]
    title_lower = title.lower()
    if any(w in title_lower for w in skip_words) and "sale" not in title_lower and "sold" not in title_lower:
        return []
    
    full = title + " " + text
    
    # Try to find individual transactions
    # Pattern: "Ship Name" ... sold/acquired ... $XXM
    price = parse_price(full)
    dwt = parse_dwt(full)
    year = parse_year(full)
    ship_type = classify_type(full)
    
    # Check for aggregate deals ("2 vessels for $XXM" or "en bloc")
    agg = re.search(r'(\d+)\s+(?:vessels?|ships?|tankers?|bulkers?)\s+(?:for|at|sold|acquired)', full, re.I)
    en_bloc = "en bloc" in full.lower() or "aggregate" in full.lower()
    
    if price:
        ship_names = parse_ship_names(full)
        
        if agg and not ship_names:
            # Aggregate deal without individual names — skip
            return []
        
        if en_bloc and agg:
            count = int(agg.group(1))
            per_ship = price // count
            if ship_names:
                for name in ship_names[:count]:
                    transactions.append({
                        "ship_name": name, "ship_type": ship_type,
                        "dwt": dwt, "year_built": year,
                        "sale_price_usd": per_ship,
                        "source": source, "source_url": url,
                    })
            return transactions
        
        if ship_names:
            # Single ship or first ship mentioned
            transactions.append({
                "ship_name": ship_names[0], "ship_type": ship_type,
                "dwt": dwt, "year_built": year,
                "sale_price_usd": price,
                "source": source, "source_url": url,
            })
    
    return transactions

def scrape_rss(feed_url, source_name):
    """Scrape an RSS feed for S&P transactions."""
    print(f"\n=== {source_name} ===")
    xml = fetch_url(feed_url)
    if not xml:
        return []
    
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        print(f"  XML parse error: {e}")
        return []
    
    all_tx = []
    items = root.findall(".//item")
    print(f"  {len(items)} articles found")
    
    for item in items:
        title = (item.findtext("title") or "").strip()
        desc = (item.findtext("description") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        
        # Clean HTML from description
        desc_clean = re.sub(r"<[^>]+>", " ", desc)
        desc_clean = re.sub(r"\s+", " ", desc_clean).strip()
        
        txs = extract_transactions(title, desc_clean, source_name, link)
        for tx in txs:
            # Try to parse date
            if pub_date:
                try:
                    for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
                                "%Y-%m-%dT%H:%M:%S", "%d %b %Y"]:
                        try:
                            dt = datetime.strptime(pub_date.strip(), fmt)
                            tx["sale_date"] = dt.strftime("%Y-%m-%d")
                            break
                        except ValueError:
                            continue
                except:
                    pass
            all_tx.append(tx)
    
    return all_tx

def scrape_edgar():
    """Scrape SEC EDGAR 6-K filings for vessel sale announcements."""
    print("\n=== SEC EDGAR 6-K ===")
    
    # Search for vessel sale announcements
    queries = [
        '"sale+of+vessel"+"million"',
        '"vessel+acquisition"+"million"',
        '"sold+vessel"+"million"',
    ]
    
    all_tx = []
    for query in queries:
        url = f"https://efts.sec.gov/LATEST/search-index?q={query}&forms=6-K&dateRange=custom&startdt=2025-01-01&enddt=2026-07-02&from=0&size=20"
        data = fetch_url(url)
        if not data:
            continue
        
        try:
            results = json.loads(data)
            hits = results.get("hits", {}).get("hits", [])
            print(f"  Query '{query[:30]}...': {len(hits)} results")
            
            for hit in hits[:10]:
                source = hit.get("_source", {})
                title = source.get("display_names", [""])[0] if source.get("display_names") else ""
                filing_date = source.get("file_date", "")
                desc = source.get("_raw", "")
                
                txs = extract_transactions(title, desc, "SEC EDGAR 6-K", "")
                for tx in txs:
                    tx["sale_date"] = filing_date
                all_tx.extend(txs)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"  Parse error: {e}")
    
    return all_tx

def save_transactions(transactions):
    """Save transactions to database, skip duplicates."""
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")
    
    inserted = 0
    skipped = 0
    for tx in transactions:
        try:
            con.execute("""
                INSERT OR IGNORE INTO sp_transactions 
                (ship_name, imo, ship_type, dwt, year_built, sale_price_usd, 
                 sale_date, buyer, seller, source, source_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                tx.get("ship_name"), tx.get("imo"), tx.get("ship_type"),
                tx.get("dwt"), tx.get("year_built"), tx["sale_price_usd"],
                tx.get("sale_date"), tx.get("buyer"), tx.get("seller"),
                tx.get("source"), tx.get("source_url"),
            ))
            if con.total_changes:
                inserted += 1
            else:
                skipped += 1
        except sqlite3.IntegrityError:
            skipped += 1
    
    con.commit()
    total = con.execute("SELECT COUNT(*) FROM sp_transactions").fetchone()[0]
    con.close()
    return inserted, total

def main():
    print(f"S&P Transaction Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    all_transactions = []
    
    # RSS Sources
    rss_feeds = [
        ("https://www.shippingherald.com/feed/", "Shipping Herald"),
        ("https://www.shippingherald.com/category/dry-cargo/feed/", "Shipping Herald Dry"),
        ("https://www.shippingherald.com/category/tankers/feed/", "Shipping Herald Tankers"),
        ("https://www.frontlineplc.cy/category/press-releases/feed/", "Frontline plc"),
        ("https://www.scorpiotankers.com/news/feed/", "Scorpio Tankers"),
        ("https://www.seatrade-maritime.com/rss.xml", "Seatrade Maritime"),
    ]
    
    for url, name in rss_feeds:
        txs = scrape_rss(url, name)
        all_transactions.extend(txs)
        time.sleep(2)  # be polite
    
    # SEC EDGAR
    txs = scrape_edgar()
    all_transactions.extend(txs)
    
    # Deduplicate by ship name + price
    seen = set()
    unique = []
    for tx in all_transactions:
        key = (tx["ship_name"].lower(), tx["sale_price_usd"])
        if key not in seen:
            seen.add(key)
            unique.append(tx)
    
    print(f"\n=== RESULTS ===")
    print(f"Raw transactions found: {len(all_transactions)}")
    print(f"Unique transactions: {len(unique)}")
    
    for tx in unique:
        price_m = tx['sale_price_usd'] / 1e6
        print(f"  {tx['ship_name']:25} {tx.get('ship_type','?'):15} ${price_m:>7.1f}M  {tx.get('sale_date','?')}")
    
    inserted, total = save_transactions(unique)
    print(f"\nInserted: {inserted} new, Total in DB: {total}")

if __name__ == "__main__":
    main()
