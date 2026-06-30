#!/usr/bin/env python3
"""
Fetch images for ships without photos — IMO-only search on Wikimedia Commons.
Only matches files with the IMO number in the filename (high confidence).
"""
import json, re, time, sqlite3, urllib.request, urllib.parse

DB = "/opt/bulkwatch/db/ships.db"
API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de)"

def wiki_imo_search(imo):
    """Search Wikimedia Commons for files containing this IMO number"""
    params = {
        "action": "query", "format": "json",
        "generator": "search", "gsrsearch": f'File: IMO {imo}',
        "gsrlimit": "5", "gsrnamespace": "6",
        "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": "800",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        pages = data.get("query", {}).get("pages", {})
        for p in pages.values():
            title = p.get("title", "")
            # Only accept if IMO number actually appears in the filename
            if imo not in title.replace(" ", "").replace("_", "").replace("-", ""):
                continue
            ii = (p.get("imageinfo") or [{}])[0]
            thumb = ii.get("thumburl") or ii.get("url")
            if thumb and any(ext in thumb.lower() for ext in [".jpg", ".jpeg", ".png"]):
                meta = ii.get("extmetadata", {})
                artist = meta.get("Artist", {}).get("value", "")
                artist = re.sub(r"<[^>]+>", "", artist).strip()[:80]
                lic = meta.get("LicenseShortName", {}).get("value", "CC")
                attr = f"{artist} ({lic})" if artist else f"Wikimedia ({lic})"
                return {"url": thumb, "attribution": attr}
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print(f"  Rate limited, waiting 10s...")
            time.sleep(10)
        else:
            print(f"  Wiki error: {e}")
    except Exception as e:
        print(f"  Wiki error: {e}")
    return None

def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    ships = conn.execute("""
        SELECT imo, name, type, dwt
        FROM ships
        WHERE status = 'active' AND dwt > 0 AND year_built > 1990
          AND (image_url IS NULL OR image_url = '')
          AND type IN ('Capesize','Newcastlemax','VLOC','Kamsarmax','Panamax',
                       'Handymax','Handysize','General Cargo','Bulk Carrier',
                       'Container Ship','Product Tanker','Crude Oil Tanker',
                       'Tanker','Car Carrier','RoRo','Ultramax','Supramax')
        ORDER BY dwt DESC
        LIMIT 200
    """).fetchall()

    print(f"Searching images for {len(ships)} ships (IMO-only, Wikimedia Commons)")
    found = 0

    for i, ship in enumerate(ships):
        imo = ship["imo"]
        if imo.startswith("cat-"):
            continue  # Skip non-IMO entries

        result = wiki_imo_search(imo)
        if result:
            conn.execute(
                "UPDATE ships SET image_url = ?, image_attribution = ? WHERE imo = ?",
                (result["url"], result["attribution"], imo)
            )
            conn.commit()
            found += 1
            print(f"  [{i+1}/{len(ships)}] {ship['name']} (IMO {imo}): FOUND")
        else:
            if (i+1) % 20 == 0:
                print(f"  [{i+1}/{len(ships)}] ... {found} found so far")

        time.sleep(2)  # 2s between requests to avoid rate limiting

    print(f"\nDone: {found} new images found out of {len(ships)} ships")
    conn.close()

if __name__ == "__main__":
    main()
