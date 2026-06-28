#!/usr/bin/env python3
"""
moar_images.py — Weitere Quellen: nl.wikipedia.org, breitere Commons-Suche, Flickr-Gruppen
"""
import json, time, re, urllib.request, urllib.parse, sqlite3

NL_WP = "https://nl.wikipedia.org/w/api.php"
DE_WP = "https://de.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

IMO_PATTERN = re.compile(r"\bIMO[_\s\-#:]*(\d{7})\b", re.IGNORECASE)

def api_get(base_url, params, retries=3):
    params["format"] = "json"
    url = base_url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(3)
    return None

def get_wp_category_members(base_url, category, max_count=2000):
    members = []
    cmcontinue = None
    while len(members) < max_count:
        params = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": "page", "cmlimit": "500",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        d = api_get(base_url, params)
        if not d:
            break
        members.extend(d.get("query", {}).get("categorymembers", []))
        cont = d.get("continue", {})
        cmcontinue = cont.get("cmcontinue")
        if not cmcontinue:
            break
        time.sleep(0.3)
    return members

def get_pages_with_images(base_url, titles_batch):
    result = {}
    params = {
        "action": "query",
        "titles": "|".join(titles_batch),
        "prop": "pageimages|revisions",
        "pithumbsize": "960",
        "rvprop": "content", "rvslots": "main",
        "rvsection": "0",
    }
    d = api_get(base_url, params)
    if not d:
        return result
    pages = d.get("query", {}).get("pages", {})
    for page in pages.values():
        thumb = page.get("thumbnail", {}).get("source", "")
        if not thumb:
            continue
        revs = page.get("revisions", [])
        if not revs:
            continue
        content = revs[0].get("slots", {}).get("main", {}).get("*", "") or revs[0].get("*", "")
        m = IMO_PATTERN.search(content)
        if not m:
            continue
        imo = m.group(1)
        result[imo] = {
            "imageUrl": thumb,
            "artist": "Wikimedia Commons",
            "license": "CC BY-SA",
            "source": page.get("title", "")
        }
    return result

def commons_search_new(query, existing, max_results=500):
    """Search Commons for files by text query."""
    result = {}
    sroffset = 0
    while sroffset < max_results:
        d = api_get(COMMONS_API, {
            "action": "query", "list": "search",
            "srsearch": query, "srnamespace": "6",
            "srlimit": "50", "sroffset": str(sroffset),
        })
        if not d:
            break
        hits = d.get("query", {}).get("search", [])
        if not hits:
            break

        file_titles = [h["title"] for h in hits]
        # Get imageinfo for these
        params2 = {
            "action": "query",
            "titles": "|".join(file_titles),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "960",
        }
        d2 = api_get(COMMONS_API, params2)
        if d2:
            pages = d2.get("query", {}).get("pages", {})
            for page in pages.values():
                title = page.get("title", "")
                m = IMO_PATTERN.search(title)
                if not m:
                    continue
                imo = m.group(1)
                if imo in existing or imo in result:
                    continue
                infos = page.get("imageinfo", [])
                if not infos or not infos[0].get("thumburl"):
                    continue
                info = infos[0]
                meta = info.get("extmetadata", {})
                artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()[:80]
                license_val = meta.get("LicenseShortName", {}).get("value", "CC BY-SA")
                result[imo] = {
                    "imageUrl": info["thumburl"],
                    "artist": artist or "Unknown",
                    "license": license_val,
                }

        sroffset += len(hits)
        if len(hits) < 50:
            break
        time.sleep(0.4)
    return result

def flickr_feed_search(tags):
    url = "https://api.flickr.com/services/feeds/photos_public.gne?" + urllib.parse.urlencode({
        "tags": tags, "format": "json", "nojsoncallback": "1"
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except:
        return None

def main():
    existing = json.load(open(IMAGES_PATH))
    print(f"Starting with: {len(existing)} images", flush=True)
    new_images = {}

    # === 1: Dutch Wikipedia (nl.wikipedia.org) - great for ship articles ===
    print("\n=== Dutch Wikipedia ===", flush=True)
    nl_categories = [
        "Bulkcarrier", "Vrachtschip", "Containerschip", "Tanker (schip)",
        "Stukgoedschip", "Ro-ro-schip", "LNG-tanker",
    ]
    all_nl_titles = []
    for cat in nl_categories:
        members = get_wp_category_members(NL_WP, cat)
        titles = [m["title"] for m in members]
        print(f"  {cat}: {len(titles)} articles", flush=True)
        all_nl_titles.extend(titles)
        time.sleep(0.5)

    all_nl_titles = list(set(all_nl_titles))
    print(f"Dutch WP total: {len(all_nl_titles)} articles", flush=True)

    batch_size = 20
    for i in range(0, len(all_nl_titles), batch_size):
        batch = all_nl_titles[i:i+batch_size]
        infos = get_pages_with_images(NL_WP, batch)
        for imo, info in infos.items():
            if imo not in existing and imo not in new_images:
                new_images[imo] = info
        if i % 200 == 0:
            print(f"  {i}/{len(all_nl_titles)} → {len(new_images)} new", flush=True)
        time.sleep(0.4)

    print(f"After Dutch WP: {len(new_images)} new", flush=True)

    # === 2: German Wikipedia ===
    print("\n=== German Wikipedia ===", flush=True)
    de_categories = [
        "Massengutfrachter", "Containerschiff", "Tanker", "Frachtschiff",
        "Ro-ro-Schiff", "Gastanker",
    ]
    all_de_titles = []
    for cat in de_categories:
        members = get_wp_category_members(DE_WP, cat)
        titles = [m["title"] for m in members]
        print(f"  {cat}: {len(titles)} articles", flush=True)
        all_de_titles.extend(titles)
        time.sleep(0.5)

    all_de_titles = list(set(all_de_titles))
    print(f"German WP total: {len(all_de_titles)} articles", flush=True)

    for i in range(0, len(all_de_titles), batch_size):
        batch = all_de_titles[i:i+batch_size]
        infos = get_pages_with_images(DE_WP, batch)
        for imo, info in infos.items():
            if imo not in existing and imo not in new_images:
                new_images[imo] = info
        if i % 200 == 0:
            print(f"  {i}/{len(all_de_titles)} → {len(new_images)} new", flush=True)
        time.sleep(0.4)

    print(f"After German WP: {len(new_images)} new", flush=True)

    # === 3: Broader Commons search ===
    print("\n=== Commons broader search ===", flush=True)
    commons_queries = [
        "ship IMO 9",
        "vessel IMO 9",
        "tanker IMO 9",
        "container ship IMO 9",
        "cargo vessel IMO",
        "mv IMO ship",
        "ms IMO ship",
    ]
    for q in commons_queries:
        merged_so_far = {**existing, **new_images}
        infos = commons_search_new(q, merged_so_far)
        new_images.update(infos)
        print(f"  '{q}': {len(infos)} new", flush=True)
        time.sleep(1)

    # === 4: More Flickr tags ===
    print("\n=== More Flickr ===", flush=True)
    flickr_tags = [
        "schip,IMO,haven",      # Dutch ship photos
        "vessel,IMO,harbor",
        "bulkcarrier,IMO",
        "ship,IMO,8digits",
        "IMO,ship,photo",
        "tanker,IMO,port",
        "cargo,IMO,ship",
    ]
    for tags in flickr_tags:
        d = flickr_feed_search(tags)
        if not d:
            time.sleep(1)
            continue
        items = d.get("items", [])
        found = 0
        for item in items:
            combined = item.get("title", "") + " " + item.get("description", "")
            m = IMO_PATTERN.search(combined)
            if not m:
                continue
            imo = m.group(1)
            if imo in existing or imo in new_images:
                continue
            img_url = item.get("media", {}).get("m", "").replace("_m.jpg", "_b.jpg")
            if not img_url:
                continue
            new_images[imo] = {
                "imageUrl": img_url,
                "artist": item.get("author", "Flickr").replace("nobody@flickr.com (", "").rstrip(")"),
                "license": "CC BY-SA 2.0",
                "source": "flickr"
            }
            found += 1
        print(f"  '{tags}': {len(items)} items, {found} new", flush=True)
        time.sleep(1)

    # === Save ===
    merged = {**existing, **new_images}
    print(f"\n=== TOTAL ===", flush=True)
    print(f"New images: {len(new_images)}", flush=True)
    print(f"Grand total: {len(existing)} → {len(merged)}", flush=True)

    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print("Saved!", flush=True)

    # Sync to DB
    print("\nSyncing to DB...", flush=True)
    conn = sqlite3.connect("/opt/bulkwatch/db/ships.db")
    cur = conn.cursor()
    updated = 0
    for imo, img in new_images.items():
        img_url = img.get("imageUrl")
        if not img_url:
            continue
        img_attr = "{} / {}".format(img.get("artist", ""), img.get("license", ""))
        cur.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=? AND image_url IS NULL",
                    (img_url, img_attr, imo))
        if cur.rowcount:
            updated += 1
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM ships WHERE image_url IS NOT NULL")
    total_with = cur.fetchone()[0]
    conn.close()
    print(f"DB updated: {updated} ships got images ({total_with} total in DB)", flush=True)

if __name__ == "__main__":
    main()
