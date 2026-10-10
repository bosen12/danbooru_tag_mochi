#!/bin/sh
# macOS / Linux launcher: find Python 3.9+, open the browser, start the server.
# Card art downloads in the background on first start (skip: NO_CARD_FETCH=1).
cd "$(dirname "$0")" || exit 1
PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 9))' 2>/dev/null; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "Python 3.9 or newer not found. Install it from https://www.python.org/downloads/"
  exit 1
fi
PORT="${PORT:-8796}"
# Listen on every interface like start.bat, so phones on Tailscale can connect.
# Only this computer and Tailscale (100.64.0.0/10) are allowed unless ALLOW_NET says otherwise.
HOST="${HOST:-0.0.0.0}"
export PORT HOST PYTHONUTF8=1
URL="http://127.0.0.1:$PORT/"
echo "Mochi  $URL"
# The server opens the browser once it accepts connections.
OPEN_BROWSER=1
export OPEN_BROWSER
exec "$PY" server.py
