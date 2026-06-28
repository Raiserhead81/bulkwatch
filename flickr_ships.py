#!/usr/bin/env python3
"""
flickr_ships.py — Holt CC-lizenzierte Schiffsbilder von Flickr
Strategie:
1. Flickr public feed mit verschiedenen Tags durchsuchen
2. IMO-Nummern aus Titeln extrahieren
3. Große Version (b.jpg) der Bilder verwenden
"""
import json, time, re, urllib.request, urllib.parse

UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

IMO_PATTERN = re.compile(r"\bIMO[_\s\-#:]*(\d{7})\b", re.IGNORECASE)

def flickr_feed(tags, retries=3):
    url = "https://api.flickr.com/services/feeds/photos_public.gne?" + urllib.parse.urlencode({
        "tags": tags, "format": "json", "nojsoncallback": "1"
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(3)
    return None

def extract_imo(text):
    m = IMO_PATTERN.search(text)
    return m.group(1) if m else None

def get_large_url(medium_url):
    """Convert _m.jpg to _b.jpg for large size."""
    if "_m.jpg" in medium_url:
        return medium_url.replace("_m.jpg", "_b.jpg")
    if "_n.jpg" in medium_url:
        return medium_url.replace("_n.jpg", "_b.jpg")
    return medium_url

def main():
    existing = json.load(open(IMAGES_PATH))
    print(f"Existing: {len(existing)}", flush=True)
    new_images = {}

    # Search terms that ship photographers use on Flickr
    search_terms = [
        "bulk carrier IMO",
        "cargo ship IMO",
        "container ship IMO",
        "tanker ship IMO",
        "ore carrier IMO",
        "vessel IMO",
        "ship IMO port",
        "bulkcarrier IMO",
        "bulker IMO",
        "IJmuiden ship IMO",  # Dutch photographers often include IMO
        "Rotterdam ship IMO",
        "Hamburg ship IMO",
        "Antwerp ship IMO",
        "shipspotting IMO",
    ]

    for term in search_terms:
        print(f"Searching: {term}", flush=True)
        d = flickr_feed(term)
        if not d:
            continue
        items = d.get("items", [])
        found = 0
        for item in items:
            title = item.get("title", "")
            desc = item.get("description", "")
            combined = title + " " + desc
            imo = extract_imo(combined)
            if not imo:
                continue
            if imo in existing or imo in new_images:
                continue
            img_url = get_large_url(item.get("media", {}).get("m", ""))
            if not img_url:
                continue
            author = item.get("author_id", "")
            new_images[imo] = {
                "imageUrl": img_url,
                "artist": item.get("author", "Flickr contributor").replace("nobody@flickr.com (", "").rstrip(")"),
                "license": "CC BY-SA 2.0",
                "source": "flickr",
            }
            found += 1
        print(f"  {len(items)} items, {found} new", flush=True)
        time.sleep(1)

    # Also try searching by tag combinations that ship photographers use
    ship_port_tags = [
        "bulk carrier,port,IMO",
        "cargo ship,port,IMO",
        "containership,IMO",
        "tanker,IMO,vessel",
        "shipspotting,IMO",
        "shipspotter,IMO",
        "vessel,IMO,7digits",
    ]

    for tags in ship_port_tags:
        d = flickr_feed(tags)
        if not d:
            time.sleep(1)
            continue
        items = d.get("items", [])
        found = 0
        for item in items:
            title = item.get("title", "")
            desc = item.get("description", "")
            combined = title + " " + desc
            imo = extract_imo(combined)
            if not imo or imo in existing or imo in new_images:
                continue
            img_url = get_large_url(item.get("media", {}).get("m", ""))
            if not img_url:
                continue
            new_images[imo] = {
                "imageUrl": img_url,
                "artist": item.get("author", "Flickr contributor").replace("nobody@flickr.com (", "").rstrip(")"),
                "license": "CC BY-SA 2.0",
                "source": "flickr",
            }
            found += 1
        print(f"Tags '{tags}': {len(items)} items, {found} new", flush=True)
        time.sleep(1)

    merged = {**existing, **new_images}
    print(f"\nFlickr: {len(new_images)} new images", flush=True)
    print(f"Total: {len(existing)} → {len(merged)}", flush=True)

    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print("Saved!", flush=True)

if __name__ == "__main__":
    main()
