#!/usr/bin/env python3
"""Fetch builder/shipyard + country of build from Wikidata for all ships.
Uses SPARQL to bulk-query by IMO number. Free, no login, no rate limit issues."""
import sqlite3, json, urllib.request, urllib.parse, time

DB = "/opt/bulkwatch/db/ships.db"
SPARQL_URL = "https://query.wikidata.org/sparql"
UA = "BulkWatch/2.0 (https://vessels.gemivo.de; hallo@gemivo.de)"
BATCH = 500  # Wikidata handles big queries well


def query_wikidata(offset=0, limit=5000):
    """Get all ships with builder info from Wikidata."""
    query = f"""
    SELECT ?imo ?builderLabel ?countryLabel WHERE {{
      ?ship wdt:P458 ?imo .
      ?ship wdt:P176 ?builder .
      OPTIONAL {{ ?builder wdt:P17 ?country . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
    }}
    LIMIT {limit} OFFSET {offset}
    """
    url = SPARQL_URL + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    data = json.loads(urllib.request.urlopen(req, timeout=60).read())
    return data["results"]["bindings"]


def main():
    con = sqlite3.connect(DB)
    con.execute("PRAGMA journal_mode=WAL")

    # Get all IMOs in our DB that need builder
    our_imos = set()
    for row in con.execute("SELECT imo FROM ships WHERE imo NOT LIKE 'cat-%' AND (builder IS NULL OR builder = '')"):
        our_imos.add(row[0])
    print(f"Ships needing builder: {len(our_imos)}", flush=True)

    # Fetch from Wikidata in batches
    offset = 0
    total_matched = 0
    all_builders = {}  # imo -> (builder, country)

    while True:
        print(f"Fetching Wikidata offset {offset}...", flush=True)
        try:
            results = query_wikidata(offset, 5000)
        except Exception as e:
            print(f"Error at offset {offset}: {e}", flush=True)
            break

        if not results:
            break

        for r in results:
            imo = r["imo"]["value"]
            builder = r.get("builderLabel", {}).get("value", "")
            country = r.get("countryLabel", {}).get("value", "")
            if imo and builder and not builder.startswith("Q"):  # Q-IDs = unresolved
                # Keep first builder per IMO (primary)
                if imo not in all_builders:
                    all_builders[imo] = (builder, country)

        print(f"  Got {len(results)} results, {len(all_builders)} unique builders so far", flush=True)
        offset += 5000
        time.sleep(2)

        if len(results) < 5000:
            break

    # Match against our DB
    for imo, (builder, country) in all_builders.items():
        if imo in our_imos:
            con.execute(
                "UPDATE ships SET builder = ? WHERE imo = ? AND (builder IS NULL OR builder = '')",
                (builder, imo)
            )
            total_matched += 1
            if total_matched <= 20 or total_matched % 100 == 0:
                print(f"  OK  {imo} → {builder} ({country})", flush=True)

    con.commit()
    con.close()
    print(f"\nDone: {total_matched} builders matched from {len(all_builders)} Wikidata entries", flush=True)


if __name__ == "__main__":
    main()
