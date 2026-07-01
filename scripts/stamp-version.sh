#!/bin/bash
# Stamp build version into API and client checker
VERSION=$(date +%s)
sed -i "s/version: \"[0-9]*\"/version: \"$VERSION\"/" /opt/bulkwatch/src/app/api/version/route.ts
sed -i "s/BUILD_VERSION = \"[0-9]*\"/BUILD_VERSION = \"$VERSION\"/" /opt/bulkwatch/src/components/version-checker.tsx
echo "Build version stamped: $VERSION"
