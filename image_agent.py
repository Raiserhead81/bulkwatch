#!/usr/bin/env python3
"""
image_agent.py — Vessel Database Image Agent
Sucht automatisch neue Schiffsbilder aus mehreren Quellen.
State-tracking verhindert Doppelarbeit zwischen Runs.

Quellen (in Priorität):
  1. Wikidata SPARQL (P18 = Bild)      — beste Qualität, rate-limitiert
  2. Wikimedia Commons (Kategorien)    — sehr viele Bilder, stabil
  3. Wikimedia Commons (Textsuche)     — breite Abdeckung
  4. Wikipedia EN/DE/NL (Artikel)      — für Schiffe mit eigenem Artikel
  5. Flickr (CC-Bilder)               — zusätzliche Fotografen

State: /opt/bulkwatch/image_agent_state.json
Log:   /opt/bulkwatch/image_agent.log
"""

import json, time, re, sqlite3, datetime, os, sys
import urllib.request, urllib.parse

# ─── Pfade ────────────────────────────────────────────────────────────────────
IMAGES_PATH  = "/opt/bulkwatch/src/data/ship-images.json"
STATE_PATH   = "/opt/bulkwatch/image_agent_state.json"
LOG_PATH     = "/opt/bulkwatch/image_agent.log"
DB_PATH      = "/opt/bulkwatch/db/ships.db"

# ─── APIs ─────────────────────────────────────────────────────────────────────
SPARQL_URL   = "https://query.wikidata.org/sparql"
COMMONS_API  = "https://commons.wikimedia.org/w/api.php"
EN_WP_API    = "https://en.wikipedia.org/w/api.php"
DE_WP_API    = "https://de.wikipedia.org/w/api.php"
NL_WP_API    = "https://nl.wikipedia.org/w/api.php"
FLICKR_FEED  = "https://api.flickr.com/services/feeds/photos_public.gne"
UA           = "VesselDBImageAgent/1.0 (vessels.gemivo.de; contact@gemivo.de)"

IMO_RE = re.compile(r"\bIMO[_\s\-#:]*(\d{7})\b", re.IGNORECASE)

# ─── Logging ──────────────────────────────────────────────────────────────────
def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")

# ─── State ────────────────────────────────────────────────────────────────────
def load_state():
    if os.path.exists(STATE_PATH):
        return json.load(open(STATE_PATH))
    return {
        "wikidata": {"last_run": 0, "offset": 0, "done": False},
        "commons_cats": {"last_run": 0, "done_cats": []},
        "commons_search": {"last_run": 0, "done_queries": []},
        "wikipedia": {"last_run": 0, "done_langs": []},
        "flickr": {"last_run": 0, "done_tags": []},
        "stats": {"total_added": 0, "runs": 0, "last_run": 0},
    }

def save_state(state):
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

# ─── HTTP helpers ──────────────────────────────────────────────────────────────
def api_get(base_url, params, retries=3, pause=2):
    params["format"] = "json"
    url = base_url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            err = str(e)
            if "429" in err:
                return None  # Rate limited — caller handles it
            if attempt < retries - 1:
                time.sleep(pause * (attempt + 1))
    return None

def sparql_query(q, retries=2):
    url = SPARQL_URL + "?" + urllib.parse.urlencode({"query": q, "format": "json"})
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "application/sparql-results+json"
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as e:
            if "429" in str(e) or "403" in str(e):
                return "rate_limited"
            if attempt < retries - 1:
                time.sleep(5)
    return None

# ─── Image info from Commons ───────────────────────────────────────────────────
def get_image_info(titles, base=COMMONS_API):
    result = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i+50]
        d = api_get(base, {
            "action": "query", "titles": "|".join(batch),
            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": "960",
        })
        if not d:
            continue
        for page in d.get("query", {}).get("pages", {}).values():
            title = page.get("title", "")
            m = IMO_RE.search(title)
            if not m:
                continue
            imo = m.group(1)
            infos = page.get("imageinfo", [])
            if not infos or not infos[0].get("thumburl"):
                continue
            info = infos[0]
            meta = info.get("extmetadata", {})
            artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()[:80]
            result[imo] = {
                "imageUrl": info["thumburl"],
                "artist": artist or "Unknown",
                "license": meta.get("LicenseShortName", {}).get("value", "CC BY-SA"),
            }
        time.sleep(0.3)
    return result

def get_wp_images(titles, wp_api):
    result = {}
    for i in range(0, len(titles), 20):
        batch = titles[i:i+20]
        d = api_get(wp_api, {
            "action": "query", "titles": "|".join(batch),
            "prop": "pageimages|revisions", "pithumbsize": "960",
            "rvprop": "content", "rvslots": "main", "rvsection": "0",
        })
        if not d:
            continue
        for page in d.get("query", {}).get("pages", {}).values():
            thumb = page.get("thumbnail", {}).get("source", "")
            if not thumb:
                continue
            revs = page.get("revisions", [])
            if not revs:
                continue
            content = revs[0].get("slots", {}).get("main", {}).get("*", "") or revs[0].get("*", "")
            m = IMO_RE.search(content)
            if m:
                result[m.group(1)] = {
                    "imageUrl": thumb,
                    "artist": "Wikimedia Commons",
                    "license": "CC BY-SA",
                }
        time.sleep(0.4)
    return result

def get_cat_members(category, wp_api=COMMONS_API, cmtype="file", max_n=2000):
    members = []
    cmcontinue = None
    while len(members) < max_n:
        params = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{category}", "cmtype": cmtype, "cmlimit": "500",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        d = api_get(wp_api, params)
        if not d:
            break
        members.extend(d.get("query", {}).get("categorymembers", []))
        cont = d.get("continue", {})
        cmcontinue = cont.get("cmcontinue")
        if not cmcontinue:
            break
        time.sleep(0.3)
    return members

# ─── DB sync ──────────────────────────────────────────────────────────────────
def sync_to_db(new_images):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    updated = 0
    for imo, img in new_images.items():
        img_url = img.get("imageUrl")
        if not img_url:
            continue
        img_attr = "{} / {}".format(img.get("artist", ""), img.get("license", ""))
        cur.execute(
            "UPDATE ships SET image_url=?, image_attribution=? WHERE imo=? AND image_url IS NULL",
            (img_url, img_attr, imo)
        )
        if cur.rowcount:
            updated += 1
    conn.commit()
    conn.close()
    return updated

# ─── Source 1: Wikidata SPARQL ────────────────────────────────────────────────
def run_wikidata(existing, state):
    log("  Checking Wikidata availability...")
    test = sparql_query("SELECT ?x WHERE { ?x wdt:P31 wd:Q11446 } LIMIT 1")
    if test == "rate_limited":
        log("  Wikidata rate-limited (outage), skipping")
        return {}
    if not test:
        log("  Wikidata not responding, skipping")
        return {}

    log("  Wikidata available! Fetching ships with images (P18)...")
    new_images = {}
    batch = 1000
    offset = state["wikidata"].get("offset", 0)
    MAX_OFFSET = 50000

    while offset < MAX_OFFSET:
        q = f"""
SELECT DISTINCT ?imo ?image WHERE {{
  ?ship wdt:P458 ?imo .
  ?ship wdt:P18 ?image .
}} ORDER BY ?imo LIMIT {batch} OFFSET {offset}"""
        d = sparql_query(q)
        if d == "rate_limited":
            log(f"  Rate limited at offset {offset}")
            break
        if not d:
            break
        results = d.get("results", {}).get("bindings", [])
        if not results:
            state["wikidata"]["done"] = True
            break
        for r in results:
            imo = r["imo"]["value"]
            img = r["image"]["value"]
            if imo not in existing and imo not in new_images:
                new_images[imo] = {
                    "imageUrl": img,
                    "artist": "Wikimedia Commons",
                    "license": "CC BY-SA",
                    "source": "wikidata"
                }
        state["wikidata"]["offset"] = offset + batch
        offset += batch
        log(f"    offset={offset}, {len(new_images)} new so far")
        time.sleep(65)  # Wikidata rate limit: 1 req/min

    state["wikidata"]["last_run"] = int(time.time())
    return new_images

# ─── Source 2: Commons categories ────────────────────────────────────────────
COMMONS_SHIP_CATS = [
    "Bulk carriers (ships)", "Container ships", "Oil tankers", "LNG carriers",
    "Chemical tankers", "General cargo ships", "Ro-ro ships",
    "Oldendorff Carriers", "Hapag-Lloyd ships", "Maersk ships",
    "MSC (container ships)", "CMA CGM ships", "Evergreen Marine ships",
    "Ships of Germany", "Ships of Netherlands", "Ships of Norway",
    "Ships of Greece", "Ships of Marshall Islands", "Ships of Panama",
    "Ships of Liberia", "Ships of Bahamas",
    "Bulk carriers at port", "Container ships at port",
]

def run_commons_cats(existing, state, new_so_far):
    done_cats = set(state["commons_cats"].get("done_cats", []))
    todo = [c for c in COMMONS_SHIP_CATS if c not in done_cats]
    if not todo:
        log("  All Commons categories done, resetting for next run")
        state["commons_cats"]["done_cats"] = []
        todo = COMMONS_SHIP_CATS[:5]  # Do first 5 again

    new_images = {}
    merged = {**existing, **new_so_far}

    for cat in todo[:8]:  # Max 8 categories per run
        log(f"  Category: {cat}")
        members = get_cat_members(cat, COMMONS_API, "file")
        files = [m["title"] for m in members if IMO_RE.search(m["title"])]
        infos = get_image_info(files)
        added = {k: v for k, v in infos.items() if k not in merged and k not in new_images}
        new_images.update(added)
        log(f"    {len(files)} files with IMO → {len(added)} new")
        done_cats.add(cat)
        merged.update(new_images)
        time.sleep(0.5)

    state["commons_cats"]["done_cats"] = list(done_cats)
    state["commons_cats"]["last_run"] = int(time.time())
    return new_images

# ─── Source 3: Commons text search ───────────────────────────────────────────
COMMONS_QUERIES = [
    "ship IMO 9", "vessel IMO 9", "tanker IMO 9",
    "container ship IMO 9", "cargo vessel IMO", "mv IMO ship", "ms IMO ship",
    "bulk carrier IMO 9", "ore carrier IMO 9", "cargo ship IMO 9",
    "bulkcarrier IMO", "containership IMO 9", "LNG tanker IMO",
    "chemical tanker IMO", "car carrier IMO", "reefer ship IMO",
]

def run_commons_search(existing, state, new_so_far):
    done_queries = set(state["commons_search"].get("done_queries", []))
    todo = [q for q in COMMONS_QUERIES if q not in done_queries]
    if not todo:
        log("  All Commons queries done, resetting")
        state["commons_search"]["done_queries"] = []
        todo = COMMONS_QUERIES[:5]

    new_images = {}
    merged = {**existing, **new_so_far}

    for query in todo[:6]:  # Max 6 per run
        log(f"  Search: '{query}'")
        sroffset = 0
        query_new = 0
        while sroffset < 6000:
            d = api_get(COMMONS_API, {
                "action": "query", "list": "search", "srsearch": query,
                "srnamespace": "6", "srlimit": "50", "sroffset": str(sroffset),
            })
            if not d:
                break
            hits = d.get("query", {}).get("search", [])
            if not hits:
                break
            files = [h["title"] for h in hits if IMO_RE.search(h["title"])]
            infos = get_image_info(files)
            added = {k: v for k, v in infos.items() if k not in merged and k not in new_images}
            new_images.update(added)
            merged.update(added)
            query_new += len(added)
            sroffset += len(hits)
            if len(hits) < 50:
                break
            time.sleep(0.4)
        log(f"    → {query_new} new")
        done_queries.add(query)
        time.sleep(0.5)

    state["commons_search"]["done_queries"] = list(done_queries)
    state["commons_search"]["last_run"] = int(time.time())
    return new_images

# ─── Source 4: Wikipedia articles ────────────────────────────────────────────
WP_SOURCES = {
    "en": (EN_WP_API, [
        "Bulk carriers", "Container ships", "Oil tankers", "LNG carriers",
        "Chemical tankers", "General cargo ships", "Ro-ro ships",
        "Cruise ships", "Heavy lift ships",
    ]),
    "de": (DE_WP_API, [
        "Massengutfrachter", "Containerschiff", "Tanker", "Frachtschiff",
        "Gastanker", "Stückgutfrachter",
    ]),
    "nl": (NL_WP_API, [
        "Bulkcarrier", "Vrachtschip", "Containerschip", "Tanker (schip)",
    ]),
}

def run_wikipedia(existing, state, new_so_far):
    done_langs = set(state["wikipedia"].get("done_langs", []))
    merged = {**existing, **new_so_far}
    new_images = {}

    for lang, (api, cats) in WP_SOURCES.items():
        if lang in done_langs:
            continue
        log(f"  Wikipedia {lang.upper()}")
        titles = []
        for cat in cats:
            members = get_cat_members(cat, api, "page", 1000)
            page_titles = [m["title"] for m in members
                          if not any(x in m["title"].lower() for x in ["list of", "history of", ":"])]
            titles.extend(page_titles)
            time.sleep(0.3)

        titles = list(set(titles))
        log(f"    {len(titles)} articles")
        infos = get_wp_images(titles, api)
        added = {k: v for k, v in infos.items() if k not in merged and k not in new_images}
        new_images.update(added)
        merged.update(added)
        log(f"    → {len(added)} new")
        done_langs.add(lang)
        time.sleep(1)

    # Reset if all done
    if len(done_langs) >= len(WP_SOURCES):
        done_langs = set()
        log("  All Wikipedia languages done, will repeat next run")

    state["wikipedia"]["done_langs"] = list(done_langs)
    state["wikipedia"]["last_run"] = int(time.time())
    return new_images

# ─── Source 5: Flickr public feed ────────────────────────────────────────────
FLICKR_TAGS = [
    "shipspotting,IMO", "vessel,IMO,harbor", "bulkcarrier,IMO",
    "containership,IMO", "tanker,IMO,vessel", "cargo,IMO,ship",
    "cargo ship,port,IMO", "schip,IMO,haven", "vessel,IMO,port",
    "ship,IMO,bulker", "ship,IMO,Rotterdam", "ship,IMO,Hamburg",
    "ship,IMO,Antwerp", "ship,IMO,IJmuiden",
]

def run_flickr(existing, state, new_so_far):
    done_tags = set(state["flickr"].get("done_tags", []))
    todo = [t for t in FLICKR_TAGS if t not in done_tags]
    if not todo:
        state["flickr"]["done_tags"] = []
        todo = FLICKR_TAGS[:5]

    merged = {**existing, **new_so_far}
    new_images = {}

    for tags in todo[:8]:
        url = FLICKR_FEED + "?" + urllib.parse.urlencode({
            "tags": tags, "format": "json", "nojsoncallback": "1"
        })
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                d = json.loads(r.read())
        except:
            time.sleep(1)
            continue

        found = 0
        for item in d.get("items", []):
            combined = item.get("title", "") + " " + item.get("description", "")
            m = IMO_RE.search(combined)
            if not m:
                continue
            imo = m.group(1)
            if imo in merged or imo in new_images:
                continue
            img_url = item.get("media", {}).get("m", "").replace("_m.jpg", "_b.jpg")
            if not img_url:
                continue
            new_images[imo] = {
                "imageUrl": img_url,
                "artist": item.get("author", "Flickr").replace("nobody@flickr.com (", "").rstrip(")"),
                "license": "CC BY-SA 2.0",
                "source": "flickr",
            }
            found += 1

        if found:
            log(f"  Flickr '{tags}': {found} new")
        done_tags.add(tags)
        time.sleep(1)

    state["flickr"]["done_tags"] = list(done_tags)
    state["flickr"]["last_run"] = int(time.time())
    return new_images

# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    start = time.time()
    state = load_state()
    existing = json.load(open(IMAGES_PATH))

    log(f"=== Image Agent Run #{state['stats']['runs']+1} ===")
    log(f"Starting with {len(existing)} images")

    all_new = {}

    # Source 1: Wikidata (check every run, skip if rate-limited)
    log("\n[1/5] Wikidata SPARQL")
    wd_new = run_wikidata(existing, state)
    all_new.update(wd_new)
    log(f"  → {len(wd_new)} new from Wikidata")
    save_state(state)

    # Source 2: Commons categories
    log("\n[2/5] Wikimedia Commons — categories")
    cat_new = run_commons_cats(existing, state, all_new)
    all_new.update(cat_new)
    log(f"  → {len(cat_new)} new from Commons cats")
    save_state(state)

    # Source 3: Commons text search
    log("\n[3/5] Wikimedia Commons — text search")
    search_new = run_commons_search(existing, state, all_new)
    all_new.update(search_new)
    log(f"  → {len(search_new)} new from Commons search")
    save_state(state)

    # Source 4: Wikipedia articles (en/de/nl)
    log("\n[4/5] Wikipedia articles (EN/DE/NL)")
    wp_new = run_wikipedia(existing, state, all_new)
    all_new.update(wp_new)
    log(f"  → {len(wp_new)} new from Wikipedia")
    save_state(state)

    # Source 5: Flickr
    log("\n[5/5] Flickr CC photos")
    fl_new = run_flickr(existing, state, all_new)
    all_new.update(fl_new)
    log(f"  → {len(fl_new)} new from Flickr")
    save_state(state)

    # Save images
    merged = {**existing, **all_new}
    with open(IMAGES_PATH, "w") as f:
        json.dump(merged, f, indent=2)

    # Sync to DB
    db_updated = sync_to_db(all_new)

    # Update state stats
    elapsed = int(time.time() - start)
    state["stats"]["total_added"] += len(all_new)
    state["stats"]["runs"] += 1
    state["stats"]["last_run"] = int(time.time())
    save_state(state)

    log(f"\n=== Done in {elapsed}s ===")
    log(f"New images this run: {len(all_new)}")
    log(f"DB ships updated: {db_updated}")
    log(f"Grand total: {len(existing)} → {len(merged)}")
    log(f"Total added across all runs: {state['stats']['total_added']}")

if __name__ == "__main__":
    main()
