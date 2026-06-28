#!/usr/bin/env python3
"""
Telegram Alerts for Vessel Database
Sends alerts for:
  - New ships (under_construction -> active)
  - BDI change > 5% vs previous day
  - Status changes (active -> scrapped/lost)

Runs every 6 hours via cron.
State is persisted in /opt/bulkwatch/db/alert_state.json
"""

import json
import os
import re
import sqlite3
import sys
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

DB_PATH = "/opt/bulkwatch/db/ships.db"
STATE_FILE = "/opt/bulkwatch/db/alert_state.json"
ENV_FILE = "/opt/bulkwatch/.env"
LOG_FILE = "/opt/bulkwatch/alerts.log"

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{ts}: {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return env

def send_telegram(token, chat_id, message):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    try:
        req = urllib.request.Request(url, data=data)
        resp = urllib.request.urlopen(req, timeout=10)
        result = json.loads(resp.read())
        if not result.get("ok"):
            log(f"Telegram API error: {result}")
            return False
        return True
    except Exception as e:
        log(f"Telegram send failed: {e}")
        return False

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except:
            pass
    return {"ships": {}, "bdi": None, "last_run": None}

def save_state(state):
    state["last_run"] = datetime.now().isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def get_current_bdi():
    pe_file = "/opt/bulkwatch/src/lib/priceEstimator.ts"
    if not os.path.exists(pe_file):
        return None
    with open(pe_file) as f:
        content = f.read()
    m = re.search(r'bdiCurrent:\s*(\d+)', content)
    return int(m.group(1)) if m else None

def main():
    env = load_env()
    token = env.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = env.get("TELEGRAM_CHAT_ID", "")
    can_send = token and token != "SETZE_DEINEN_TOKEN_HIER" and chat_id

    if not os.path.exists(DB_PATH):
        log(f"Database not found: {DB_PATH}")
        sys.exit(1)

    state = load_state()
    old_ships = state.get("ships", {})
    old_bdi = state.get("bdi")
    alerts = []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT imo, name, type, status, dwt, flag, year_built FROM ships")
    current_ships = {}
    for row in cur.fetchall():
        imo = row["imo"]
        current_ships[imo] = {
            "name": row["name"],
            "type": row["type"],
            "status": row["status"] or "active",
            "dwt": row["dwt"] or 0,
            "flag": row["flag"] or "Unknown",
            "year_built": row["year_built"] or 0,
        }
    conn.close()

    # --- Alert 1: Status changes ---
    for imo, ship in current_ships.items():
        old = old_ships.get(imo)
        if old and old.get("status") != ship["status"]:
            old_status = old["status"]
            new_status = ship["status"]

            if old_status == "under_construction" and new_status == "active":
                dwt_str = f'{ship["dwt"]:,} DWT' if ship["dwt"] else ""
                alerts.append(
                    f'<b>New Ship Delivered</b>\n'
                    f'<b>{ship["name"]}</b> (IMO {imo})\n'
                    f'{ship["type"]} | {dwt_str} | {ship["flag"]}\n'
                    f'Status: {old_status} -> {new_status}\n'
                    f'<a href="https://ships.gemivo.de/schiff/{imo}">View Details</a>'
                )
            elif new_status in ("scrapped", "lost"):
                label = "Scrapped" if new_status == "scrapped" else "LOST"
                alerts.append(
                    f'<b>Ship {label}</b>\n'
                    f'<b>{ship["name"]}</b> (IMO {imo})\n'
                    f'{ship["type"]} | {ship["flag"]}\n'
                    f'Status: {old_status} -> {new_status}\n'
                    f'<a href="https://ships.gemivo.de/schiff/{imo}">View Details</a>'
                )
            else:
                alerts.append(
                    f'<b>Status Change</b>\n'
                    f'<b>{ship["name"]}</b> (IMO {imo})\n'
                    f'{old_status} -> {new_status}\n'
                    f'<a href="https://ships.gemivo.de/schiff/{imo}">View Details</a>'
                )

    # --- Alert 2: New ships in DB ---
    new_imos = set(current_ships.keys()) - set(old_ships.keys())
    if old_ships and 0 < len(new_imos) <= 50:
        for imo in sorted(new_imos)[:10]:
            ship = current_ships[imo]
            dwt_str = f'{ship["dwt"]:,} DWT' if ship["dwt"] else ""
            alerts.append(
                f'<b>New Ship Added</b>\n'
                f'<b>{ship["name"]}</b> (IMO {imo})\n'
                f'{ship["type"]} | {dwt_str} | {ship["flag"]}\n'
                f'<a href="https://ships.gemivo.de/schiff/{imo}">View Details</a>'
            )
        if len(new_imos) > 10:
            alerts.append(f'<b>... and {len(new_imos) - 10} more new ships</b>')

    # --- Alert 3: BDI change > 5% ---
    current_bdi = get_current_bdi()
    if current_bdi and old_bdi:
        change_pct = abs(current_bdi - old_bdi) / old_bdi * 100
        if change_pct >= 5.0:
            sign = "+" if current_bdi > old_bdi else ""
            alerts.append(
                f'<b>BDI Alert</b>\n'
                f'Baltic Dry Index: <b>{old_bdi}</b> -> <b>{current_bdi}</b>\n'
                f'Change: {sign}{current_bdi - old_bdi} ({sign}{change_pct:.1f}%)\n'
                f'<a href="https://ships.gemivo.de">Vessel Database</a>'
            )

    # Send alerts
    sent = 0
    if can_send:
        for alert in alerts:
            msg = f"Vessel Database Alert\n{'=' * 28}\n{alert}"
            if send_telegram(token, chat_id, msg):
                sent += 1
    elif alerts:
        log(f"Token not configured — {len(alerts)} alerts would have been sent")

    # Always save state (even without token, to build baseline)
    state["ships"] = current_ships
    if current_bdi:
        state["bdi"] = current_bdi
    save_state(state)

    log(f"Run complete: {len(alerts)} alerts, {sent} sent, {len(current_ships)} ships tracked")

if __name__ == "__main__":
    main()
