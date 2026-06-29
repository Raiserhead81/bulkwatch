#!/bin/bash
# Daily commodity price scraper for Vessel Database AI Chat
LOG="/opt/bulkwatch/commodity-update.log"
FILE="/opt/bulkwatch/db/commodities.json"

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

get_price() {
  local url="$1"
  local price=$(curl -s "$url" -H "User-Agent: $UA" 2>/dev/null | grep -oP '(fell to|increased to) [0-9,.]+' | head -1 | grep -oP '[0-9,.]+' | tr -d ',')
  echo "$price"
}

IRON_ORE=$(get_price "https://tradingeconomics.com/commodity/iron-ore")
COAL=$(get_price "https://tradingeconomics.com/commodity/coal")
BRENT=$(get_price "https://tradingeconomics.com/commodity/brent-crude-oil")
WHEAT=$(get_price "https://tradingeconomics.com/commodity/wheat")
CORN=$(get_price "https://tradingeconomics.com/commodity/corn")
SOYBEANS=$(get_price "https://tradingeconomics.com/commodity/soybeans")
NAT_GAS=$(get_price "https://tradingeconomics.com/commodity/eu-natural-gas")
STEEL=$(get_price "https://tradingeconomics.com/commodity/steel")
COPPER=$(get_price "https://tradingeconomics.com/commodity/copper")
ALUMINUM=$(get_price "https://tradingeconomics.com/commodity/aluminum")

TODAY=$(date +"%Y-%m-%d")

cat > "$FILE" << JSONEOF
{
  "date": "$TODAY",
  "iron_ore": { "price": ${IRON_ORE:-0}, "unit": "$/ton", "name": "Iron Ore (62% Fe CFR China)" },
  "coal": { "price": ${COAL:-0}, "unit": "$/ton", "name": "Newcastle Coal" },
  "brent": { "price": ${BRENT:-0}, "unit": "$/barrel", "name": "Brent Crude Oil" },
  "wheat": { "price": ${WHEAT:-0}, "unit": "¢/bushel", "name": "Wheat (CBOT)" },
  "corn": { "price": ${CORN:-0}, "unit": "¢/bushel", "name": "Corn (CBOT)" },
  "soybeans": { "price": ${SOYBEANS:-0}, "unit": "¢/bushel", "name": "Soybeans (CBOT)" },
  "nat_gas": { "price": ${NAT_GAS:-0}, "unit": "€/MWh", "name": "EU Natural Gas (TTF)" },
  "steel": { "price": ${STEEL:-0}, "unit": "$/ton", "name": "Steel (HRC China)" },
  "copper": { "price": ${COPPER:-0}, "unit": "$/ton", "name": "Copper (LME)" },
  "aluminum": { "price": ${ALUMINUM:-0}, "unit": "$/ton", "name": "Aluminum (LME)" }
}
JSONEOF

echo "$(date): Iron=$IRON_ORE Coal=$COAL Brent=$BRENT Wheat=$WHEAT Corn=$CORN" >> "$LOG"
