#!/bin/bash
# Daily BDI updater for Vessel Database
# Runs via cron, scrapes current BDI from Trading Economics

BDI_FILE="/opt/bulkwatch/src/lib/priceEstimator.ts"
LOG="/opt/bulkwatch/bdi-update.log"

# Scrape BDI
BDI=$(curl -s "https://tradingeconomics.com/commodity/baltic" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
  2>/dev/null | grep -oP 'Baltic Dry fell to \K[0-9,]+|Baltic Dry increased to \K[0-9,]+' | head -1 | tr -d ',')

if [ -z "$BDI" ]; then
  # Fallback: investing.com
  BDI=$(curl -s "https://www.investing.com/indices/baltic-dry" \
    -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
    2>/dev/null | grep -oP 'instrument-price-last">[0-9,]+' | head -1 | tr -d ',' | cut -d'>' -f2)
fi

if [ -z "$BDI" ] || [ "$BDI" -lt 100 ] 2>/dev/null || [ "$BDI" -gt 20000 ] 2>/dev/null; then
  echo "$(date): BDI scrape failed (got: '$BDI')" >> "$LOG"
  exit 1
fi

# Determine trend
OLD_BDI=$(grep -oP 'bdiCurrent:\s*\K[0-9]+' "$BDI_FILE")
if [ -n "$OLD_BDI" ]; then
  if [ "$BDI" -gt "$((OLD_BDI + 50))" ]; then
    TREND="rising"
  elif [ "$BDI" -lt "$((OLD_BDI - 50))" ]; then
    TREND="falling"
  else
    TREND="stable"
  fi
else
  TREND="stable"
fi

TODAY=$(date +"%d %b %Y")

# Update priceEstimator.ts
sed -i "s/bdiCurrent: [0-9]*/bdiCurrent: $BDI/" "$BDI_FILE"
sed -i "s/bdiTrend: \"[a-z]*\"/bdiTrend: \"$TREND\"/" "$BDI_FILE"
sed -i "s/bdiDate: \"[^\"]*\"/bdiDate: \"$TODAY\"/" "$BDI_FILE"

echo "$(date): BDI updated to $BDI (was $OLD_BDI, trend: $TREND)" >> "$LOG"

# Rebuild
cd /opt/bulkwatch
npm run build >> "$LOG" 2>&1
systemctl restart bulkwatch >> "$LOG" 2>&1

echo "$(date): Rebuild complete" >> "$LOG"
