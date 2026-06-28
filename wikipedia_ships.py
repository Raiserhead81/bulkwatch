#!/usr/bin/env python3
"""
wikipedia_ships.py — Holt Schiffsbilder aus Wikipedia-Artikeln
Strategie:
1. Wikipedia-Kategorien für Schiffe durchsuchen → Artikel
2. Pro Artikel: IMO-Nummer aus Text + pageimage holen
3. Bilder in ship-images.json speichern
"""
import json, time, re, urllib.request, urllib.parse

WP_API = "https://en.wikipedia.org/w/api.php"
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
            print(f"  API error {attempt+1}: {e}", flush=True)
            if attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
    return None

def get_wp_category_members(category, limit=500):
    members = []
    cmcontinue = None
    while True:
        params = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": "page", "cmlimit": str(limit),
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        d = api_get(WP_API, params)
        if not d:
            break
        members.extend(d.get("query", {}).get("categorymembers", []))
        cont = d.get("continue", {})
        cmcontinue = cont.get("cmcontinue")
        if not cmcontinue or len(members) >= 2000:
            break
        time.sleep(0.3)
    return members

def get_pages_with_images(titles_batch):
    """Returns dict: title → {imo, imageUrl, artist, license}"""
    result = {}
    params = {
        "action": "query",
        "titles": "|".join(titles_batch),
        "prop": "pageimages|revisions",
        "pithumbsize": "960",
        "rvprop": "content", "rvslots": "main",
        "rvsection": "0",  # Only intro
    }
    d = api_get(WP_API, params)
    if not d:
        return result

    pages = d.get("query", {}).get("pages", {})
    for page in pages.values():
        title = page.get("title", "")
        thumb = page.get("thumbnail", {}).get("source", "")
        pageimage = page.get("pageimage", "")
        if not thumb or not pageimage:
            continue

        # Find IMO in article text
        imo = None
        revs = page.get("revisions", [])
        if revs:
            content = revs[0].get("slots", {}).get("main", {}).get("*", "") or revs[0].get("*", "")
            m = IMO_PATTERN.search(content)
            if m:
                imo = m.group(1)

        if not imo:
            continue

        # Get proper attribution from Commons
        result[imo] = {
            "imageUrl": thumb,
            "artist": "Wikimedia Commons",
            "license": "CC BY-SA",
            "source": "wikipedia",
            "name": title
        }

    return result

def get_flickr_images(imo_list):
    """Search Flickr public feed for specific IMO numbers."""
    result = {}
    # Flickr public feed - search by tag
    for imo in imo_list[:50]:  # Limit to avoid rate limits
        url = f"https://api.flickr.com/services/feeds/photos_public.gne?tags=IMO+{imo}&format=json&nojsoncallback=1"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                d = json.loads(r.read())
            items = d.get("items", [])
            for item in items:
                # Check for CC license
                title = item.get("title", "")
                img = item.get("media", {}).get("m", "").replace("_m.jpg", "_b.jpg")  # Get large version
                if img and imo in title or f"IMO {imo}" in title or f"IMO{imo}" in title:
                    result[imo] = {
                        "imageUrl": img,
                        "artist": item.get("author", "Flickr user"),
                        "license": "CC BY-SA",
                        "source": "flickr"
                    }
                    break
        except Exception:
            pass
        time.sleep(0.2)
    return result

def main():
    existing = json.load(open(IMAGES_PATH))
    print(f"Existing images: {len(existing)}", flush=True)
    new_images = {}

    # Wikipedia ship categories to crawl
    categories = [
        "Bulk carriers",
        "Ore carriers",
        "Capesize bulk carriers",
        "Panamax bulk carriers",
        "Handymax bulk carriers",
        "Container ships",
        "Oil tankers",
        "LNG carriers",
        "Chemical tankers",
        "General cargo ships",
        "Cable layer ships",
        "Heavy lift ships",
        "Ro-ro ships",
        "Cruise ships",
    ]

    all_titles = []
    for cat in categories:
        print(f"Category: {cat}", flush=True)
        members = get_wp_category_members(cat)
        titles = [m["title"] for m in members if ":" not in m["title"] or m["title"].startswith("MS ") or m["title"].startswith("MV ")]
        # Filter out obvious non-ship pages
        titles = [t for t in titles if not any(x in t.lower() for x in ["list of", "history of", "category:", "template:", "wikipedia:"])]
        print(f"  {len(titles)} ship articles", flush=True)
        all_titles.extend(titles)
        time.sleep(0.5)

    all_titles = list(set(all_titles))
    print(f"\nTotal unique ship articles: {len(all_titles)}", flush=True)

    # Process in batches of 20 (Wikipedia limit for revisions+images)
    batch_size = 20
    for i in range(0, len(all_titles), batch_size):
        batch = all_titles[i:i+batch_size]
        infos = get_pages_with_images(batch)
        # Only add if not already in existing
        for imo, info in infos.items():
            if imo not in existing:
                new_images[imo] = info
        if i % 200 == 0:
            print(f"  {i}/{len(all_titles)} processed, {len(new_images)} new", flush=True)
        time.sleep(0.4)

    print(f"\nWikipedia: {len(new_images)} new images found", flush=True)

    # Merge and save
    merged = {**existing, **new_images}
    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print(f"Total: {len(existing)} → {len(merged)} (+{len(merged)-len(existing)})", flush=True)

if __name__ == "__main__":
    main()
