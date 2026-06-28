#!/usr/bin/env python3
"""
wikidata_all_types.py — expanded Wikidata scraper for ALL ship types (not just bulk carriers)
Saves to /opt/bulkwatch/src/data/wikidata-ships.json (same target as wikidata_all.py)
Run only when Wikidata SPARQL is not rate-limited (HTTP 429).
"""
import json, time, urllib.request, urllib.parse, shutil

SPARQL_URL = "https://query.wikidata.org/sparql"
UA = "BulkWatchBot/2.0 (ships.gemivo.de; educational)"

TYPE_MAP = {
    # Bulk carriers
    "capesize": "Capesize", "valemax": "Valemax", "vloc": "VLOC",
    "newcastlemax": "Newcastlemax", "panamax bulk": "Panamax", "kamsarmax": "Kamsarmax",
    "handymax": "Handymax", "supramax": "Handymax", "ultramax": "Handymax",
    "handysize": "Handysize", "mini-bulker": "Mini-Bulker", "mini bulker": "Mini-Bulker",
    "ore carrier": "VLOC", "bulk carrier": "Bulk Carrier",
    # Tankers
    "vlcc": "VLCC", "ulcc": "ULCC", "suezmax": "Suezmax", "aframax": "Aframax",
    "chemical tanker": "Chemical Tanker", "product tanker": "Product Tanker",
    "lng carrier": "LNG Carrier", "lpg carrier": "LPG Carrier",
    "crude oil tanker": "Crude Tanker", "tanker": "Tanker",
    # Container
    "container ship": "Container Ship", "feeder": "Feeder",
    "neo-panamax": "Neo-Panamax", "ultra large container": "ULCV",
    # General cargo
    "general cargo": "General Cargo", "multipurpose": "Multipurpose",
    "reefer": "Reefer",
    # RoRo / passenger
    "ro-ro": "RoRo", "roro": "RoRo", "ropax": "RoPax",
    "cruise ship": "Cruise Ship", "passenger": "Passenger",
    "ferry": "Ferry",
    # Other
    "offshore supply": "OSV", "platform supply": "OSV",
    "cable layer": "Cable Ship", "research vessel": "Research Vessel",
    "heavy lift": "Heavy Lift", "dredger": "Dredger",
}

def infer_type(label):
    l = (label or "").lower()
    for k, v in TYPE_MAP.items():
        if k in l:
            return v
    return label.strip().title() if label and not label.startswith("Q") else "Cargo"

def sparql(query, retry=5):
    url = SPARQL_URL + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    for i in range(retry):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            wait = 70 if "429" in str(e) else 10
            print(f"  Retry {i+1}/{retry} after {wait}s: {e}", flush=True)
            if i < retry - 1:
                time.sleep(wait)
    return None

all_ships = {}
batch = 1000

for offset in range(0, 100000, batch):
    print(f"Offset {offset}...", flush=True)
    # wd:Q11446 = ship (all types), broader than wd:Q15276 (bulk carrier)
    q = f"""
SELECT DISTINCT ?imo ?shipLabel ?typeLabel ?yearBuilt ?flagLabel WHERE {{
  ?ship wdt:P31/wdt:P279* wd:Q11446 .
  ?ship wdt:P458 ?imo .
  OPTIONAL {{ ?ship wdt:P31 ?type . ?type rdfs:label ?typeLabel . FILTER(LANG(?typeLabel)="en") }}
  OPTIONAL {{ ?ship wdt:P571 ?yb . BIND(YEAR(?yb) AS ?yearBuilt) }}
  OPTIONAL {{ ?ship wdt:P17 ?flag . ?flag rdfs:label ?flagLabel . FILTER(LANG(?flagLabel)="en") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}} ORDER BY ?imo LIMIT {batch} OFFSET {offset}"""

    d = sparql(q)
    if not d:
        print("Failed, stopping.", flush=True)
        break
    rows = d.get("results", {}).get("bindings", [])
    if not rows:
        print("No more data.", flush=True)
        break

    added = 0
    for b in rows:
        imo = b.get("imo", {}).get("value", "").strip()
        if not imo or len(imo) != 7 or not imo.isdigit():
            continue
        name = b.get("shipLabel", {}).get("value", "").strip()
        if not name or name.startswith("Q"):
            continue
        if imo not in all_ships:
            yb = b.get("yearBuilt", {}).get("value", "")
            all_ships[imo] = {
                "imo": imo, "name": name,
                "type": infer_type(b.get("typeLabel", {}).get("value", "")),
                "yearBuilt": int(yb) if yb and yb.isdigit() else 0,
                "flag": b.get("flagLabel", {}).get("value", "") or "Unknown",
            }
            added += 1

    print(f"  +{added} new, total: {len(all_ships)}", flush=True)
    if added < 10:
        print("Nearly empty batch, stopping.", flush=True)
        break
    time.sleep(66)

print(f"\nTotal: {len(all_ships)} ships", flush=True)
out_path = "/opt/bulkwatch/src/data/wikidata-ships.json"
with open("/tmp/wikidata-all-types.json", "w") as f:
    json.dump(list(all_ships.values()), f, ensure_ascii=False)
shutil.copy("/tmp/wikidata-all-types.json", out_path)
print(f"Saved {len(all_ships)} ships to {out_path}", flush=True)
print("Now run: cd /opt/bulkwatch && bun run build && systemctl restart bulkwatch", flush=True)