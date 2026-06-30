#!/usr/bin/env python3
"""
OPEX Live Rates Updater — runs daily via cron
Fetches data from 10+ sources and writes db/opex_rates.json
"""

import json, os, re, traceback
from datetime import datetime, date
from pathlib import Path
import requests

DB_DIR = Path("/opt/bulkwatch/db")
OUT = DB_DIR / "opex_rates.json"
LOG = Path("/opt/bulkwatch/opex-update.log")
UA = "Mozilla/5.0 (X11; Linux x86_64) BulkWatch/1.0"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG, "a") as f:
        f.write(line + "\n")

def safe_float(val, default=None):
    try:
        return float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return default

# ═══ SOURCE 1: HandyBulk — Bunker Prices ═══
def fetch_bunker():
    try:
        r = requests.get("https://www.handybulk.com/bunker-prices/",
                         headers={"User-Agent": UA}, timeout=15)
        if r.status_code != 200:
            return None
        text = r.text
        vlsfo = re.search(r'VLSFO[^0-9]*(\d{3,4})', text, re.DOTALL)
        hsfo = re.search(r'380[^0-9]*(\d{3,4})', text, re.DOTALL)
        mgo = re.search(r'MGO[^0-9]*(\d{3,4})', text, re.DOTALL)
        result = {}
        if vlsfo: result["vlsfo"] = int(vlsfo.group(1))
        if hsfo: result["hsfo"] = int(hsfo.group(1))
        if mgo: result["mgo"] = int(mgo.group(1))
        if result:
            log(f"HandyBulk bunker: {result}")
            return result
    except Exception as e:
        log(f"Bunker error: {e}")
    return None

# ═══ SOURCE 2: HandyBulk — Charter Rates ═══
def fetch_charter_rates():
    try:
        r = requests.get("https://www.handybulk.com/ship-charter-rates/",
                         headers={"User-Agent": UA}, timeout=15)
        r.raise_for_status()
        text = r.text
        rates = {}
        for key, pat in {
            "handysize": r'[Hh]andy\w*[^0-9]*\$?([\d,]+)\s*/?\s*day',
            "supramax": r'[Ss]upra\w*[^0-9]*\$?([\d,]+)\s*/?\s*day',
            "panamax": r'[Pp]ana\w*[^0-9]*\$?([\d,]+)\s*/?\s*day',
            "capesize": r'[Cc]ape\w*[^0-9]*\$?([\d,]+)\s*/?\s*day',
        }.items():
            m = re.search(pat, text)
            if m:
                rates[key] = int(m.group(1).replace(",", ""))
        if rates:
            log(f"Charter rates: {rates}")
        return rates if rates else None
    except Exception as e:
        log(f"Charter rates error: {e}")
        return None

# ═══ SOURCE 3: Go-Shipping — Scrap/LDT ═══
def fetch_scrap_ldt():
    try:
        r = requests.get("https://www.go-shipping.net/demolition-market",
                         headers={"User-Agent": UA}, timeout=15)
        r.raise_for_status()
        m = re.search(r"Bangladesh.*?USD.?\s*(\d{3,4})", r.text, re.DOTALL)
        if m:
            ldt = int(m.group(1))
            log(f"Go-Shipping scrap: ${ldt}/LDT")
            return ldt
    except Exception as e:
        log(f"Go-Shipping error: {e}")
    return None

# ═══ SOURCE 4: TradingEconomics — Scrap Steel ═══
def fetch_scrap_steel():
    try:
        r = requests.get("https://tradingeconomics.com/commodity/scrap-steel",
                         headers={"User-Agent": UA, "Accept": "text/html"}, timeout=15)
        m = re.search(r'id="p"[^>]*>([\d,.]+)', r.text)
        if m:
            raw = m.group(1).replace(",", ""); price = float(raw); price = price if price < 2000 else price / 1000
            log(f"Scrap steel: ${price}/ton")
            return price
    except Exception as e:
        log(f"Scrap steel error: {e}")
    return None

# ═══ SOURCE 5: FRED — PPI Iron & Steel ═══
def fetch_fred_ppi():
    try:
        r = requests.get("https://fred.stlouisfed.org/series/WPU1012",
                         headers={"User-Agent": UA}, timeout=15)
        m = re.search(r'series-meta-observation-value">([\d.]+)', r.text)
        if m:
            val = float(m.group(1))
            log(f"FRED PPI: {val}")
            return val
    except Exception as e:
        log(f"FRED error: {e}")
    return None

# ═══ SOURCE 6: USDA — Brent Crude ═══
def fetch_brent():
    try:
        r = requests.get("https://agtransport.usda.gov/resource/b3w8-gxpm.json",
                         params={"$limit": 5}, headers={"User-Agent": UA}, timeout=15)
        r.raise_for_status()
        data = r.json()
        for row in data:
            price = safe_float(row.get("price"))
            if price and price > 10:
                log(f"Brent crude: ${price}")
                return price
    except Exception as e:
        log(f"Brent error: {e}")
    return None

# ═══ SOURCE 7: TradingEconomics — BDI ═══
def fetch_bdi():
    try:
        r = requests.get("https://tradingeconomics.com/commodity/baltic",
                         headers={"User-Agent": UA, "Accept": "text/html"}, timeout=15)
        m = re.search(r'id="p"[^>]*>([\d,.]+)', r.text)
        if m:
            bdi = int(float(m.group(1).replace(",", "")))
            log(f"BDI: {bdi}")
            return bdi
    except Exception as e:
        log(f"BDI error: {e}")
    return None

# ═══ SOURCE 8: ScrapMonster — HMS 1&2 ═══
def fetch_scrapmonster():
    try:
        r = requests.get("https://www.scrapmonster.com/scrap-metal-prices/united-states",
                         headers={"User-Agent": UA}, timeout=15)
        m = re.search(r'HMS\s*1\s*[&]\s*2.*?\$\s*([\d.]+)', r.text, re.DOTALL | re.IGNORECASE)
        if m:
            price = float(m.group(1))
            log(f"ScrapMonster HMS: ${price}")
            return price
    except Exception as e:
        log(f"ScrapMonster error: {e}")
    return None

# ═══ SOURCE 9: TradingEconomics — Brent (backup) ═══
def fetch_brent_te():
    try:
        r = requests.get("https://tradingeconomics.com/commodity/brent-crude-oil",
                         headers={"User-Agent": UA, "Accept": "text/html"}, timeout=15)
        m = re.search(r'id="p"[^>]*>([\d,.]+)', r.text)
        if m:
            price = float(m.group(1).replace(",", ""))
            log(f"Brent (TE): ${price}")
            return price
    except Exception as e:
        log(f"Brent TE error: {e}")
    return None

# ═══ SOURCE 10: TradingEconomics — Natural Gas (LNG proxy) ═══
def fetch_natgas():
    try:
        r = requests.get("https://tradingeconomics.com/commodity/natural-gas",
                         headers={"User-Agent": UA, "Accept": "text/html"}, timeout=15)
        m = re.search(r'id="p"[^>]*>([\d,.]+)', r.text)
        if m:
            price = float(m.group(1).replace(",", ""))
            log(f"NatGas: ${price}")
            return price
    except Exception as e:
        log(f"NatGas error: {e}")
    return None

# ═══ AGGREGATE & WRITE ═══
def main():
    log("=" * 60)
    log("OPEX rate update starting")

    prev = {}
    if OUT.exists():
        try:
            prev = json.loads(OUT.read_text())
        except:
            pass

    sources = []

    bunker = fetch_bunker()
    if bunker: sources.append("HandyBulk (bunker prices)")

    charter = fetch_charter_rates()
    if charter: sources.append("HandyBulk (charter rates)")

    scrap_ldt = fetch_scrap_ldt()
    if scrap_ldt: sources.append("Go-Shipping.net (scrap/LDT)")

    scrap_steel = fetch_scrap_steel()
    if scrap_steel: sources.append("TradingEconomics (scrap steel)")

    fred_ppi = fetch_fred_ppi()
    if fred_ppi: sources.append("FRED StLouis (PPI Iron/Steel)")

    brent = fetch_brent()
    if brent: sources.append("USDA AgTransport (Brent crude)")

    bdi = fetch_bdi()
    if bdi: sources.append("TradingEconomics (BDI)")

    scrapmonster = fetch_scrapmonster()
    if scrapmonster: sources.append("ScrapMonster (HMS scrap)")

    brent_te = fetch_brent_te()
    if brent_te: sources.append("TradingEconomics (Brent)")

    natgas = fetch_natgas()
    if natgas: sources.append("TradingEconomics (NatGas/LNG)")

    sources.extend([
        "Drewry Manning Review 2025/26 (crew)",
        "ITF/ILO MLC 2006 (wages)",
        "maritime-zone.com (salaries)",
    ])

    def pick(new, key, default):
        if new is not None: return new
        return prev.get(key, default)

    # Derive bunker from Brent if scraping failed
    vlsfo = (bunker or {}).get("vlsfo")
    hsfo = (bunker or {}).get("hsfo")
    mgo = (bunker or {}).get("mgo")
    brent_price = brent or brent_te
    if not vlsfo and brent_price:
        vlsfo = round(brent_price * 7.5)
        hsfo = round(brent_price * 5.5)
        mgo = round(brent_price * 10.5)

    result = {
        "date": date.today().isoformat(),
        "bunkerVLSFO": pick(vlsfo, "bunkerVLSFO", 580),
        "bunkerHSFO": pick(hsfo, "bunkerHSFO", 430),
        "bunkerMGO": pick(mgo, "bunkerMGO", 820),
        "bdiIndex": pick(bdi, "bdiIndex", 2490),
        "scrapPriceLDT": pick(scrap_ldt, "scrapPriceLDT", 480),
        "steelScrapUSD": pick(scrap_steel, "steelScrapUSD", 382),
        "insuranceRateHull": 0.25,
        "insuranceRatePnI": 4.50,
        "lubeOilPrice": 4.20,
        "provisionsCostPerPersonDay": 12,
        "charterRates": prev.get("charterRates", {
            "handysize": 13500,
            "supramax": 17500,
            "panamax": 18000,
            "capesize": 29000,
        }),
        "sources": sources,
    }

    if charter:
        for k, v in charter.items():
            result["charterRates"][k] = v

    OUT.write_text(json.dumps(result, indent=2))
    log(f"Wrote {OUT} — {len(sources)} sources")
    log(f"VLSFO=${result['bunkerVLSFO']}, BDI={result['bdiIndex']}, Scrap=${result['scrapPriceLDT']}/LDT")
    log("Done")

if __name__ == "__main__":
    main()
