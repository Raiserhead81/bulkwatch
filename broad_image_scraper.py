#!/usr/bin/env python3
"""
broad_image_scraper.py — Sucht Schiffsbilder breit auf Wikimedia Commons
Sucht nach "IMO 9XXXXXXX" Muster in Dateinamen um AIS-Schiffe abzudecken.
"""
import json, re, time, urllib.request, urllib.parse

API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"
AIS_PATH = "/opt/bulkwatch/src/data/ais-ships.json"

IMO_PATTERN = re.compile(r"IMO[_\s\-#]?(\d{7})", re.IGNORECASE)

def api_get(params, retries=4):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  Retry {attempt+1}/{retries} after {wait}s: {e}", flush=True)
            if attempt < retries - 1:
                time.sleep(wait)
    return None

def get_image_info(titles_batch):
    result = {}
    params = {
        "action": "query",
        "titles": "|".join(titles_batch),
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "960",
    }
    data = api_get(params)
    if not data:
        return result
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        title = page.get("title", "")
        imo_match = IMO_PATTERN.search(title)
        if not imo_match:
            continue
        imo = imo_match.group(1)
        infos = page.get("imageinfo", [])
        if not infos:
            continue
        info = infos[0]
        thumb = info.get("thumburl", "")
        if not thumb:
            continue
        meta = info.get("extmetadata", {})
        artist_raw = meta.get("Artist", {}).get("value", "")
        artist = re.sub(r"<[^>]+>", "", artist_raw).strip()[:80]
        license_val = meta.get("LicenseShortName", {}).get("value", "CC BY-SA")
        result[imo] = {
            "imageUrl": thumb,
            "artist": artist or "Unknown",
            "license": license_val,
        }
    return result

def main():
    existing = json.load(open(IMAGES_PATH))
    ais_data = json.load(open(AIS_PATH))
    ais_list = list(ais_data.values()) if isinstance(ais_data, dict) else ais_data

    # Get AIS IMOs that don't have images yet
    missing_imos = set(s["imo"] for s in ais_list if s["imo"] not in existing)
    print(f"AIS ships missing images: {len(missing_imos)}", flush=True)

    new_images = {}

    # Search categories that cover bulk carriers, tankers, container ships
    ship_categories = [
        "Bulk carriers (ships)",
        "Container ships",
        "Tankers",
        "Cargo ships",
        "General cargo ships",
        "Ore carriers",
        "Chemical tankers",
        "LNG carriers",
        "Handymax bulk carriers",
        "Panamax bulk carriers",
        "Capesize bulk carriers",
        "Supramax bulk carriers",
        "Handysize bulk carriers",
    ]

    all_files = []
    for cat in ship_categories:
        print(f"Category: {cat}", flush=True)
        # Paginate through category
        cmcontinue = None
        cat_count = 0
        while True:
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": f"Category:{cat}",
                "cmtype": "file",
                "cmlimit": "500",
            }
            if cmcontinue:
                params["cmcontinue"] = cmcontinue
            data = api_get(params)
            if not data:
                break
            members = data.get("query", {}).get("categorymembers", [])
            # Only keep files with IMO in title
            for m in members:
                title = m["title"]
                if IMO_PATTERN.search(title) and title not in all_files:
                    all_files.append(title)
            cat_count += len(members)
            cont = data.get("continue", {})
            cmcontinue = cont.get("cmcontinue")
            if not cmcontinue:
                break
            time.sleep(0.3)
        print(f"  {cat_count} files scanned", flush=True)
        time.sleep(0.5)

    all_files = list(set(all_files))
    print(f"\nFiles with IMO in title: {len(all_files)}", flush=True)

    # Process in batches
    batch_size = 50
    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        infos = get_image_info(batch)
        new_images.update(infos)
        if i % 500 == 0:
            print(f"  {i}/{len(all_files)} processed, {len(new_images)} found so far", flush=True)
        time.sleep(0.4)

    # Also do targeted search for AIS ships by IMO
    print(f"\nSearching directly for AIS IMOs without images...", flush=True)
    missing_sample = list(missing_imos)[:200]  # top 200 missing
    search_files = []
    for imo in missing_sample:
        params = {
            "action": "query",
            "list": "search",
            "srsearch": f"IMO {imo}",
            "srnamespace": "6",
            "srlimit": "5",
        }
        data = api_get(params)
        if data:
            hits = data.get("query", {}).get("search", [])
            for h in hits:
                if IMO_PATTERN.search(h["title"]) or imo in h["title"]:
                    search_files.append(h["title"])
        time.sleep(0.2)

    search_files = list(set(search_files))
    print(f"Direct IMO search: {len(search_files)} files", flush=True)
    for i in range(0, len(search_files), batch_size):
        batch = search_files[i:i+batch_size]
        infos = get_image_info(batch)
        new_images.update(infos)
        time.sleep(0.4)

    merged = {**existing, **new_images}
    print(f"\nNew images: {len(new_images)}", flush=True)
    print(f"Total: {len(merged)}", flush=True)

    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print("Saved to ship-images.json", flush=True)

if __name__ == "__main__":
    main()
