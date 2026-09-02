#!/bin/bash
# BulkWatch Health Check — Cron alle 5 Minuten
# Alarmiert NUR bei echtem, ANHALTENDEM Ausfall:
#   - HTTP-Check mit Retry (Endpoint /api/version ist ~3-4s langsam -> großzügiges Timeout)
#   - Schwelle: erst nach FAIL_THRESHOLD Fehl-Checks in Folge (Spam durch curl-000-Blips vermeiden)
#   - Spam-Schutz: max. 1 Alarm pro Ausfall + eine Recovery-Meldung
LOG=/var/log/bulkwatch-health.log
STATE=/opt/bulkwatch/db/health_state      # "fails alerted"
FAIL_THRESHOLD=3                           # 3x hintereinander (~15 Min) bevor Alarm
HTTP_URL=http://127.0.0.1:3099/api/version
HTTP_TIMEOUT=20
RETRIES=3

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
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] TELEGRAM: $msg" >> "$LOG"
}
logline() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# --- Gesundheit prüfen (Service, dann HTTP mit Retry) ---
healthy=1; reason=""; code=""
if ! systemctl is-active --quiet bulkwatch; then
  healthy=0; reason="Service DOWN"
else
  ok=0
  for i in $(seq 1 "$RETRIES"); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$HTTP_TIMEOUT" "$HTTP_URL" 2>/dev/null)
    if [ "$code" = "200" ]; then ok=1; break; fi
    sleep 3
  done
  if [ "$ok" != "1" ]; then healthy=0; reason="HTTP nicht erreichbar (letzter Code: $code)"; fi
fi

# --- State laden ---
fails=0; alerted=0
if [ -f "$STATE" ]; then read -r fails alerted < "$STATE"; fi
[ -z "$fails" ] && fails=0
[ -z "$alerted" ] && alerted=0

if [ "$healthy" = "1" ]; then
  if [ "$alerted" = "1" ]; then
    send_alert "✅ wieder erreichbar"
  fi
  echo "0 0" > "$STATE"
  logline "OK"
else
  fails=$((fails + 1))
  if [ "$fails" -ge "$FAIL_THRESHOLD" ] && [ "$alerted" = "0" ]; then
    send_alert "⚠️ $reason — seit ~$((fails * 5)) Min."
    alerted=1
  fi
  echo "$fails $alerted" > "$STATE"
  logline "FAIL ($reason) count=$fails alerted=$alerted"
fi
