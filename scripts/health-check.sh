#!/bin/bash
# BulkWatch Health Check — Cron alle 5 Minuten
# Prüft ob bulkwatch läuft (equasis-Check entfernt 08.07 — Daemon schläft legitim)
# Sendet Telegram-Alert bei Ausfall

LOG=/var/log/bulkwatch-health.log

# .env laden für Telegram-Credentials
if [ -f /opt/bulkwatch/.env ]; then
  export $(grep -E '^TELEGRAM_' /opt/bulkwatch/.env | xargs)
fi

send_alert() {
  local msg="$1"
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="$TELEGRAM_CHAT_ID" \
      -d text="[BulkWatch] $msg" \
      -d parse_mode="HTML" > /dev/null 2>&1
  fi
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $msg" >> "$LOG"
}

ISSUES=0

# Prüfe bulkwatch systemd service
if ! systemctl is-active --quiet bulkwatch; then
  send_alert "bulkwatch service is DOWN!"
  ISSUES=$((ISSUES + 1))
fi


# Prüfe HTTP-Response (lokal)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:3099/api/version 2>/dev/null)
if [ "$HTTP_CODE" != "200" ]; then
  send_alert "BulkWatch HTTP check failed (code: $HTTP_CODE)"
  ISSUES=$((ISSUES + 1))
fi

if [ $ISSUES -eq 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK" >> "$LOG"
fi
