#!/bin/bash
# Daily bunker price update — derives VLSFO/HSFO/MGO from Brent crude
# Runs after BDI update (18:30 UTC)

CALC_FILE="/opt/bulkwatch/src/app/voyage-calc/page.tsx"
LOG="/opt/bulkwatch/bunker-update.log"

# Get Brent crude price
BRENT=$(curl -s "https://tradingeconomics.com/commodity/brent-crude-oil" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" \
  2>/dev/null | grep -oP '(fell to|increased to) [0-9.]+' | head -1 | grep -oP '[0-9.]+')

if [ -z "$BRENT" ] || [ "$(echo "$BRENT < 20" | bc)" = "1" ] || [ "$(echo "$BRENT > 200" | bc)" = "1" ]; then
  echo "$(date): Brent scrape failed (got: '$BRENT')" >> "$LOG"
  exit 1
fi

# Calculate bunker prices (industry correlation)
VLSFO=$(python3 -c "print(round(float('$BRENT') * 8.2))")
HSFO=$(python3 -c "print(round(float('$BRENT') * 5.8))")
MGO=$(python3 -c "print(round(float('$BRENT') * 12.5))")

# Update the default fuel price in voyage calc
sed -i "s/const \[fuelPrice, setFuelPrice\] = useState([0-9]*)/const [fuelPrice, setFuelPrice] = useState($VLSFO)/" "$CALC_FILE"

echo "$(date): Brent=$BRENT → VLSFO=$VLSFO HSFO=$HSFO MGO=$MGO" >> "$LOG"
