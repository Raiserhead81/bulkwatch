#!/bin/bash
# Cloudflare Cache Purge — called after every deploy
CF_ZONE="1d51617cd267f310f1a9c14563a2e0de"
CF_TOKEN="${CF_TOKEN:-$(cat /opt/bulkwatch/.cloudflare-token 2>/dev/null)}"

echo "Purging Cloudflare cache..."
RESULT=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}')

if echo "$RESULT" | grep -q success:true; then
  echo "Cloudflare cache purged successfully"
else
  echo "WARNING: Cache purge failed: $RESULT"
fi
