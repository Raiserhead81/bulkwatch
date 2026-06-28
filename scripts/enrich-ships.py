#!/usr/bin/env python3
"""Vessel data enricher — fetches specs + operator from Wikidata SPARQL."""
import sqlite3, urllib.request, urllib.parse, json, time, sys

DB = "/opt/bulkwatch/db/ships.db"
BATCH = 200  # Wikidata SPARQL allows batches
DELAY = 1.0

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "VesselDB/1.0 (hallo@gemivo.de)"

def query_wikidata(imos):
    """Query Wikidata for ship specs by IMO numbers."""
    values = " ".join(f'"{imo}"' for imo in imos)
    sparql = f"""
    SELECT ?imo ?name ?dwt ?length ?beam ?draft ?yearBuilt ?flag ?flagLabel
           ?operator ?operatorLabel ?builder ?builderLabel ?shipClass
    WHERE {{
      VALUES ?imo {{ {values} }}
      ?ship wdt:P458 ?imo .
      OPTIONAL {{ ?ship rdfs:label ?name . FILTER(LANG(?name) = "en") }}
      OPTIONAL {{ ?ship wdt:P1093 ?dwt }}
      OPTIONAL {{ ?ship wdt:P2043 ?length }}
      OPTIONAL {{ ?ship wdt:P2261 ?beam }}
      OPTIONAL {{ ?ship wdt:P2262 ?draft }}
      OPTIONAL {{ ?ship wdt:P729 ?launchDate }}
      OPTIONAL {{ ?ship wdt:P571 ?inception }}
      OPTIONAL {{ ?ship wdt:P8047 ?operator }}
      OPTIONAL {{ ?ship wdt:P176 ?builder }}
      OPTIONAL {{ ?ship wdt:P17 ?flag }}
      OPTIONAL {{ ?ship wdt:P289 ?shipClass }}
      BIND(YEAR(COALESCE(?launchDate, ?inception)) AS ?yearBuilt)
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,de" }}
    }}
    """
    url = WIKIDATA_SPARQL + "?" + urllib.parse.urlencode({"query": sparql, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"  Wikidata error: {e}", file=sys.stderr, flush=True)
        return []

def main():
    db = sqlite3.connect(DB)

    # Get ships without specs
    ships = db.execute(
        "SELECT imo FROM ships WHERE (dwt = 0 OR dwt IS NULL) ORDER BY RANDOM() LIMIT 5000"
    ).fetchall()
    imos = [r[0] for r in ships]

    print(f"Enriching {len(imos)} ships via Wikidata...", flush=True)
    updated = 0
    operators_found = 0

    for i in range(0, len(imos), BATCH):
        batch = imos[i:i+BATCH]
        if i % 1000 == 0:
            print(f"  [{i}/{len(imos)}] updated={updated} operators={operators_found}", flush=True)

        results = query_wikidata(batch)

        for r in results:
            imo = r.get("imo", {}).get("value", "")
            if not imo:
                continue

            updates = []
            params = []

            dwt = r.get("dwt", {}).get("value")
            if dwt:
                try:
                    updates.append("dwt = ?")
                    params.append(int(float(dwt)))
                except: pass

            length = r.get("length", {}).get("value")
            if length:
                try:
                    updates.append("length = ?")
                    params.append(float(length))
                except: pass

            beam = r.get("beam", {}).get("value")
            if beam:
                try:
                    updates.append("beam = ?")
                    params.append(float(beam))
                except: pass

            draft = r.get("draft", {}).get("value")
            if draft:
                try:
                    updates.append("draft = ?")
                    params.append(float(draft))
                except: pass

            year = r.get("yearBuilt", {}).get("value")
            if year:
                try:
                    y = int(year)
                    if 1900 < y < 2030:
                        updates.append("year_built = ?")
                        params.append(y)
                except: pass

            operator = r.get("operatorLabel", {}).get("value")
            if operator and not operator.startswith("Q"):
                updates.append("operator = ?")
                params.append(operator)
                operators_found += 1

            builder = r.get("builderLabel", {}).get("value")
            if builder and not builder.startswith("Q"):
                updates.append("builder = ?")
                params.append(builder)

            flag = r.get("flagLabel", {}).get("value")
            if flag and not flag.startswith("Q"):
                updates.append("flag = ?")
                params.append(flag)

            if updates:
                params.append(imo)
                sql = f"UPDATE ships SET {', '.join(updates)} WHERE imo = ? AND (dwt = 0 OR dwt IS NULL)"
                db.execute(sql, params)
                updated += 1

        db.commit()
        time.sleep(DELAY)

    db.close()
    print(f"\nDone! Updated {updated} ships, found {operators_found} operators", flush=True)

if __name__ == "__main__":
    main()
