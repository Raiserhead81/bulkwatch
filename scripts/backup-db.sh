#!/bin/bash
# BulkWatch SQLite Backup — daily via cron
# Keeps last 7 backups, logs to /var/log/bulkwatch-backup.log

BACKUP_DIR=/root/backups/bulkwatch
DB_PATH=/opt/bulkwatch/db/ships.db
LOG=/var/log/bulkwatch-backup.log
DATE=$(date +%F)
BACKUP_FILE="${BACKUP_DIR}/ships-${DATE}.db"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..." >> "$LOG"

# Prüfe ob DB existiert
if [ ! -f "$DB_PATH" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: DB not found at $DB_PATH" >> "$LOG"
  exit 1
fi

# SQLite .backup (konsistenter Snapshot)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>> "$LOG"

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK: $BACKUP_FILE ($SIZE)" >> "$LOG"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Backup failed" >> "$LOG"
  exit 1
fi

# Alte Backups löschen (nur die letzten 7 behalten)
cd "$BACKUP_DIR" && ls -t ships-*.db 2>/dev/null | tail -n +8 | xargs -r rm -f
REMAINING=$(ls ships-*.db 2>/dev/null | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Retention: $REMAINING backups kept" >> "$LOG"
