#!/bin/bash
set -e
cd /opt/bulkwatch

echo "=== Building Maritime AI ==="
bun run build

echo "=== Restarting service ==="
systemctl restart bulkwatch

echo "=== Waiting for startup ==="
sleep 3
if systemctl is-active --quiet bulkwatch; then
  echo "=== Maritime AI is running ==="
  curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3099/
  echo ""
else
  echo "=== ERROR: Service failed to start ==="
  journalctl -u bulkwatch --no-pager -n 20
  exit 1
fi
