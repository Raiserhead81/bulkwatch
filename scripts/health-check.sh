#!/bin/bash
echo "══════════════════════════════════════════"
echo "  FULL SYSTEM HEALTH CHECK"
echo "══════════════════════════════════════════"

echo ""
echo "=== 1. SERVICE ==="
systemctl is-active bulkwatch
curl -sk -o /dev/null -w "  HTTPS: %{http_code}\n" "https://vessels.gemivo.de/login"

echo ""
echo "=== 2. AIS LIVE ==="
curl -sk "http://127.0.0.1:3099/api/ais/stats" 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E "total|wsConn|uptime" || echo "  OFFLINE"

echo ""
echo "=== 3. SEITEN ==="
curl -sk -X POST "https://vessels.gemivo.de/api/auth/login" -H "Content-Type: application/json" -d '{"password":"vessel2026"}' -c /tmp/hc > /dev/null
for p in / /newbuilds /karte /live /top-picks /vergleich /watchlist /voyage-calc /chat; do
  code=$(curl -sk -b /tmp/hc -o /dev/null -w "%{http_code}" "https://vessels.gemivo.de$p")
  echo "  $p $code"
done

echo ""
echo "=== 4. APIs ==="
for ep in "/api/ships?limit=1" "/api/ships/stats" "/api/ais/stats" "/api/ships/operators"; do
  code=$(curl -sk -b /tmp/hc -o /dev/null -w "%{http_code}" "https://vessels.gemivo.de$ep")
  echo "  $ep $code"
done

echo ""
echo "=== 5. CRONS ==="
crontab -l 2>/dev/null | grep bulkwatch

echo ""
echo "=== 6. DATENBANK ==="
cd /opt/bulkwatch
python3 -c "
import sqlite3
db = sqlite3.connect('db/ships.db')
total = db.execute('SELECT COUNT(*) FROM ships').fetchone()[0]
images = db.execute(\"SELECT COUNT(*) FROM ships WHERE image_url IS NOT NULL AND image_url != ''\").fetchone()[0]
operators = db.execute(\"SELECT COUNT(*) FROM ships WHERE operator IS NOT NULL AND operator != ''\").fetchone()[0]
years = db.execute('SELECT COUNT(*) FROM ships WHERE year_built > 1900').fetchone()[0]
specs = db.execute('SELECT COUNT(*) FROM ships WHERE fuel_consumption_tons_day > 0').fetchone()[0]
positions = db.execute('SELECT COUNT(*) FROM ships WHERE lat IS NOT NULL AND lat != 0').fetchone()[0]
reedereien = db.execute('SELECT COUNT(*) FROM operators').fetchone()[0]
history = db.execute('SELECT COUNT(*) FROM price_history').fetchone()[0]
print(f'  Schiffe:    {total}')
print(f'  Bilder:     {images} ({images*100//total}%)')
print(f'  Operator:   {operators} ({operators*100//total}%)')
print(f'  Baujahr:    {years} ({years*100//total}%)')
print(f'  Specs:      {specs} ({specs*100//total}%)')
print(f'  Positionen: {positions} ({positions*100//total}%)')
print(f'  Reedereien: {reedereien}')
print(f'  History:    {history} records')
"

echo ""
echo "=== 7. LETZTE CRON-LAEUFE ==="
for f in bdi-update.log bunker-update.log commodity-update.log newbuild-agent.log alerts.log wikidata-enricher.log price-snapshot.log; do
  echo -n "  $f: "
  [ -f "$f" ] && tail -1 "$f" 2>/dev/null || echo "nie"
done

echo ""
echo "=== 8. SCRAPER ==="
ps aux | grep "image-scraper\|scrape" | grep python | grep -v grep > /dev/null && echo "  Bilder-Scraper: AKTIV" || echo "  Bilder-Scraper: nicht aktiv"
[ -f scraper-v3.log ] && tail -1 scraper-v3.log

echo ""
echo "=== 9. SHIP DETAIL TEST ==="
curl -sk -b /tmp/hc "https://vessels.gemivo.de/api/ships/9291923" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f\"  {d['name']} | {d['type']} | {d['dwt']:,} DWT | Built {d.get('yearBuilt','?')} | {d.get('fuelConsumption',0)} t/day | {d.get('operator','?')}\")
" 2>/dev/null

echo ""
echo "=== 10. PRICE HISTORY TEST ==="
curl -sk -b /tmp/hc "https://vessels.gemivo.de/api/ships/9291923/history" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f\"  Points: {d.get('dataPoints',0)} | Current: \${d.get('current',0)/1e6:.1f}M | 30d: {d.get('change30dPct',0)}% | 1y: {d.get('change1yPct',0)}%\")
" 2>/dev/null

echo ""
echo "=== 11. WEATHER API ==="
curl -sk -b /tmp/hc "https://vessels.gemivo.de/api/weather/route?fromLat=-20.3&fromLon=118.6&toLat=36.0&toLon=120.3" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
r=d.get('route',{})
print(f\"  {r.get('condition','?')} | Waves {r.get('avgWaveHeight',0)}m | Wind {r.get('avgWindSpeedKn',0)}kn | Speed loss {r.get('estimatedSpeedLoss',0)}%\")
" 2>/dev/null

echo ""
echo "=== 12. AI CHAT ==="
curl -sk -b /tmp/hc -X POST "https://vessels.gemivo.de/api/chat" -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"How many ships?"}]}' 2>/dev/null | head -5 | grep -q "data:" && echo "  Streaming: OK" || echo "  FAIL"

echo ""
echo "=== 13. DISK ==="
df -h / | tail -1

echo ""
echo "══════════════════════════════════════════"
