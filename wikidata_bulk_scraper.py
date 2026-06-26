#!/usr/bin/env python3
"""
Wikidata Bulk Carrier Scraper
Holt alle Bulk Carrier mit IMO-Nummer aus Wikidata (14.000+ Schiffe).

Output:
  /tmp/wikidata-ships.json  — alle Schiffe mit IMO, Name, Typ, Baujahr, Flagge
  /tmp/wikidata-images.json — nur Schiffe die auch ein Wikimedia-Bild haben
"""

import json
import time
import urllib.request
import urllib.parse

SPARQL_URL = "https://query.wikidata.org/sparql"
USER_AGENT = "BulkWatchScraper/2.0 (https://ships.gemivo.de)"

# Wikidata-Subtyp-Mapping auf App-interne BulkCarrierType
SUBTYPE_MAP = {
    "capesize": "Capesize",
    "valemax": "Valemax",
    "vloc": "VLOC",
    "newcastlemax": "Newcastlemax",
    "panamax": "Panamax",
    "kamsarmax": "Kamsarmax",
    "post-panamax": "Post-Panamax",
    "handymax": "Handymax",
    "supramax": "Handymax",
    "ultramax": "Handymax",
    "handysize": "Handysize",
    "mini-bulker": "Mini-Bulker",
    "mini bulker": "Mini-Bulker",
    "ore carrier": "VLOC",
    "ore-bulk-oil": "VLOC",
}


def sparql_query(query):
    encoded = urllib.parse.urlencode({"query": query, "format": "json"})
    url = SPARQL_URL + "?" + encoded
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/sparql-results+json",
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f"  SPARQL-Fehler (Versuch {attempt+1}): {e}")
            if attempt < 3:
                time.sleep(70)
    return None


def infer_type(type_label):
    if not type_label:
        return "Handymax"
    tl = type_label.lower()
    for key, val in SUBTYPE_MAP.items():
        if key in tl:
            return val
    if "bulk" in tl:
        return "Handymax"
    return "Handymax"


def fetch_all_bulk_carriers(batch_size=1000, max_records=20000):
    """Holt alle Bulk Carrier aus Wikidata in Batches."""
    all_ships = {}
    offset = 0

    while offset < max_records:
        print(f"  Batch bei Offset {offset}...")
        query = f"""
SELECT DISTINCT ?imo ?shipLabel ?typeLabel ?yearBuilt ?flagLabel ?imageUrl WHERE {{
  ?ship wdt:P31/wdt:P279* wd:Q15276 .
  ?ship wdt:P458 ?imo .
  OPTIONAL {{
    ?ship wdt:P31 ?type .
    ?type wdt:P279* wd:Q15276 .
    ?type rdfs:label ?typeLabel .
    FILTER(LANG(?typeLabel) = "en")
  }}
  OPTIONAL {{ ?ship wdt:P571 ?yearBuilt }}
  OPTIONAL {{ ?ship wdt:P17 ?flag . ?flag rdfs:label ?flagLabel . FILTER(LANG(?flagLabel) = "en") }}
  OPTIONAL {{ ?ship wdt:P18 ?image . BIND(REPLACE(STR(?image), "http://commons.wikimedia.org/wiki/Special:FilePath/", "") AS ?imageFileName) }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}}
ORDER BY ?imo
LIMIT {batch_size}
OFFSET {offset}
"""
        data = sparql_query(query)
        if not data:
            print("  SPARQL-Fehler, breche ab.")
            break

        bindings = data.get("results", {}).get("bindings", [])
        if not bindings:
            print(f"  Keine Daten mehr bei Offset {offset}.")
            break

        for b in bindings:
            imo = b.get("imo", {}).get("value", "").strip()
            if not imo or len(imo) != 7 or not imo.isdigit():
                continue
            name = b.get("shipLabel", {}).get("value", "").strip()
            if not name or name.startswith("Q"):
                continue
            type_label = b.get("typeLabel", {}).get("value", "")
            year_raw = b.get("yearBuilt", {}).get("value", "")
            year_built = 0
            if year_raw:
                try:
                    year_built = int(year_raw[:4])
                except Exception:
                    pass
            flag = b.get("flagLabel", {}).get("value", "")
            image_url = b.get("imageUrl", {}).get("value", "")

            if imo not in all_ships:
                all_ships[imo] = {
                    "imo": imo,
                    "name": name,
                    "type": infer_type(type_label),
                    "yearBuilt": year_built,
                    "flag": flag or "Unknown",
                    "imageUrl": image_url,
                }
            else:
                # Daten ergänzen wenn leer
                existing = all_ships[imo]
                if not existing.get("yearBuilt") and year_built:
                    existing["yearBuilt"] = year_built
                if not existing.get("flag") and flag:
                    existing["flag"] = flag
                if not existing.get("imageUrl") and image_url:
                    existing["imageUrl"] = image_url

        print(f"  -> {len(bindings)} Einträge, gesamt: {len(all_ships)} Schiffe")
        offset += batch_size
        time.sleep(65)  # Wikidata-Rate-Limit respektieren

    return all_ships


def wikimedia_thumb(image_filename, width=640):
    """Generiert Thumbnail-URL aus Wikimedia-Dateinamen."""
    import hashlib
    name = image_filename.replace(" ", "_")
    h = hashlib.md5(name.encode()).hexdigest()
    encoded = urllib.parse.quote(name)
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "jpg"
    thumb_name = urllib.parse.quote(f"{width}px-{name}")
    return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{encoded}/{thumb_name}"


def main():
    print("=== Wikidata Bulk Carrier Scraper ===")
    print("Ziel: ~14.000 Bulk Carrier mit IMO\n")

    ships = fetch_all_bulk_carriers(batch_size=1000, max_records=20000)
    print(f"\nGesamtergebnis: {len(ships)} einzigartige Schiffe")

    # In JSON speichern
    ships_list = list(ships.values())
    with open("/tmp/wikidata-ships.json", "w") as f:
        json.dump(ships_list, f, ensure_ascii=False)
    print(f"Gespeichert: /tmp/wikidata-ships.json ({len(ships_list)} Schiffe)")

    # Nur Schiffe mit Bild (für ship-images.json)
    ships_with_image = {
        imo: {"name": s["name"], "type": s["type"], "yearBuilt": s["yearBuilt"], "flag": s["flag"]}
        for imo, s in ships.items()
        if s.get("imageUrl")
    }

    # Bestehende ship-images.json laden und erweitern
    import os
    existing_images = {}
    ship_images_path = "/opt/bulkwatch/src/data/ship-images.json"
    if os.path.exists(ship_images_path):
        with open(ship_images_path) as f:
            existing_images = json.load(f)
    print(f"Bestehende Bilder-Einträge: {len(existing_images)}")

    # Wikidata-Schiffe ohne eigenes Wikimedia-Bild trotzdem in wikidata-ships.json behalten
    print(f"Schiffe mit Wikidata-Bild: {len(ships_with_image)}")
    print(f"\nFertig! Verwende /tmp/wikidata-ships.json für die App-Integration.")


if __name__ == "__main__":
    main()
