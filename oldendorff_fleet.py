#!/usr/bin/env python3
"""
oldendorff_fleet.py — Holt die komplette Oldendorff-Flotte aus Wikidata + Wikimedia
Respektiert Wikidata-Rate-Limit: 1 req/min
Ergebnis: /opt/bulkwatch/src/data/oldendorff-fleet.json
"""
import json, time, urllib.request, urllib.parse, re

SPARQL_URL = "https://query.wikidata.org/sparql"
API = "https://commons.wikimedia.org/w/api.php"
UA = "VesselDBBot/1.0 (vessels.gemivo.de; contact@gemivo.de)"
OUTPUT_PATH = "/opt/bulkwatch/src/data/oldendorff-fleet.json"
IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

IMO_PATTERN = re.compile(r"IMO[_\s\-#]?(\d{7})", re.IGNORECASE)

def sparql_query(q, retries=3):
    url = SPARQL_URL + "?" + urllib.parse.urlencode({"query": q, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  Error attempt {attempt+1}: {e}", flush=True)
            if "429" in str(e):
                print("  Rate limited, waiting 70s...", flush=True)
                time.sleep(70)
            elif attempt < retries - 1:
                time.sleep(10)
    return None

def commons_api(params, retries=3):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  Commons error: {e}", flush=True)
            time.sleep(5)
    return None

def get_image_info_batch(titles):
    result = {}
    params = {
        "action": "query",
        "titles": "|".join(titles),
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "960",
    }
    data = commons_api(params)
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

    print("=== Step 1: Wikidata — ships operated by Oldendorff (Q2018988) ===", flush=True)
    # Q2018988 = Oldendorff Carriers
    # Try multiple operator predicates
    q1 = """
SELECT DISTINCT ?imo ?shipLabel ?image ?yearBuilt ?flagLabel ?typeLabel WHERE {
  {
    ?ship wdt:P137 wd:Q2018988 .
  } UNION {
    ?ship wdt:P18 ?image .
    ?ship wdt:P137 wd:Q2018988 .
  }
  ?ship wdt:P458 ?imo .
  OPTIONAL { ?ship wdt:P18 ?image }
  OPTIONAL { ?ship wdt:P571 ?yb . BIND(YEAR(?yb) AS ?yearBuilt) }
  OPTIONAL { ?ship wdt:P17 ?flag . ?flag rdfs:label ?flagLabel . FILTER(LANG(?flagLabel)="en") }
  OPTIONAL { ?ship wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel)="en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
"""
    data = sparql_query(q1)
    if data:
        results = data.get("results", {}).get("bindings", [])
        print(f"  Operator query: {len(results)} results", flush=True)
        for r in results:
            imo = r["imo"]["value"]
            name = r.get("shipLabel", {}).get("value", "")
            img = r.get("image", {}).get("value", "")
            year = r.get("yearBuilt", {}).get("value", "")
            flag = r.get("flagLabel", {}).get("value", "")
            ship_type = r.get("typeLabel", {}).get("value", "Bulk Carrier")
            if imo not in fleet:
                fleet[imo] = {"imo": imo, "name": name, "yearBuilt": year, "flag": flag, "type": ship_type, "operator": "Oldendorff Carriers", "image": img}
            if img:
                images_new[imo] = {"imageUrl": img, "artist": "Wikimedia", "license": "CC BY-SA"}
        print(f"  Fleet so far: {len(fleet)} ships", flush=True)
    else:
        print("  Wikidata query failed", flush=True)

    print("\nWaiting 70s for Wikidata rate limit...", flush=True)
    time.sleep(70)

    print("=== Step 2: Wikidata — ships with 'Oldendorff' in name ===", flush=True)
    q2 = """
SELECT DISTINCT ?imo ?shipLabel ?image ?yearBuilt ?flagLabel WHERE {
  ?ship wdt:P458 ?imo .
  ?ship rdfs:label ?shipLabel .
  FILTER(CONTAINS(LCASE(STR(?shipLabel)), "oldendorff"))
  FILTER(LANG(?shipLabel) = "en")
  OPTIONAL { ?ship wdt:P18 ?image }
  OPTIONAL { ?ship wdt:P571 ?yb . BIND(YEAR(?yb) AS ?yearBuilt) }
  OPTIONAL { ?ship wdt:P17 ?flag . ?flag rdfs:label ?flagLabel . FILTER(LANG(?flagLabel)="en") }
}
"""
    data = sparql_query(q2)
    if data:
        results = data.get("results", {}).get("bindings", [])
        print(f"  Name search: {len(results)} results", flush=True)
        for r in results:
            imo = r["imo"]["value"]
            name = r.get("shipLabel", {}).get("value", "")
            img = r.get("image", {}).get("value", "")
            year = r.get("yearBuilt", {}).get("value", "")
            flag = r.get("flagLabel", {}).get("value", "")
            if imo not in fleet:
                fleet[imo] = {"imo": imo, "name": name, "yearBuilt": year, "flag": flag, "type": "Bulk Carrier", "operator": "Oldendorff Carriers", "image": img}
            if img:
                images_new[imo] = {"imageUrl": img, "artist": "Wikimedia", "license": "CC BY-SA"}
        print(f"  Fleet total: {len(fleet)} ships", flush=True)
    else:
        print("  Name query failed", flush=True)

    print("\n=== Step 3: Commons — extract IMOs from Oldendorff category files ===", flush=True)
    # Get all image files from Oldendorff categories and try to get IMO
    all_files = []
    # Get subcategories
    params = {
        "action": "query", "list": "categorymembers",
        "cmtitle": "Category:Oldendorff Carriers",
        "cmtype": "subcat", "cmlimit": "500",
    }
    d = commons_api(params)
    subcats = [m["title"].replace("Category:", "") for m in d.get("query", {}).get("categorymembers", [])] if d else []

    for cat in subcats:
        d = commons_api({"action": "query", "list": "categorymembers", "cmtitle": f"Category:{cat}", "cmtype": "file", "cmlimit": "500"})
        if d:
            files = [m["title"] for m in d.get("query", {}).get("categorymembers", []) if m["title"].startswith("File:")]
            all_files.extend(files)
        time.sleep(0.3)

    all_files = list(set(all_files))
    print(f"  Total files in categories: {len(all_files)}", flush=True)

    # Get image info to extract IMOs
    batch_size = 50
    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        infos = get_image_info_batch(batch)
        images_new.update(infos)
        # Also add to fleet
        for imo in infos:
            if imo not in fleet:
                fleet[imo] = {"imo": imo, "name": "", "operator": "Oldendorff Carriers", "type": "Bulk Carrier"}
        time.sleep(0.3)

    # Try to find IMOs from file descriptions for files without IMO in title
    # Search Commons page text for Oldendorff ships
    print("\n=== Step 4: Text search for more Oldendorff IMOs ===", flush=True)
    for term in ["Oldendorff IMO", "oldendorff imo 9"]:
        sroffset = 0
        while sroffset < 300:
            d = commons_api({
                "action": "query", "list": "search", "srsearch": term,
                "srnamespace": "6", "srlimit": "50", "sroffset": str(sroffset)
            })
            if not d:
                break
            hits = d.get("query", {}).get("search", [])
            if not hits:
                break
            file_titles = [h["title"] for h in hits]
            # Get image info for these
            infos = get_image_info_batch(file_titles)
            images_new.update(infos)
            for imo in infos:
                if imo not in fleet:
                    fleet[imo] = {"imo": imo, "name": "", "operator": "Oldendorff Carriers", "type": "Bulk Carrier"}
            sroffset += len(hits)
            if len(hits) < 50:
                break
            time.sleep(0.5)

    # Save fleet
    print(f"\n=== Results ===", flush=True)
    print(f"Total Oldendorff ships found: {len(fleet)}", flush=True)
    print(f"New images: {len(images_new)}", flush=True)

    for imo, s in sorted(fleet.items(), key=lambda x: x[1].get("name", "")):
        print(f"  {s.get('name', '?'):<40} IMO: {imo}", flush=True)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(fleet, f, indent=2)
    print(f"Fleet saved to {OUTPUT_PATH}", flush=True)

    # Merge images
    existing_images = json.load(open(IMAGES_PATH))
    merged = {**existing_images, **images_new}
    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)
    print(f"Images updated: {len(existing_images)} → {len(merged)}", flush=True)

if __name__ == "__main__":
    main()
