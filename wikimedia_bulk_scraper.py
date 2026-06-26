#!/usr/bin/env python3
"""
Wikimedia Commons Bulk Carrier Scraper
Sammelt Schiffsbilder aus Wikimedia Commons und extrahiert IMO-Nummern.

Quellen:
1. Suchindex: "bulk carrier IMO" -> ~3885 Treffer
2. Kategorie-Mitglieder: Category:Bulk_carriers_(ships)
3. Unterkategorien (einzelne Schiffe)

Output: Erweiterte ship-images.json
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse

API = "https://commons.wikimedia.org/w/api.php"
SHIP_IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"
OUTPUT_PATH = "/tmp/ship-images-new.json"
USER_AGENT = "BulkWatchScraper/2.0 (https://ships.gemivo.de; contact@gemivo.de)"

IMO_PATTERN = re.compile(r"IMO[_\s\-]?(\d{7})", re.IGNORECASE)

def api_get(params, retries=3):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  API-Fehler (Versuch {attempt+1}): {e}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return None


def thumb_url(filename, width=960):
    """Generiert Wikimedia-Thumbnail-URL aus Dateinamen."""
    name = filename.replace("File:", "")
    name_encoded = urllib.parse.quote(name.replace(" ", "_"))
    # MD5-Hash der normalisierten Dateinamen (Wikimedia-Konvention)
    import hashlib
    h = hashlib.md5(name.replace(" ", "_").encode()).hexdigest()
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "jpg"
    thumb_name = urllib.parse.quote(f"{width}px-{name.replace(' ', '_')}")
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{name_encoded}/{thumb_name}"


def get_image_info(titles_batch):
    """Holt Bild-Metadaten (Artist, License, Thumbnail) für eine Liste von Titeln."""
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
        meta = info.get("extmetadata", {})
        artist_raw = meta.get("Artist", {}).get("value", "")
        artist = re.sub(r"<[^>]+>", "", artist_raw).strip()[:80]
        license_val = meta.get("LicenseShortName", {}).get("value", "CC BY-SA")
        obj_name = meta.get("ObjectName", {}).get("value", "")
        # Schiffsname aus Titel extrahieren
        ship_name = extract_ship_name(title, obj_name)
        if thumb and imo:
            result[imo] = {
                "imageUrl": thumb,
                "artist": artist or "Unknown",
                "license": license_val,
                "name": ship_name,
            }
    return result


def extract_ship_name(title, obj_name=""):
    """Extrahiert den Schiffsnamen aus dem Wikimedia-Dateititel."""
    name = title.replace("File:", "")
    # Häufige Muster
    patterns = [
        r"^([A-Z][A-Za-z\s\-\'\.]+?)\s+[-–]?\s*(?:IMO|bulk|Bulk)",
        r"^([\w\s\-\'\.]+?)\s+\((?:ship|vessel|bulk)",
        r"^(?:bulk\s*carrier\s+)?([A-Z][A-Za-z0-9\s\-\'\.]+?)\s+IMO",
        r"IMO[\s_-]?\d{7}[^A-Za-z]*[-–_\s]+([A-Za-z][\w\s\-\'\.]{2,40})",
    ]
    for pat in patterns:
        m = re.search(pat, name, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip(" -_.,")
            if len(candidate) >= 3 and len(candidate) <= 50:
                return candidate.title()

    # Fallback: obj_name
    if obj_name and 3 <= len(obj_name) <= 50:
        return obj_name

    # Letzter Fallback: ersten Teil des Dateinamens
    base = re.sub(r"\.[a-z]{3,4}$", "", name, flags=re.IGNORECASE)
    base = re.sub(r"IMO.*", "", base, flags=re.IGNORECASE).strip(" -_.,")
    words = base.split()[:4]
    candidate = " ".join(words).strip(" -_.,")
    return candidate if len(candidate) >= 3 else ""


def search_bulk_carrier_files(query, max_results=5000):
    """Sucht Dateien in Wikimedia Commons nach einem Suchbegriff."""
    files = []
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srnamespace": "6",
        "srlimit": "500",
    }
    fetched = 0
    while fetched < max_results:
        data = api_get(params)
        if not data:
            break
        hits = data.get("query", {}).get("search", [])
        files.extend(h["title"] for h in hits if IMO_PATTERN.search(h["title"]))
        fetched += len(hits)
        cont = data.get("continue", {}).get("sroffset")
        if cont is None or len(hits) == 0:
            break
        params["sroffset"] = cont
        time.sleep(0.3)
        if fetched % 1000 == 0:
            print(f"  Suche '{query}': {fetched} abgerufen, {len(files)} mit IMO...")
    return files


def get_category_files(cat_title, max_results=5000):
    """Holt alle Dateien aus einer Wikimedia-Kategorie."""
    files = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": cat_title,
        "cmtype": "file",
        "cmlimit": "500",
    }
    fetched = 0
    while fetched < max_results:
        data = api_get(params)
        if not data:
            break
        members = data.get("query", {}).get("categorymembers", [])
        files.extend(m["title"] for m in members if IMO_PATTERN.search(m["title"]))
        fetched += len(members)
        cont = data.get("continue", {}).get("cmcontinue")
        if cont is None or len(members) == 0:
            break
        params["cmcontinue"] = cont
        time.sleep(0.2)
    return files


def get_subcategory_first_images(cat_title, max_subs=2000):
    """Holt für jede Unterkategorie das erste Bild (für Schiff-Kategorien)."""
    file_candidates = []
    params = {
        "action": "query",
        "list": "categorymembers",
        "cmtitle": cat_title,
        "cmtype": "subcat",
        "cmlimit": "500",
    }
    sub_count = 0
    while sub_count < max_subs:
        data = api_get(params)
        if not data:
            break
        subs = data.get("query", {}).get("categorymembers", [])
        for sub in subs:
            sub_title = sub["title"]
            # Erstes Bild aus der Unterkategorie holen
            sub_files = get_category_files(sub_title, max_results=5)
            file_candidates.extend(sub_files)
            time.sleep(0.15)
        sub_count += len(subs)
        cont = data.get("continue", {}).get("cmcontinue")
        if cont is None or len(subs) == 0:
            break
        params["cmcontinue"] = cont
        print(f"  Unterkategorien: {sub_count} durchsucht, {len(file_candidates)} Dateien gefunden...")
    return file_candidates


def batch_image_info(file_titles, existing_imos, batch_size=25):
    """Holt Bild-Metadaten in Batches, überspringt bereits bekannte IMOs."""
    results = {}
    pending = []
    for title in file_titles:
        m = IMO_PATTERN.search(title)
        if m and m.group(1) not in existing_imos:
            pending.append(title)

    print(f"  {len(pending)} neue Dateien für Metadaten-Abfrage")
    for i in range(0, len(pending), batch_size):
        batch = pending[i:i+batch_size]
        info = get_image_info(batch)
        results.update(info)
        if i % (batch_size * 10) == 0:
            print(f"  Metadaten: {i}/{len(pending)} ({len(results)} neue Schiffe)...")
        time.sleep(0.3)
    return results


def main():
    # Bestehende ship-images.json laden
    existing = {}
    if os.path.exists(SHIP_IMAGES_PATH):
        with open(SHIP_IMAGES_PATH) as f:
            existing = json.load(f)
    print(f"Bestehende Einträge: {len(existing)}")

    all_files = []

    # Quelle 1: Suche "bulk carrier IMO"
    print("\n=== Phase 1: Suche 'bulk carrier IMO' ===")
    files1 = search_bulk_carrier_files("bulk carrier IMO", max_results=5000)
    print(f"  Gefunden: {len(files1)} Dateien mit IMO im Namen")
    all_files.extend(files1)

    # Quelle 2: Suche "bulker IMO"
    print("\n=== Phase 2: Suche 'bulker IMO' ===")
    files2 = search_bulk_carrier_files("bulker IMO", max_results=2000)
    print(f"  Gefunden: {len(files2)} Dateien")
    all_files.extend(files2)

    # Quelle 3: Kategorie-Dateien
    print("\n=== Phase 3: Kategorie-Dateien ===")
    categories = [
        "Category:Bulk_carriers_(ships)",
        "Category:Ore_carriers",
        "Category:Grain_ships",
    ]
    for cat in categories:
        files3 = get_category_files(cat, max_results=3000)
        print(f"  {cat}: {len(files3)} Dateien")
        all_files.extend(files3)
        time.sleep(0.5)

    # Deduplizieren
    unique_files = list(dict.fromkeys(all_files))
    print(f"\nGesamt: {len(unique_files)} eindeutige Dateien mit IMO im Namen")

    # Metadaten holen (nur neue)
    print("\n=== Phase 4: Metadaten abrufen ===")
    new_data = batch_image_info(unique_files, set(existing.keys()), batch_size=20)
    print(f"  {len(new_data)} neue Schiffe mit Bilddaten")

    # Mergen
    merged = {**existing, **new_data}
    print(f"\nGesamte Einträge nach Merge: {len(merged)}")

    # Speichern
    with open(OUTPUT_PATH, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"Gespeichert: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
