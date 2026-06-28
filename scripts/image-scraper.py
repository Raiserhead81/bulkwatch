#!/usr/bin/env python3
"""Vessel image scraper v2 — respects Wikimedia rate limits."""
import sqlite3, urllib.request, urllib.parse, json, time, sys, re

DB = "/opt/bulkwatch/db/ships.db"
BATCH = 2000
DELAY = 2.0  # 2 seconds between calls — Wikimedia allows ~200/min for bots

def search_wikimedia(query):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": "6",
        "srlimit": "1",
        "format": "json",
    })
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "VesselDB/1.0 (hallo@gemivo.de; vessel image enrichment)"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        results = data.get("query", {}).get("search", [])
        if not results:
            return None, None

        title = results[0]["title"]
        info_url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "960",
            "format": "json",
        })
        req2 = urllib.request.Request(info_url, headers={"User-Agent": "VesselDB/1.0 (hallo@gemivo.de; vessel image enrichment)"})
        with urllib.request.urlopen(req2, timeout=15) as resp2:
            info = json.loads(resp2.read())

        pages = info.get("query", {}).get("pages", {})
        for page in pages.values():
            ii = page.get("imageinfo", [{}])[0]
            thumb = ii.get("thumburl", ii.get("url", ""))
            meta = ii.get("extmetadata", {})
            artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
            license_ = meta.get("LicenseShortName", {}).get("value", "")
            if thumb and not any(x in thumb.lower() for x in ["logo", "flag", "icon", "map"]):
                attr = f"{artist} ({license_})" if artist else license_
                return thumb, attr
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  Rate limited, waiting 30s...", flush=True)
            time.sleep(30)
            return "RETRY", None
        print(f"  HTTP {e.code}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"  Error: {e}", file=sys.stderr, flush=True)
    return None, None

def main():
    db = sqlite3.connect(DB)
    ships = db.execute(
        "SELECT imo, name FROM ships WHERE (image_url IS NULL OR image_url = '') ORDER BY dwt DESC LIMIT ?",
        (BATCH,)
    ).fetchall()

    print(f"Searching images for {len(ships)} ships...", flush=True)
    found = 0
    skipped = 0

    for i, (imo, name) in enumerate(ships):
        if i % 100 == 0:
            print(f"  [{i}/{len(ships)}] found={found} skipped={skipped}", flush=True)

        # Search with IMO number
        url, attr = search_wikimedia(f'IMO {imo} ship')
        if url == "RETRY":
            url, attr = search_wikimedia(f'IMO {imo} ship')

        if not url or url == "RETRY":
            # Try ship name
            url, attr = search_wikimedia(f'"{name}" vessel')
            if url == "RETRY":
                url, attr = search_wikimedia(f'"{name}" vessel')

        if url and url != "RETRY":
            db.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=?", (url, attr or "", imo))
            found += 1
        else:
            skipped += 1

        if found % 20 == 0 and found > 0:
            db.commit()

        time.sleep(DELAY)

    db.commit()
    db.close()
    print(f"\nDone! Found {found} images out of {len(ships)} ships ({found*100//max(len(ships),1)}%)", flush=True)

if __name__ == "__main__":
    main()
