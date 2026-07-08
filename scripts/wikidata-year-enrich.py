#!/usr/bin/env python3
"""Fill missing year_built from Wikidata (P571 inception / P729 service entry).

Legal bulk source — SPARQL, no scraping, no login, no rate-blocking.
Batches IMOs, validates the year range, commits per batch, idempotent
(only touches ships whose year_built is still empty).
"""
import sqlite3, urllib.request, urllib.parse, json, time, sys

DB = "/opt/bulkwatch/db/ships.db"
BATCH = 250
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "BulkWatch/1.0 (vessels.gemivo.de; year_built enrichment)"

def query(imos):
    values = " ".join('"%s"' % i for i in imos)
    q = """SELECT ?imo (SAMPLE(?y) AS ?year) WHERE {
      VALUES ?imo { %s }
      ?ship wdt:P458 ?imo .
      OPTIONAL { ?ship wdt:P571 ?i . }
      OPTIONAL { ?ship wdt:P729 ?s . }
      BIND(YEAR(COALESCE(?i,?s)) AS ?y)
    } GROUP BY ?imo""" % values
    data = urllib.parse.urlencode({"query": q, "format": "json"}).encode()
    req = urllib.request.Request(ENDPOINT, data=data,
        headers={"Accept": "application/json", "User-Agent": UA})
    for attempt in range(3):
        try:
            r = json.load(urllib.request.urlopen(req, timeout=90))
            return r["results"]["bindings"]
        except Exception as e:
            print("  retry %d: %s" % (attempt+1, e), flush=True)
            time.sleep(10)
    return []

db = sqlite3.connect(DB)
imos = [r[0] for r in db.execute(
    "SELECT imo FROM ships WHERE (year_built IS NULL OR year_built=0) "
    "AND imo NOT LIKE 'cat-%' AND imo GLOB '[0-9]*' ORDER BY dwt DESC").fetchall()]
print("Ziel: %d Schiffe ohne Baujahr" % len(imos), flush=True)

updated = 0
for start in range(0, len(imos), BATCH):
    chunk = imos[start:start+BATCH]
    rows = query(chunk)
    hits = 0
    for x in rows:
        y = x.get("year", {}).get("value")
        imo = x["imo"]["value"]
        if y and 1950 <= int(y) <= 2030:
            db.execute("UPDATE ships SET year_built=? WHERE imo=? AND (year_built IS NULL OR year_built=0)",
                       (int(y), imo))
            hits += 1
    db.commit()
    updated += hits
    print("  Batch %d-%d: %d/%d Treffer (gesamt %d)" %
          (start+1, start+len(chunk), hits, len(chunk), updated), flush=True)
    time.sleep(2)

print("\nFERTIG. Baujahr ergaenzt fuer %d Schiffe (von %d)." % (updated, len(imos)), flush=True)
