#!/usr/bin/env python3
"""
oldendorff_scraper.py — Sammelt alle Oldendorff-Schiffe aus Wikimedia Commons
Geht durch Category:Oldendorff Carriers → Unterkategorien → Bilder → IMO extrahieren
"""
import json, re, time, urllib.request, urllib.parse, hashlib

API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

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

def get_all_category_members(category, cmtype="subcat|file"):
    members = []
    cmcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": cmtype,
            "cmlimit": "500",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        data = api_get(params)
        if not data:
            break
        members.extend(data.get("query", {}).get("categorymembers", []))
        cont = data.get("continue", {})
        cmcontinue = cont.get("cmcontinue")
        if not cmcontinue:
            break
        time.sleep(0.5)
    return members

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
            # Try description
            infos = page.get("imageinfo", [])
            if infos:
                meta = infos[0].get("extmetadata", {})
                desc = meta.get("ImageDescription", {}).get("value", "")
                imo_match = IMO_PATTERN.search(desc)
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
    # Load existing images
    existing = json.load(open(IMAGES_PATH))
    print(f"Existing images: {len(existing)}", flush=True)
    new_images = {}

    # Step 1: Get all Oldendorff ship subcategories
    print("Getting Oldendorff subcategories...", flush=True)
    members = get_all_category_members("Oldendorff Carriers", "subcat")
    subcats = [m["title"].replace("Category:", "") for m in members]
    print(f"Found {len(subcats)} subcategories", flush=True)

    # Step 2: For each subcategory, get files
    all_files = []
    for cat in subcats:
        files = get_all_category_members(cat, "file")
        file_titles = [f["title"] for f in files if f["title"].startswith("File:")]
        all_files.extend(file_titles)
        print(f"  {cat}: {len(file_titles)} files", flush=True)
        time.sleep(0.3)

    # Also get files directly in Oldendorff Carriers category
    direct_files = get_all_category_members("Oldendorff Carriers", "file")
    all_files.extend([f["title"] for f in direct_files if f["title"].startswith("File:")])

    # Deduplicate
    all_files = list(set(all_files))
    print(f"Total unique files: {len(all_files)}", flush=True)

    # Step 3: Get image info in batches of 50
    batch_size = 50
    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        infos = get_image_info(batch)
        new_images.update(infos)
        print(f"  Processed {i+batch_size}/{len(all_files)}, found {len(infos)} with IMO", flush=True)
        time.sleep(0.5)

    # Step 4: Also do a text search for "Oldendorff" on Commons
    print("Text search for Oldendorff...", flush=True)
    search_continue = None
    search_files = []
    for search_term in ["Oldendorff IMO", "OLDENDORFF IMO"]:
        sroffset = 0
        while sroffset < 500:
            params = {
                "action": "query",
                "list": "search",
                "srsearch": search_term,
                "srnamespace": "6",
                "srlimit": "50",
                "sroffset": str(sroffset),
            }
            data = api_get(params)
            if not data:
                break
            hits = data.get("query", {}).get("search", [])
            if not hits:
                break
            search_files.extend([h["title"] for h in hits])
            sroffset += len(hits)
            if len(hits) < 50:
                break
            time.sleep(0.5)

    search_files = list(set(search_files))
    print(f"Text search found {len(search_files)} additional files", flush=True)
    for i in range(0, len(search_files), batch_size):
        batch = search_files[i:i+batch_size]
        infos = get_image_info(batch)
        new_images.update(infos)
        time.sleep(0.5)

    # Merge and save
    merged = {**existing, **new_images}
    print(f"\nNew images found: {len(new_images)}", flush=True)
    print(f"Total after merge: {len(merged)}", flush=True)

    # Show which Oldendorff ships got images
    olden_imos = {}
    for imo, info in new_images.items():
        olden_imos[imo] = info
    print(f"Oldendorff-related new entries: {len(olden_imos)}", flush=True)

    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print("Saved!", flush=True)

if __name__ == "__main__":
    main()
