#!/usr/bin/env bash
# Runs the production build so phones on the same Wi-Fi can open it (local demo only).
# Payment redirects and sign-in use APP_URL, so it is set to this Mac's Wi-Fi address instead of localhost.
# Usage: npm run demo:lan   (after `npm run build`)
set -euo pipefail
PORT="${PORT:-3000}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
[ -n "$IP" ] || { echo "Couldn't find this Mac's Wi-Fi address. Is Wi-Fi connected?"; exit 1; }
export APP_URL="http://$IP:$PORT"
export BETTER_AUTH_URL="$APP_URL"
echo ""
echo "  Open on this Mac and on your phone (same Wi-Fi):  $APP_URL"
echo "  Use this address on the Mac too, not localhost, so sign-in and payments work the same everywhere."
echo "  Press Ctrl+C to stop."
echo ""
exec bash "$(dirname "$0")/start-prod.sh"
