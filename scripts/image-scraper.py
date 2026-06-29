#!/usr/bin/env python3
"""Image scraper v3 — strict matching, only accepts images that reference the ship."""
import sqlite3, urllib.request, urllib.parse, json, time, re, sys

DB = "/opt/bulkwatch/db/ships.db"
DELAY = 2.0
UA = "VesselDB/1.0 (hallo@gemivo.de; vessel image enrichment)"

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

            # STRICT: title must contain ship name part or IMO
            has_ref = ship_imo in title or any(p in title_lower for p in name_parts)
            if not has_ref:
                continue

            # Skip obvious non-ship results
            bad = ["flag", "logo", "emblem", "coat", "seal", "stamp", "coin", "medal",
                   "portrait", "painting", "drawing", "sketch", "map", "chart",
                   "museum", "ancient", "pottery", "ceramic", "statue"]
            if any(b in title_lower for b in bad):
                continue

            # Get image URL
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
            print("  Rate limited, waiting 30s...", flush=True)
            time.sleep(30)
    except Exception as e:
        pass
    return None, None

def main():
    db = sqlite3.connect(DB)
    ships = db.execute(
        "SELECT imo, name FROM ships WHERE (image_url IS NULL OR image_url = '') ORDER BY dwt DESC LIMIT 3000"
    ).fetchall()

    print(f"Searching images for {len(ships)} ships (strict mode)...", flush=True)
    found = 0

    for i, (imo, name) in enumerate(ships):
        if i % 100 == 0:
            print(f"  [{i}/{len(ships)}] found={found}", flush=True)

        for query in [f'IMO {imo}', f'"{name}" ship', f'"{name}" vessel IMO']:
            url, attr = search_wikimedia(query, name, imo)
            if url:
                db.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=?", (url, attr or "", imo))
                found += 1
                db.commit()
                break
        time.sleep(DELAY)

    print(f"\nDone! Found {found} verified images for {len(ships)} ships", flush=True)

if __name__ == "__main__":
    main()
