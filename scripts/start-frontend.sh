#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start the P6 Reader & Converter frontend (Vite dev server) - macOS / Linux.
#
#   * FRONTEND_PORT always comes from the workspace root .env. The app's own
#     vite.config.js reads it with loadEnv() and enforces strictPort, so the
#     port is never hardcoded and never becomes port+1.
#   * The dev server is started with `node node_modules/vite/bin/vite.js`
#     (same entry point `vite` uses) so this stays identical to the Windows
#     script Baes44/chronos-flow-chunwo/scripts/start-local.bat.
#   * Dependencies are installed only when node_modules is missing, always with
#     --ignore-scripts (the workspace path contains "&", which breaks some
#     postinstall scripts such as tesseract.js).
#
# Usage:  bash scripts/start-frontend.sh
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
APP_DIR="$ROOT_DIR/Baes44/chronos-flow-chunwo"

read_env() {
  local key="$1" default="$2" value=""
  if [ -f "$ENV_FILE" ]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  fi
  printf '%s' "${value:-$default}"
}

# Open a URL in the default browser (macOS "open", Linux "xdg-open").
open_url() {
  local url="$1"
  if [ "${NO_BROWSER:-0}" = "1" ]; then
    echo "[start-frontend] NO_BROWSER=1 - not opening $url"
    return 0
  fi
  echo "[start-frontend] Opening $url"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  else
    echo "[start-frontend] no browser opener found - open $url manually."
  fi
}

echo "========================================"
echo "  Starting P6 Reader & Converter (frontend)"
echo "========================================"
echo

echo "[1/4] Checking Node.js ..."
if ! command -v node >/dev/null 2>&1; then
  echo "[start-frontend] ERROR: Node.js is not installed. Install Node.js 20+ from https://nodejs.org" >&2
  exit 1
fi

echo
echo "[2/4] Loading the port from the workspace root .env ..."
FRONTEND_PORT="$(read_env FRONTEND_PORT "")"
if [ -z "$FRONTEND_PORT" ]; then
  echo "[start-frontend] ERROR: FRONTEND_PORT not found in $ENV_FILE - aborting." >&2
  exit 1
fi
echo "    FRONTEND_PORT=$FRONTEND_PORT"

echo
echo "[3/4] Checking the app ..."
if [ ! -f "$APP_DIR/package.json" ]; then
  echo "[start-frontend] ERROR: the app was not found at $APP_DIR - aborting." >&2
  exit 1
fi
if [ ! -f "$APP_DIR/vite.config.js" ]; then
  echo "[start-frontend] ERROR: $APP_DIR/vite.config.js is missing - aborting." >&2
  exit 1
fi
cd "$APP_DIR" || exit 1
if [ ! -d node_modules ]; then
  echo "[start-frontend] node_modules is missing - installing (first run only) ..."
  npm install --ignore-scripts --no-audit --no-fund || {
    echo "[start-frontend] ERROR: dependency install failed." >&2
    exit 1
  }
else
  echo "    node_modules found - skipping install."
fi

echo
echo "[4/4] Starting the dev server on port $FRONTEND_PORT ..."
echo "    Open http://localhost:$FRONTEND_PORT in your browser."
echo "    Press Ctrl+C to stop."
echo

# This shell is replaced by the dev server (exec), so a browser can only be
# opened here when the app is already answering. scripts/start-all.sh is the
# entry point that waits for readiness and then opens the browser itself.
if [ "${NO_BROWSER:-0}" = "1" ]; then
  echo "[start-frontend] NO_BROWSER=1 - not opening a browser."
elif curl -s -o /dev/null --max-time 2 "http://localhost:$FRONTEND_PORT/"; then
  open_url "http://localhost:$FRONTEND_PORT/"
  if [ -n "${OPEN_URLS:-}" ]; then
    for url in $OPEN_URLS; do
      open_url "$url"
    done
  fi
fi

exec node node_modules/vite/bin/vite.js
