#!/usr/bin/env python3
"""Scrape positions for ships without AIS from VesselFinder public pages.
Runs nightly, targets ships with no position or stale position (>7 days)."""
import sqlite3, urllib.request, re, json, time, sys

DB_PATH = "/opt/bulkwatch/db/ships.db"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
DELAY = 5.0  # seconds between requests

def scrape_vesselfinder(imo):
    """Try to get position from VesselFinder public page."""
    url = f"https://www.vesselfinder.com/vessels/details/{imo}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        # Look for coordinates in the page
        # VesselFinder embeds lat/lon in various formats
        lat = lon = None

        # Pattern: "latitude":XX.XXX,"longitude":YY.YYY
        m = re.search(r'"latitude"\s*:\s*([-\d.]+)\s*,\s*"longitude"\s*:\s*([-\d.]+)', html)
        if m:
            lat, lon = float(m.group(1)), float(m.group(2))

        # Pattern: data-lat="XX.XXX" data-lon="YY.YYY"
        if not lat:
            m = re.search(r'data-lat="([-\d.]+)".*?data-lon="([-\d.]+)"', html)
            if m:
                lat, lon = float(m.group(1)), float(m.group(2))

        # Pattern: LatLng(XX.XXX, YY.YYY)
        if not lat:
            m = re.search(r'LatLng\(([-\d.]+),\s*([-\d.]+)\)', html)
            if m:
                lat, lon = float(m.group(1)), float(m.group(2))

        if lat and lon and lat != 0 and lon != 0:
            return lat, lon
    except urllib.error.HTTPError as e:
        if e.code == 429:
            print("  Rate limited, sleeping 60s...", flush=True)
            time.sleep(60)
        elif e.code == 403:
            print("  Blocked (403), stopping.", flush=True)
            return "BLOCKED"
    except Exception as e:
        pass
    return None


def scrape_marinetraffic(imo):
    """Try MarineTraffic public page as fallback."""
    url = f"https://www.marinetraffic.com/en/ais/details/ships/imo:{imo}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        m = re.search(r'"latitude"\s*:\s*([-\d.]+).*?"longitude"\s*:\s*([-\d.]+)', html, re.DOTALL)
        if m:
            lat, lon = float(m.group(1)), float(m.group(2))
            if lat != 0 and lon != 0:
                return lat, lon
    except:
        pass
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    now = int(time.time())
    week_ago = now - 7 * 86400

    # Get ships without position or with stale position (>7 days old)
    ships = conn.execute("""
        SELECT imo, name FROM ships
        WHERE (lat IS NULL OR lat = 0 OR (last_seen > 0 AND last_seen < ?))
        AND imo IS NOT NULL
        ORDER BY dwt DESC
        LIMIT 200
    """, (week_ago,)).fetchall()

    print(f"Scraping positions for {len(ships)} ships...", flush=True)
    found = 0
    blocked = False

    for i, (imo, name) in enumerate(ships):
        if blocked:
            break

        if i % 20 == 0 and i > 0:
            print(f"  [{i}/{len(ships)}] found={found}", flush=True)

        # Try VesselFinder first
        result = scrape_vesselfinder(imo)
        if result == "BLOCKED":
            blocked = True
            break

        if result:
            lat, lon = result
            conn.execute("UPDATE ships SET lat=?, lon=?, last_seen=? WHERE imo=?",
                         (lat, lon, now, imo))
            conn.commit()
            found += 1
            print(f"  OK   {name[:30]:30} {lat:.3f}, {lon:.3f} (VF)", flush=True)
            time.sleep(DELAY)
            continue

        # Fallback: MarineTraffic
        result = scrape_marinetraffic(imo)
        if result:
            lat, lon = result
            conn.execute("UPDATE ships SET lat=?, lon=?, last_seen=? WHERE imo=?",
                         (lat, lon, now, imo))
            conn.commit()
            found += 1
            print(f"  OK   {name[:30]:30} {lat:.3f}, {lon:.3f} (MT)", flush=True)

        time.sleep(DELAY)

    conn.close()
    print(f"\nDone: {found} positions found for {len(ships)} ships", flush=True)


if __name__ == "__main__":
    main()
