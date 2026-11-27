#!/usr/bin/env bash
# Builds the playable site into ./dist (Vite). Licensed store assets in public/kits/store are copied by Vite when present.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci --no-audit --no-fund
npm run build
touch dist/.nojekyll
echo "built dist: $(du -sh dist | cut -f1), $(find dist -type f | wc -l) files"
