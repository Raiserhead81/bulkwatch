#!/bin/bash
# Wikidata Year+Owner Enricher — retries hourly until successful
LOG="/opt/bulkwatch/wikidata-enricher.log"
LOCK="/tmp/wikidata-enricher.lock"

# Prevent concurrent runs
if [ -f "$LOCK" ]; then exit 0; fi
touch "$LOCK"

cd /opt/bulkwatch
RESULT=$(python3 /tmp/wikidata-years.py 2>&1)
echo "$(date): $RESULT" >> "$LOG"

# If successful (not rate limited), remove from cron
if echo "$RESULT" | grep -q "Updated"; then
    UPDATED=$(echo "$RESULT" | grep -oP "Updated \K[0-9]+")
    if [ "$UPDATED" -gt 0 ]; then
        echo "$(date): SUCCESS - $UPDATED ships updated. Removing hourly retry." >> "$LOG"
        crontab -l | grep -v wikidata-enricher | crontab -
    fi
fi

rm -f "$LOCK"
