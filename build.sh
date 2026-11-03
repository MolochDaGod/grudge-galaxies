#!/usr/bin/env bash
# Builds the Cloudflare Pages site in ./dist from the artifact page and its assets.
set -euo pipefail
SRC=${SRC:-/home/claude}
rm -rf dist && mkdir -p dist/kits
{ printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '<style>:root{color-scheme:light;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%%}[hidden]{display:none!important}</style>'
  printf '<script src="config.js"></script><script src="shim.js"></script></head><body>\n'
  cat "$SRC/swg-atlas.html"
  printf '\n</body></html>\n'; } > dist/index.html
cp "$SRC"/{anim.js,kit.js,toon.js,cart.js} dist/
cp -r "$SRC/ui" dist/ui
cp "$SRC"/kits/*.js dist/kits/
for d in trees animals ground; do mkdir -p dist/kits/$d; cp "$SRC"/kits/$d/*.{js,jpg} dist/kits/$d/ 2>/dev/null || true; done
cp web/shim.js dist/
[ -f dist/config.js ] || cp web/config.js dist/config.js
cp web/_headers dist/_headers
echo "built dist: $(du -sh dist | cut -f1), $(find dist -type f | wc -l) files"
