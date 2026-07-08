#!/usr/bin/env python3
"""Flickr Image Scraper — CC-licensed ship photos, legal reuse with attribution.

Searches Flickr by ship name, restricted to commercially-reusable CC licenses
(CC BY / CC BY-SA / CC0 / Public Domain). Two-stage precision:
  1. STRICT title match — ship name must be in the FIRST segment of the title
     (Flickr photographers lead with the primary vessel, e.g. "MSC OSCAR" or
     "COSCO LEO , EVER GIVEN"), so we never attach a photo of a different ship.
  2. Claude Haiku VISION — confirms the image really shows one cargo ship.
Stores image_url + attribution (photographer + license). Only fills empty images.
"""
import sqlite3, urllib.request, urllib.parse, json, re, time, base64

DB = "/opt/bulkwatch/db/ships.db"
LICENSES = "4,5,7,9,10"  # commercial-OK: CC-BY, CC-BY-SA, no-known-restr, CC0, PD-Mark
LICENSE_NAME = {"4": "CC BY 2.0", "5": "CC BY-SA 2.0", "7": "No known copyright restrictions",
                "9": "CC0 1.0", "10": "Public Domain Mark 1.0", "8": "US Government Work"}
PER_RUN = 1000
DELAY = 0.4  # Flickr allows 3600 req/h

# Keys from bulkwatch/.env (not hardcoded — file is gitignored)
FLICKR_KEY = API_KEY = ""
with open("/opt/bulkwatch/.env") as f:
    for line in f:
        if line.startswith("ANTHROPIC_API_KEY="):
            API_KEY = line.strip().split("=", 1)[1].strip()
        elif line.startswith("FLICKR_API_KEY="):
            FLICKR_KEY = line.strip().split("=", 1)[1].strip()

def is_cargo_ship(image_url):
    """Claude Haiku confirms the photo shows a cargo ship. Reject on error
    (only real, verified images get stored)."""
    try:
        data = urllib.request.urlopen(urllib.request.Request(
            image_url, headers={"User-Agent": "BulkWatch/1.0"}), timeout=15).read()
        if len(data) < 1000:
            return False
        b64 = base64.standard_b64encode(data).decode()
        media = "image/png" if ".png" in image_url.lower() else "image/jpeg"
        body = json.dumps({
            "model": "claude-haiku-4-5-20251001", "max_tokens": 10,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                {"type": "text", "text": "Is this a color photo showing a single cargo ship, bulk carrier, tanker, or container ship as the main subject? YES or NO only."}
            ]}]}).encode()
        resp = json.loads(urllib.request.urlopen(urllib.request.Request(
            "https://api.anthropic.com/v1/messages", data=body, headers={
                "Content-Type": "application/json", "x-api-key": API_KEY,
                "anthropic-version": "2023-06-01"}), timeout=30).read())
        return "YES" in resp.get("content", [{}])[0].get("text", "").strip().upper()
    except Exception as e:
        print("  Vision-Fehler: %s" % e, flush=True)
        return False

def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", (s or "").upper())).strip()

def first_segment(title):
    """Flickr titles list vessels separated by comma / middot / slash / '&'.
    The first segment is the primary subject."""
    seg = re.split(r"[,/&|·;]| - ", title or "", maxsplit=1)[0]
    return norm(seg)

def flickr_search(name):
    """Best CC photo whose FIRST title segment contains the ship name."""
    nname = norm(name)
    if len(nname) < 5:
        return None, None  # zu kurze/generische Namen -> überspringen
    p = {"method": "flickr.photos.search", "api_key": FLICKR_KEY, "text": name + " ship",
         "license": LICENSES, "sort": "relevance", "per_page": "10",
         "extras": "owner_name,license,url_l,url_c,url_o", "format": "json", "nojsoncallback": "1"}
    url = "https://api.flickr.com/services/rest/?" + urllib.parse.urlencode(p)
    try:
        r = json.load(urllib.request.urlopen(url, timeout=20))
    except Exception:
        return None, None
    if r.get("stat") != "ok":
        return None, None
    for ph in r["photos"]["photo"]:
        # Schiffsname muss im ERSTEN Titelsegment stehen (= Hauptmotiv)
        if nname not in first_segment(ph.get("title", "")):
            continue
        img = ph.get("url_l") or ph.get("url_c") or ph.get("url_o")
        if not img:
            continue
        owner = ph.get("ownername") or "Unknown"
        lic = LICENSE_NAME.get(str(ph.get("license")), "CC")
        return img, "%s (Flickr, %s)" % (owner, lic)
    return None, None

def main():
    db = sqlite3.connect(DB)
    db.execute("CREATE TABLE IF NOT EXISTS flickr_tried(imo TEXT PRIMARY KEY, ts TEXT)")
    db.commit()
    # Ships without image, not tried in the last 30 days -> works through the
    # whole fleet over time instead of re-spinning the same top-1000 nomatches,
    # while re-checking each ship monthly for newly uploaded photos.
    ships = db.execute(
        "SELECT imo, name FROM ships WHERE (image_url IS NULL OR image_url='') "
        "AND name IS NOT NULL AND name<>'' "
        "AND imo NOT IN (SELECT imo FROM flickr_tried WHERE ts > datetime('now','-30 days')) "
        "ORDER BY dwt DESC LIMIT %d" % PER_RUN).fetchall()
    print("Flickr-Suche für %d Schiffe (CC, strikt Titelanfang + Vision)" % len(ships), flush=True)
    found = rejected = nomatch = 0
    for i, (imo, name) in enumerate(ships):
        img, attr = flickr_search(name)
        if not img:
            nomatch += 1
        elif is_cargo_ship(img):
            db.execute("UPDATE ships SET image_url=?, image_attribution=? WHERE imo=? AND (image_url IS NULL OR image_url='')",
                       (img, attr, imo))
            db.commit()
            found += 1
            print("  OK  %-22s <- %s" % (name[:22], attr), flush=True)
        else:
            rejected += 1
        db.execute("INSERT OR REPLACE INTO flickr_tried VALUES (?, datetime('now'))", (imo,))
        db.commit()
        if (i + 1) % 50 == 0:
            print("  [%d/%d] found=%d rejected=%d nomatch=%d" % (i+1, len(ships), found, rejected, nomatch), flush=True)
        time.sleep(DELAY)
    print("\nFertig! Found=%d rejected(Vision)=%d nomatch=%d von %d" % (found, rejected, nomatch, len(ships)), flush=True)

if __name__ == "__main__":
    main()
