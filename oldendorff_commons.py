#!/usr/bin/env python3
"""
oldendorff_commons.py — Extrahiert komplette Oldendorff-Flotte aus Wikimedia Commons
Kein Wikidata SPARQL (aktuell outage), nutzt nur Commons-API.
Strategie:
1. Alle Unterkategorien von 'Oldendorff Carriers' → Schiffsnamen
2. Für jede Kategorie: Dateibeschreibungen durchsuchen nach IMO-Nummern
3. Schiffsnamen → IMO via Seiteninhalt (Commons page text)
"""
import json, time, urllib.request, urllib.parse, re

API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
OUTPUT_PATH = "/opt/bulkwatch/src/data/oldendorff-fleet.json"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

IMO_PATTERN = re.compile(r"\bIMO[_\s\-#:]*(\d{7})\b", re.IGNORECASE)
IMO_BARE = re.compile(r"\b(9\d{6})\b")  # 7-digit numbers starting with 9

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

def get_category_text(cat_title):
    """Gets the wikitext of a Commons category page."""
    d = api_get({
        "action": "query",
        "titles": f"Category:{cat_title}",
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
    })
    if not d:
        return ""
    pages = d.get("query", {}).get("pages", {})
    for page in pages.values():
        revs = page.get("revisions", [])
        if revs:
            slots = revs[0].get("slots", {})
            content = slots.get("main", {}).get("*", "") or revs[0].get("*", "")
            return content
    return ""

def get_file_text(file_title):
    """Gets the wikitext of a Commons file page."""
    d = api_get({
        "action": "query",
        "titles": file_title,
        "prop": "revisions",
        "rvprop": "content",
        "rvslots": "main",
    })
    if not d:
        return ""
    pages = d.get("query", {}).get("pages", {})
    for page in pages.values():
        revs = page.get("revisions", [])
        if revs:
            slots = revs[0].get("slots", {})
            return slots.get("main", {}).get("*", "") or revs[0].get("*", "")
    return ""

def find_imo_in_text(text):
    """Find IMO number in wikitext."""
    m = IMO_PATTERN.search(text)
    if m:
        return m.group(1)
    return None

def get_image_info_batch(titles):
    result = {}
    if not titles:
        return result
    params = {
        "action": "query",
        "titles": "|".join(titles[:50]),
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
        result[imo] = {"imageUrl": thumb, "artist": artist or "Unknown", "license": license_val}
    return result

def main():
    fleet = {}
    images_new = {}

    # Step 1: Get all subcategories
    print("Getting Oldendorff subcategories...", flush=True)
    d = api_get({"action": "query", "list": "categorymembers",
                 "cmtitle": "Category:Oldendorff Carriers", "cmtype": "subcat", "cmlimit": "500"})
    subcats = []
    if d:
        for m in d.get("query", {}).get("categorymembers", []):
            title = m["title"].replace("Category:", "")
            # Skip non-ship categories
            if "Hotel" in title or "Lübeck" in title:
                continue
            subcats.append(title)
    print(f"Found {len(subcats)} ship categories", flush=True)

    # Step 2: For each subcategory, get category page text and files
    for cat in subcats:
        print(f"\nProcessing: {cat}", flush=True)
        cat_imo = None

        # 2a: Try to get IMO from category page text
        text = get_category_text(cat)
        if text:
            cat_imo = find_imo_in_text(text)
            if cat_imo:
                print(f"  IMO from category page: {cat_imo}", flush=True)

        # 2b: Get files in this category
        d = api_get({"action": "query", "list": "categorymembers",
                     "cmtitle": f"Category:{cat}", "cmtype": "file", "cmlimit": "500"})
        files = []
        if d:
            files = [m["title"] for m in d.get("query", {}).get("categorymembers", [])
                     if m["title"].startswith("File:")]

        # 2c: Look for IMO in file titles
        for f in files:
            m = IMO_PATTERN.search(f)
            if m:
                cat_imo = m.group(1)
                print(f"  IMO from filename: {cat_imo}", flush=True)
                break

        # 2d: If still no IMO, check first file's text
        if not cat_imo and files:
            for f in files[:3]:
                ft = get_file_text(f)
                if ft:
                    cat_imo = find_imo_in_text(ft)
                    if cat_imo:
                        print(f"  IMO from file text: {cat_imo}", flush=True)
                        break
                time.sleep(0.2)

        # 2e: Get image info for files that have IMO in title
        img_files = [f for f in files if IMO_PATTERN.search(f)]
        if img_files:
            infos = get_image_info_batch(img_files)
            images_new.update(infos)

        # 2f: Also try best image from all files
        if cat_imo and files and cat_imo not in images_new:
            # Try to get image from first suitable file
            for f in files[:5]:
                infos = get_image_info_batch([f])
                if infos:
                    images_new.update(infos)
                    break
                # If no IMO in filename, manually associate
                info_params = {
                    "action": "query", "titles": f, "prop": "imageinfo",
                    "iiprop": "url|extmetadata", "iiurlwidth": "960",
                }
                img_data = api_get(info_params)
                if img_data:
                    pages = img_data.get("query", {}).get("pages", {})
                    for page in pages.values():
                        ii = page.get("imageinfo", [])
                        if ii and ii[0].get("thumburl"):
                            meta = ii[0].get("extmetadata", {})
                            artist_raw = meta.get("Artist", {}).get("value", "")
                            artist = re.sub(r"<[^>]+>", "", artist_raw).strip()[:80]
                            license_val = meta.get("LicenseShortName", {}).get("value", "CC BY-SA")
                            images_new[cat_imo] = {
                                "imageUrl": ii[0]["thumburl"],
                                "artist": artist or "Unknown",
                                "license": license_val
                            }
                            break
                if cat_imo in images_new:
                    break
                time.sleep(0.2)

        # Extract ship name from category title
        # "Sophie Oldendorff (ship, 2010)" -> "SOPHIE OLDENDORFF"
        ship_name = re.sub(r"\s*\(ship,?\s*\d{4}\)\s*$", "", cat, flags=re.IGNORECASE).upper()

        if cat_imo:
            fleet[cat_imo] = {
                "imo": cat_imo,
                "name": ship_name,
                "operator": "Oldendorff Carriers",
                "type": "Bulk Carrier",
                "files": len(files)
            }
        else:
            print(f"  No IMO found for {cat}", flush=True)
            fleet[f"unknown_{cat[:20]}"] = {
                "imo": "",
                "name": ship_name,
                "operator": "Oldendorff Carriers",
                "type": "Bulk Carrier",
                "files": len(files)
            }

        time.sleep(0.5)

    # Step 3: Also search for "OLDENDORFF" in Commons file descriptions
    print("\n=== Step 3: Text search for Oldendorff vessels ===", flush=True)
    for term in ["Oldendorff IMO 9", "\"Oldendorff\" ship IMO"]:
        sroffset = 0
        while sroffset < 500:
            d = api_get({
                "action": "query", "list": "search", "srsearch": term,
                "srnamespace": "6", "srlimit": "50", "sroffset": str(sroffset)
            })
            if not d:
                break
            hits = d.get("query", {}).get("search", [])
            if not hits:
                break
            file_titles = [h["title"] for h in hits]
            infos = get_image_info_batch(file_titles)
            for imo, info in infos.items():
                images_new[imo] = info
                if imo not in fleet:
                    # Try to get ship name from image
                    fleet[imo] = {"imo": imo, "name": "", "operator": "Oldendorff Carriers", "type": "Bulk Carrier"}
            sroffset += len(hits)
            if len(hits) < 50:
                break
            time.sleep(0.5)

    # Step 4: Summary
    known_fleet = {k: v for k, v in fleet.items() if v["imo"] and not k.startswith("unknown_")}
    unknown_fleet = {k: v for k, v in fleet.items() if k.startswith("unknown_")}

    print(f"\n=== Results ===", flush=True)
    print(f"Ships with IMO: {len(known_fleet)}", flush=True)
    print(f"Ships without IMO: {len(unknown_fleet)}", flush=True)
    print(f"New images: {len(images_new)}", flush=True)
    print("\nFleet list:", flush=True)
    for imo, s in sorted(known_fleet.items(), key=lambda x: x[1]["name"]):
        has_img = "📷" if imo in images_new else "  "
        print(f"  {has_img} {s['name']:<40} IMO: {imo}", flush=True)
    if unknown_fleet:
        print(f"\nShips without IMO:", flush=True)
        for k, s in unknown_fleet.items():
            print(f"  - {s['name']}", flush=True)

    # Save
    with open(OUTPUT_PATH, "w") as f:
        json.dump({**known_fleet, **unknown_fleet}, f, indent=2, ensure_ascii=False)
    print(f"\nFleet saved to {OUTPUT_PATH}", flush=True)

    existing_images = json.load(open(IMAGES_PATH))
    merged = {**existing_images, **images_new}
    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print(f"Images: {len(existing_images)} → {len(merged)} (+{len(merged)-len(existing_images)})", flush=True)

if __name__ == "__main__":
    main()
