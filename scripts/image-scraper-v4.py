#!/usr/bin/env python3
"""Image scraper v4 — strict matching + Claude Vision verification.
Finds Wikimedia images for ships without photos, then verifies each
image actually shows a cargo ship via Claude Haiku Vision."""
import sqlite3, urllib.request, urllib.parse, urllib.error, json, time, re, sys, base64

DB = "/opt/bulkwatch/db/ships.db"
DELAY = 2.0
UA = "VesselDB/1.0 (hallo@gemivo.de; vessel image enrichment)"
API_KEY = ""

# Load Anthropic key
for line in open("/etc/gemivo/gemivo.env"):
    if line.startswith("ANTHROPIC_API_KEY="):
        API_KEY = line.strip().split("=", 1)[1].strip()
        break


def search_wikimedia(query, ship_name, ship_imo):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": query,
        "srnamespace": "6", "srlimit": "5", "format": "json",
    })
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        results = data.get("query", {}).get("search", [])
        if not results:
            return None, None

        name_parts = [p.lower() for p in re.split(r'[\s._\-]+', ship_name.lower()) if len(p) > 2 and not p.isdigit()]

        for r in results:
            title = r["title"]
            title_lower = title.lower()

            has_ref = ship_imo in title or any(p in title_lower for p in name_parts)
            if not has_ref:
                continue

            bad = ["flag", "logo", "emblem", "coat", "seal", "stamp", "coin", "medal",
                   "portrait", "painting", "drawing", "sketch", "map", "chart",
                   "museum", "ancient", "pottery", "ceramic", "statue", "bridge",
                   "building", "monument", "person", "tiff", "dedication"]
            if any(b in title_lower for b in bad):
                continue

            info_url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
                "action": "query", "titles": title, "prop": "imageinfo",
                "iiprop": "url|extmetadata", "iiurlwidth": "960", "format": "json",
            })
            req2 = urllib.request.Request(info_url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req2, timeout=15) as resp2:
                info = json.loads(resp2.read())

            pages = info.get("query", {}).get("pages", {})
            for page in pages.values():
                ii = page.get("imageinfo", [{}])[0]
                thumb = ii.get("thumburl", ii.get("url", ""))
                if not thumb:
                    continue
                meta = ii.get("extmetadata", {})
                artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
                license_ = meta.get("LicenseShortName", {}).get("value", "")
                attr = f"{artist} ({license_})" if artist else license_
                return thumb, attr

    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Wikimedia rate limit, waiting 30s...", flush=True)
            time.sleep(30)
    except Exception:
        pass
    return None, None


def verify_ship_image(image_url):
    """Use Claude Vision to verify the image shows a cargo ship. Returns True/False."""
    if not API_KEY:
        return True  # skip verification if no key

    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=15).read()
        if len(data) < 1000:
            return False

        b64 = base64.standard_b64encode(data).decode()
        media = "image/png" if ".png" in image_url.lower() else "image/jpeg"

        body = json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 10,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                {"type": "text", "text": "Is this a color photo showing a single cargo ship, bulk carrier, tanker, or container ship as the main subject? YES or NO only."}
            ]}]
        }).encode()

        req2 = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        })
        for attempt in range(4):
            try:
                resp = json.loads(urllib.request.urlopen(req2, timeout=30).read())
                answer = resp.get("content", [{}])[0].get("text", "").strip().upper()
                return "YES" in answer
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 529) and attempt < 3:
                    time.sleep(5 * (attempt + 1))  # 5s,10s,15s backoff on rate-limit/overload
                    continue
                raise
    except Exception as e:
        print(f"  Vision check error: {e}", flush=True)
        return True  # keep on error, don't delete


def main():
    db = sqlite3.connect(DB)
    ships = db.execute(
        "SELECT imo, name FROM ships WHERE (image_url IS NULL OR image_url = '') ORDER BY dwt DESC LIMIT 1000"
    ).fetchall()

    print(f"Searching images for {len(ships)} ships (v4: strict + vision)...", flush=True)
    found = 0
    rejected = 0

    for i, (imo, name) in enumerate(ships):
        if i % 50 == 0:
            print(f"  [{i}/{len(ships)}] found={found} rejected={rejected}", flush=True)

        for query in [f'IMO {imo}', f'"{name}" ship', f'"{name}" vessel IMO']:
            url, attr = search_wikimedia(query, name, imo)
            if url:
                # Vision verification
                if verify_ship_image(url):
                    db.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=?", (url, attr or "", imo))
                    db.commit()
                    found += 1
                    print(f"  OK   {name[:30]} -> {url.split('/')[-1][:50]}", flush=True)
                else:
                    rejected += 1
                    print(f"  SKIP {name[:30]} (vision rejected)", flush=True)
                break
        time.sleep(DELAY)

    print(f"\nDone! Found {found}, rejected {rejected} out of {len(ships)} ships", flush=True)


if __name__ == "__main__":
    main()
