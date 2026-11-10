#!/usr/bin/env bash
# Runs the production (standalone) build — the same way it will run on a Hostinger VPS under PM2.
# Usage: npm run demo:start   (builds first)   or   bash scripts/start-prod.sh   (after `npm run build`)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.local}"
cd "$ROOT"
[ -f .next/standalone/server.js ] || { echo "No build found. Run: npm run build"; exit 1; }
# Standalone output does not include static assets; copy them next to the server.
rm -rf .next/standalone/public .next/standalone/.next/static
cp -R public .next/standalone/public
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
mkdir -p "$ROOT/uploads"
export UPLOAD_DIR="$ROOT/uploads"
export PORT="${PORT:-3000}"
export HOSTNAME="${HOSTNAME_BIND:-0.0.0.0}"
cd .next/standalone
echo "Chill. Express running on http://localhost:$PORT"
exec node --env-file="$ENV_FILE" server.js
