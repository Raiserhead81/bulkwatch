#!/bin/bash
# Equasis daily throughput monitor — runs via cron at 23:55
STATUS="/opt/bulkwatch/equasis-status.json"
DB="/opt/bulkwatch/db/ships.db"
LOG="/var/log/bulkwatch-equasis.log"
ENVF="/etc/stockbot/monitor.env"
TODAY=$(date +%Y-%m-%d)

# Count today enriched
TODAY_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM ships WHERE equasis_last_scraped = '$TODAY'")
TOTAL_ENRICHED=$(sqlite3 "$DB" "SELECT COUNT(*) FROM ships WHERE equasis_last_scraped IS NOT NULL")
TOTAL_SHIPS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM ships")
REMAINING=$((TOTAL_SHIPS - TOTAL_ENRICHED))

# Check account status from status file
ACTIVE=$(python3 -c "import json; d=json.load(open('$STATUS')); print(sum(1 for a in d['accounts'] if a['status']=='active'))" 2>/dev/null || echo "?")
LOCKED=$(python3 -c "import json; d=json.load(open('$STATUS')); print(sum(1 for a in d['accounts'] if a['status']=='locked'))" 2>/dev/null || echo "?")

# Alert if below target
MSG="[Equasis $TODAY] Enriched: $TODAY_COUNT/800 | Active: $ACTIVE | Locked: $LOCKED | Total: $TOTAL_ENRICHED/$TOTAL_SHIPS | Rest: $REMAINING"

echo "$MSG" >> /var/log/equasis-daily.log

if [ "$TODAY_COUNT" -lt 400 ]; then
    echo "⚠ LOW THROUGHPUT: $MSG" >> "$LOG"
fi

# ── Telegram-Alarm: Daemon tot ODER ganzer Tag ohne Durchsatz ──
DAEMON_STATE=$(systemctl is-active equasis-daemon 2>/dev/null)
ALARM=""
if [ "$DAEMON_STATE" != "active" ]; then
    ALARM="⛔ Equasis-Daemon läuft NICHT (Status: ${DAEMON_STATE:-unbekannt})."
elif [ "$TODAY_COUNT" -eq 0 ]; then
    ALARM="⛔ Equasis heute 0 Schiffe enriched (Daemon active, aber kein Durchsatz)."
fi

if [ -n "$ALARM" ]; then
    TELEGRAM_TOKEN=$(grep '^TELEGRAM_TOKEN=' "$ENVF" 2>/dev/null | cut -d= -f2- | tr -d '"')
    TELEGRAM_CHAT_ID=$(grep '^TELEGRAM_CHAT_ID=' "$ENVF" 2>/dev/null | cut -d= -f2- | tr -d '"')
    if [ -n "$TELEGRAM_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -m 20 -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
            -H 'Content-Type: application/json' \
            -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"${ALARM} ${MSG}\"}" >/dev/null
        echo "⛔ TELEGRAM gesendet: $ALARM" >> "$LOG"
    else
        echo "⚠ Telegram-Creds fehlen ($ENVF) — Alarm NICHT gesendet: $ALARM" >> "$LOG"
    fi
fi
