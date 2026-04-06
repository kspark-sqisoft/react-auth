#!/bin/sh
set -e
cd /app
STAMP=node_modules/.npm-sync-stamp
HASH=$(cat package.json package-lock.json 2>/dev/null | sha256sum | awk '{print $1}')
OLD=$(cat "$STAMP" 2>/dev/null || echo "")
if [ "$HASH" != "$OLD" ] || [ ! -x node_modules/.bin/vite ]; then
  echo "[docker-dev] frontend: npm 의존성 동기화 중…"
  npm install --no-audit --no-fund
  mkdir -p node_modules
  printf '%s' "$HASH" > "$STAMP"
fi
exec npm run dev -- --host 0.0.0.0 --port 5173
