#!/usr/bin/env python3
"""Fetch images for the most important ships first (high DWT, top picks)."""
import sqlite3, urllib.request, urllib.parse, json, time, re

DB = "/opt/bulkwatch/db/ships.db"
UA = "VesselDB/1.0 (hallo@gemivo.de)"

def search_wikimedia(query):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": query,
        "srnamespace": "6", "srlimit": "3", "format": "json",
    })
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        results = data.get("query", {}).get("search", [])
        if not results:
            return None, None

        for r in results:
            title = r["title"]
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
                meta = ii.get("extmetadata", {})
                artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
                license_ = meta.get("LicenseShortName", {}).get("value", "")
                # Skip non-ship images
                if thumb and not any(x in thumb.lower() for x in ["logo", "flag", "icon", "map", "coat", "emblem", "seal"]):
                    attr = f"{artist} ({license_})" if artist else license_
                    return thumb, attr
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  Rate limited, waiting 30s...")
            time.sleep(30)
        return None, None
    except Exception as e:
        print(f"  Error: {e}")
    return None, None

db = sqlite3.connect(DB)

# Priority: biggest ships without images
ships = db.execute("""
    SELECT imo, name, type FROM ships
    WHERE (image_url IS NULL OR image_url = '')
    AND status = 'active' AND dwt > 0
    ORDER BY dwt DESC
    LIMIT 500
""").fetchall()

print(f"Searching images for {len(ships)} priority ships...")
found = 0

for i, (imo, name, stype) in enumerate(ships):
    if i % 50 == 0:
        print(f"  [{i}/{len(ships)}] found={found}")

    # Try multiple search strategies
    for query in [
        f'IMO {imo} ship',
        f'"{name}" vessel',
        f'"{name}" ship {stype}',
    ]:
        url, attr = search_wikimedia(query)
        if url:
            db.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=?", (url, attr or "", imo))
            found += 1
            db.commit()
            break
    time.sleep(2)

print(f"\nDone! Found {found} images for {len(ships)} ships")
