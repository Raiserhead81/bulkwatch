#!/usr/bin/env python3
"""Prüft alle Schiffsbilder per Claude Vision und entfernt Nicht-Schiff-Bilder."""
import sqlite3, base64, json, urllib.request, urllib.error, sys, time

DB = "/opt/bulkwatch/db/ships.db"
API_KEY = ""

# Load API key
for line in open("/etc/gemivo/gemivo.env"):
    if line.startswith("ANTHROPIC_API_KEY="):
        API_KEY = line.strip().split("=", 1)[1].strip()
        break

if not API_KEY:
    print("No ANTHROPIC_API_KEY found"); sys.exit(1)

def check_image(url):
    """Returns True if image shows a ship, False if person/object/logo/etc."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=10).read()
        if len(data) < 1000:
            return False  # too small, probably error
        b64 = base64.standard_b64encode(data).decode()
        media = "image/jpeg"
        if url.lower().endswith(".png"):
            media = "image/png"
        
        body = json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 20,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                {"type": "text", "text": "Does this image show a ship or vessel (cargo ship, tanker, bulk carrier, container ship, etc.)? Answer only YES or NO."}
            ]}]
        }).encode()
        
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-api-key": API_KEY,
                "anthropic-version": "2023-06-01",
            }
        )
        for attempt in range(4):
            try:
                resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
                answer = resp.get("content", [{}])[0].get("text", "").strip().upper()
                return "YES" in answer
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 529) and attempt < 3:
                    time.sleep(5 * (attempt + 1))  # 5s,10s,15s backoff on rate-limit/overload
                    continue
                raise
    except Exception as e:
        print(f"  Error: {e}")
        return None  # skip on error

def main():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT imo, name, image_url FROM ships WHERE image_url IS NOT NULL AND image_url != ").fetchall()
    
    total = len(rows)
    removed = 0
    checked = 0
    errors = 0
    
    print(f"Checking {total} images...")
    
    for r in rows:
        imo, name, url = r["imo"], r["name"], r["image_url"]
        checked += 1
        
        is_ship = check_image(url)
        
        if is_ship is None:
            errors += 1
            print(f"  [{checked}/{total}] SKIP {name} (error)")
        elif is_ship:
            print(f"  [{checked}/{total}] OK   {name}")
        else:
            removed += 1
            con.execute("UPDATE ships SET image_url=NULL, image_attribution=NULL WHERE imo=?", (imo,))
            con.commit()
            print(f"  [{checked}/{total}] DEL  {name} — {url[:80]}")
        
        # Rate limit: ~20 req/min for Haiku
        time.sleep(0.5)
        
        # Progress every 100
        if checked % 100 == 0:
            print(f"\n=== Progress: {checked}/{total}, removed {removed}, errors {errors} ===\n")
    
    print(f"\nDone: {checked} checked, {removed} removed, {errors} errors")

if __name__ == "__main__":
    main()
