#!/usr/bin/env python3
"""
Wikimedia Commons Bulk Carrier Unterkategorien-Scraper
Holt alle 1489 Schiff-Unterkategorien aus Category:Bulk_carriers_(ships).
Für jede Unterkategorie: Name + erstes Bild + IMO (aus Dateinamen falls vorhanden).

Output: Erweiterte /opt/bulkwatch/src/data/ship-images.json
"""

import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "BulkWatchScraper/2.0 (https://ships.gemivo.de)"
SHIP_IMAGES_PATH = "/opt/bulkwatch/src/data/ship-images.json"

IMO_RE = re.compile(r"IMO[_\s\-]?(\d{7})", re.I)
YEAR_RE = re.compile(r",\s*(\d{4})\)?\s*$")
NAME_RE = re.compile(r"^Category:(.+?)(?:\s*\(ship[,\s]|\s*\(vessel)", re.I)


def api(params, retries=3):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  API-Fehler ({i+1}): {e}")
            if i < retries - 1:
                time.sleep(3)
    return None


def get_subcategories(cat, max_n=2000):
    cats = []
    params = {"action": "query", "list": "categorymembers",
              "cmtitle": cat, "cmtype": "subcat", "cmlimit": "500"}
    while len(cats) < max_n:
        d = api(params)
        if not d:
            break
        members = d.get("query", {}).get("categorymembers", [])
        cats.extend(members)
        cont = d.get("continue", {}).get("cmcontinue")
        if not cont or not members:
            break
        params["cmcontinue"] = cont
        time.sleep(0.3)
    return cats


def get_first_file(cat_title):
    """Holt den ersten Dateinamen aus einer Kategorie."""
    d = api({"action": "query", "list": "categorymembers",
              "cmtitle": cat_title, "cmtype": "file", "cmlimit": "5"})
    if not d:
        return None
    members = d.get("query", {}).get("categorymembers", [])
    for m in members:
        t = m.get("title", "")
        if re.search(r"\.(jpg|jpeg|png|svg|webp)$", t, re.I):
            return t
    return None


def thumb_url(filename, width=800):
    name = filename.replace("File:", "").replace(" ", "_")
    h = hashlib.md5(name.encode()).hexdigest()
    enc = urllib.parse.quote(name)
    thumb = urllib.parse.quote(f"{width}px-{name}")
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{enc}/{thumb}"


def get_image_meta(file_title):
    d = api({"action": "query", "titles": file_title,
              "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "800"})
    if not d:
        return None, None, None
    pages = d.get("query", {}).get("pages", {})
    for page in pages.values():
        infos = page.get("imageinfo", [])
        if not infos:
            continue
        info = infos[0]
        thumb = info.get("thumburl", "")
        meta = info.get("extmetadata", {})
        artist_raw = meta.get("Artist", {}).get("value", "")
        artist = re.sub(r"<[^>]+>", "", artist_raw).strip()[:80]
        lic = meta.get("LicenseShortName", {}).get("value", "CC BY-SA")
        return thumb, artist or "Unknown", lic
    return None, None, None


def extract_name_year(cat_title):
    """Extrahiert Schiffsname und Baujahr aus Kategorientitel wie 'Category:Berge Stahl (ship, 1986)'."""
    m = NAME_RE.search(cat_title)
    name = m.group(1).strip() if m else cat_title.replace("Category:", "").strip()
    # Baujahr
    y = YEAR_RE.search(cat_title)
    year = int(y.group(1)) if y else 0
    return name, year


def main():
    # Bestehende ship-images.json laden
    existing = {}
    if os.path.exists(SHIP_IMAGES_PATH):
        with open(SHIP_IMAGES_PATH) as f:
            existing = json.load(f)
    print(f"Bestehende Einträge: {len(existing)}")

    # Unterkategorien holen
    print("\n=== Lade Unterkategorien ===")
    subcats = get_subcategories("Category:Bulk_carriers_(ships)", max_n=2000)
    print(f"Gefundene Unterkategorien: {len(subcats)}")

    new_ships = {}
    no_imo_ships = []  # Schiffe ohne IMO im Dateinamen
    skip_count = 0

    for i, sub in enumerate(subcats):
        cat_title = sub["title"]
        name, year = extract_name_year(cat_title)

        if i % 50 == 0:
            print(f"  [{i}/{len(subcats)}] {len(new_ships)} neue Schiffe, {len(no_imo_ships)} ohne IMO...")

        # Erstes Bild holen
        file_title = get_first_file(cat_title)
        if not file_title:
            skip_count += 1
            time.sleep(0.1)
            continue

        # IMO aus Dateinamen versuchen
        imo_match = IMO_RE.search(file_title)

        if imo_match:
            imo = imo_match.group(1)
            if imo in existing or imo in new_ships:
                skip_count += 1
                time.sleep(0.1)
                continue
            # Bild-Metadaten holen
            thumb, artist, license_val = get_image_meta(file_title)
            if thumb:
                new_ships[imo] = {
                    "imageUrl": thumb,
                    "artist": artist,
                    "license": license_val,
                    "name": name,
                    "yearBuilt": year,
                }
        else:
            # Kein IMO im Dateinamen — trotzdem Bild speichern
            # Schlüssel: Hash aus Kategorientitel
            key = f"cat-{hashlib.md5(cat_title.encode()).hexdigest()[:12]}"
            if key not in existing and key not in new_ships:
                thumb, artist, license_val = get_image_meta(file_title)
                if thumb:
                    no_imo_ships.append({
                        "key": key,
                        "name": name,
                        "yearBuilt": year,
                        "imageUrl": thumb,
                        "artist": artist or "Unknown",
                        "license": license_val or "CC BY-SA",
                    })

        time.sleep(0.25)

    print(f"\nErgebnis:")
    print(f"  Neue Schiffe mit IMO: {len(new_ships)}")
    print(f"  Schiffe ohne IMO: {len(no_imo_ships)}")
    print(f"  Übersprungen: {skip_count}")

    # Mergen
    merged = {**existing, **new_ships}

    # Schiffe ohne IMO auch hinzufügen (mit generiertem Schlüssel)
    for s in no_imo_ships:
        merged[s["key"]] = {
            "imageUrl": s["imageUrl"],
            "artist": s["artist"],
            "license": s["license"],
            "name": s["name"],
            "yearBuilt": s["yearBuilt"],
            "noImo": True,
        }

    print(f"\nGesamte Einträge nach Merge: {len(merged)}")

    # Backup der alten Datei
    import shutil
    if os.path.exists(SHIP_IMAGES_PATH):
        shutil.copy(SHIP_IMAGES_PATH, SHIP_IMAGES_PATH + ".bak")

    # Speichern
    with open(SHIP_IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"Gespeichert: {SHIP_IMAGES_PATH}")
    print("Backup: " + SHIP_IMAGES_PATH + ".bak")


if __name__ == "__main__":
    main()
