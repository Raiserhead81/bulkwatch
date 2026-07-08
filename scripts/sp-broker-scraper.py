#!/usr/bin/env python3
"""S&P Broker-Report Scraper — real vessel sales from shipbroker weekly PDFs.

Shipbrokers (Intermodal, Allied, ...) publish free weekly market reports whose
"Secondhand Sales" section lists real completed sales: vessel, dwt, year, price,
buyer. These PDFs are hosted publicly on cyprusshippingnews.com. We enumerate
them, extract the S&P section, and use Claude Haiku to parse each into structured
transactions — dozens per report vs. the ~1 the RSS regex could get. Deduped
against sp_transactions and matched to our ships by name for the IMO.
"""
import sqlite3, urllib.request, re, json, math, subprocess, tempfile, os, time

DB = "/opt/bulkwatch/db/ships.db"
UA = {"User-Agent": "Mozilla/5.0 (compatible; BulkWatch/1.0)"}
KEY = [l.split("=", 1)[1].strip() for l in open("/opt/bulkwatch/.env") if l.startswith("ANTHROPIC_API_KEY=")][0]
UP = "https://cyprusshippingnews.com/wp-content/uploads/%d/%02d/"
BROKERS = [("Intermodal", "Intermodal-Report-Week-%02d-%d.pdf"),
           ("Allied", "ALLIED-Weekly-Market-Report-Week-%02d.pdf")]
YEARS = [2024, 2025, 2026]  # 2026 dedupt sich; 2024/2025 = historischer Backfill

def head_ok(u):
    try:
        return urllib.request.urlopen(urllib.request.Request(u, method="HEAD", headers=UA), timeout=12).status == 200
    except Exception:
        return False

def enumerate_pdfs():
    out = []
    for year in YEARS:
        for wk in range(1, 53):
            mon = max(1, min(12, math.ceil(wk / 4.345)))
            for bname, fpat in BROKERS:
                fn = fpat % (wk, year) if fpat.count("%") == 2 else fpat % wk
                for m in (mon, mon - 1, mon + 1):
                    if 1 <= m <= 12:
                        u = (UP % (year, m)) + fn
                        if head_ok(u):
                            out.append((bname, wk, year, u)); break
    return out

def pdf_text(url):
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
    except Exception as e:
        print("  DL-Fehler:", e); return ""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(data); path = f.name
    try:
        subprocess.run(["pdftotext", "-layout", path, path + ".txt"], timeout=60, check=True)
        txt = open(path + ".txt", encoding="utf-8", errors="ignore").read()
    except Exception as e:
        print("  pdftotext-Fehler:", e); txt = ""
    finally:
        for p in (path, path + ".txt"):
            try: os.remove(p)
            except OSError: pass
    return txt

def snp_chunk(text):
    low = text.lower()
    for marker in ("secondhand", "second hand", "sale & purchase", "reported sales", "s&p"):
        i = low.find(marker)
        if i >= 0:
            return text[i:i + 7000]
    return text[:8000]

def haiku_deals(chunk):
    prompt = ("Extract ONLY completed second-hand VESSEL SALES (Sale & Purchase) from this "
              "shipbroker report. IGNORE charters (anything priced per day / $X/day) and newbuilding orders. "
              "Return a JSON array; each item: {ship_name, ship_type, dwt (number), year_built (number), "
              "price_usd (number; $25.5m -> 25500000), buyer, seller}. Only rows with a ship name AND a "
              "total sale price in millions. Unknown -> null. Return ONLY the JSON array.\n\n" + chunk)
    body = json.dumps({"model": "claude-haiku-4-5-20251001", "max_tokens": 3000,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(
            "https://api.anthropic.com/v1/messages", data=body,
            headers={"Content-Type": "application/json", "x-api-key": KEY,
                     "anthropic-version": "2023-06-01"}), timeout=90).read())
        m = re.search(r"\[.*\]", r["content"][0]["text"], re.S)
        return json.loads(m.group(0)) if m else []
    except Exception as e:
        print("  Haiku-Fehler:", e); return []

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]", " ", (s or "").lower())).strip()

def main():
    db = sqlite3.connect(DB)
    # bestehende Deals + Schiffsnamen->IMO Index
    existing = set()
    for n, p in db.execute("SELECT ship_name, sale_price_usd FROM sp_transactions"):
        existing.add((norm(n), int(p or 0)))
    imo_by_name = {}
    for imo, nm in db.execute("SELECT imo, name FROM ships WHERE name IS NOT NULL AND name<>''"):
        imo_by_name.setdefault(norm(nm), imo)

    db.execute("CREATE TABLE IF NOT EXISTS sp_broker_pdfs(url TEXT PRIMARY KEY, ts TEXT)")
    db.commit()
    done_pdfs = {r[0] for r in db.execute("SELECT url FROM sp_broker_pdfs")}

    print("Enumeriere Makler-PDFs...", flush=True)
    pdfs = [p for p in enumerate_pdfs() if p[3] not in done_pdfs]
    print("Gefunden:", len(pdfs), "neue PDFs (schon verarbeitet:", len(done_pdfs), ")", flush=True)

    inserted = dup = 0
    for bname, wk, year, url in pdfs:
        deals = haiku_deals(snp_chunk(pdf_text(url)))
        new = 0
        for d in deals:
            name = (d.get("ship_name") or "").strip()
            price = d.get("price_usd")
            if not name or not price:
                continue
            try: price = int(price)
            except (TypeError, ValueError): continue
            # Plausibilitätsgrenze: unter $0.5m kein echter Verkauf; über $300m
            # fast sicher ein LLM-Parse-Fehler (teuerste Schiffe ~$250m).
            if price < 500000 or price > 300000000:
                continue
            key = (norm(name), price)
            if key in existing:
                dup += 1; continue
            existing.add(key)
            db.execute("""INSERT INTO sp_transactions
                (ship_name, imo, ship_type, dwt, year_built, sale_price_usd, sale_date, buyer, seller, source, source_url, scraped_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?, datetime('now'))""",
                (name, imo_by_name.get(norm(name)), d.get("ship_type"),
                 d.get("dwt"), d.get("year_built"), price,
                 "%d-W%02d" % (year, wk), d.get("buyer"), d.get("seller"),
                 "%s Weekly Report" % bname, url))
            inserted += 1; new += 1
        db.execute("INSERT OR REPLACE INTO sp_broker_pdfs VALUES (?, datetime('now'))", (url,))
        db.commit()
        print("  %s W%02d/%d: +%d neu (%d Deals im Report)" % (bname, wk, year, new, len(deals)), flush=True)
        time.sleep(0.5)

    total = db.execute("SELECT count(*) FROM sp_transactions").fetchone()[0]
    print("\nFERTIG. Neu: %d | Duplikate übersprungen: %d | sp_transactions gesamt: %d" % (inserted, dup, total), flush=True)

if __name__ == "__main__":
    main()
