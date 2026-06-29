#!/bin/bash
echo "======================================"
echo "  VESSEL DATABASE - SYSTEM CHECK"
echo "======================================"

echo ""
echo "=== 1. Service ==="
systemctl is-active bulkwatch

echo ""
echo "=== 2. AIS Live ==="
curl -sk "http://127.0.0.1:3099/api/ais/stats" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'  WS: {d.get(\"wsConnected\")}, Ships: {d[\"totalShips\"]}')" 2>/dev/null

echo ""
echo "=== 3. Crons ==="
crontab -l 2>/dev/null | grep -E "bulkwatch" | while read line; do
  echo "  $line"
done

echo ""
echo "=== 4. Letzte Laeufe ==="
for f in bdi-update.log newbuild-agent.log price-snapshot.log telegram-alerts.log; do
  echo -n "  $f: "
  [ -f /opt/bulkwatch/$f ] && tail -1 /opt/bulkwatch/$f || echo "nie"
done

echo ""
echo "=== 5. Datenbank ==="
cd /opt/bulkwatch
echo "  Schiffe: $(sqlite3 db/ships.db 'SELECT COUNT(*) FROM ships')"
echo "  Mit Bild: $(sqlite3 db/ships.db "SELECT COUNT(*) FROM ships WHERE image_url IS NOT NULL AND image_url != ''")"
echo "  Mit Specs: $(sqlite3 db/ships.db 'SELECT COUNT(*) FROM ships WHERE fuel_consumption_tons_day > 0')"
echo "  History: $(sqlite3 db/ships.db 'SELECT COUNT(*) FROM price_history') records, $(sqlite3 db/ships.db 'SELECT COUNT(DISTINCT date) FROM price_history') dates"
echo "  Reedereien: $(sqlite3 db/ships.db 'SELECT COUNT(*) FROM operators')"

echo ""
echo "=== 6. BDI ==="
grep "bdiCurrent\|bdiDate" src/lib/priceEstimator.ts | head -2

echo ""
echo "=== 7. Seiten ==="
curl -sk -X POST "https://vessels.gemivo.de/api/auth/login" -H "Content-Type: application/json" -d '{"password":"vessel2026"}' -c /tmp/vcCHK > /dev/null
for page in / /newbuilds /karte /voyage-calc /login; do
  code=$(curl -sk -b /tmp/vcCHK -o /dev/null -w "%{http_code}" "https://vessels.gemivo.de$page")
  echo "  $page $code"
done

echo ""
echo "=== 8. Scraper ==="
ps aux | grep image-scraper | grep -v grep > /dev/null && echo "  aktiv" || echo "  nicht aktiv"

echo "======================================"
