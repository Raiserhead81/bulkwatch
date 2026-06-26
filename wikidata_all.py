#!/usr/bin/env python3
import json, time, urllib.request, urllib.parse, sys

SPARQL_URL = "https://query.wikidata.org/sparql"
UA = "BulkWatchBot/2.0 (ships.gemivo.de; educational)"

SUBTYPE_MAP = {
    "capesize": "Capesize", "valemax": "Valemax", "vloc": "VLOC",
    "newcastlemax": "Newcastlemax", "panamax": "Panamax", "kamsarmax": "Kamsarmax",
    "post-panamax": "Post-Panamax", "handymax": "Handymax", "supramax": "Handymax",
    "ultramax": "Handymax", "handysize": "Handysize", "mini-bulker": "Mini-Bulker",
    "mini bulker": "Mini-Bulker", "ore carrier": "VLOC", "bulk carrier": "Handymax",
    "gearless": "Gearless", "geared": "Geared",
}

def infer_type(label):
    l = (label or "").lower()
    for k, v in SUBTYPE_MAP.items():
        if k in l:
            return v
    return "Handymax"

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

for offset in range(0, 20000, batch):
    print(f"Offset {offset}...", flush=True)
    q = f"""
SELECT DISTINCT ?imo ?shipLabel ?typeLabel ?yearBuilt ?flagLabel WHERE {{
  ?ship wdt:P31/wdt:P279* wd:Q15276 .
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
    time.sleep(66)

print(f"\nTotal: {len(all_ships)} ships", flush=True)
with open("/tmp/wikidata-all.json", "w") as f:
    json.dump(list(all_ships.values()), f, ensure_ascii=False)
print("Saved /tmp/wikidata-all.json", flush=True)

# Copy to app data dir
import shutil
shutil.copy("/tmp/wikidata-all.json", "/opt/bulkwatch/src/data/wikidata-ships.json")
print("Copied to /opt/bulkwatch/src/data/wikidata-ships.json", flush=True)
print("Now run: cd /opt/bulkwatch && bun run build && systemctl restart bulkwatch", flush=True)
