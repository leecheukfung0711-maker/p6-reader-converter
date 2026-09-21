#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Service status for "P6 Reader & Converter" - macOS / Linux.
#
#   * Ports come from the workspace root .env only.
#   * Reports the app dev server, the optional local FastAPI scaffold, the
#     SQLite file and the Base44 cloud API the app actually calls.
#
# Usage:  bash scripts/status.sh
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

read_env() {
  local key="$1" default="$2" value=""
  if [ -f "$ENV_FILE" ]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  fi
  printf '%s' "${value:-$default}"
}

http_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null || printf '000'
}

FRONTEND_PORT="$(read_env FRONTEND_PORT "")"
BACKEND_PORT="$(read_env BACKEND_PORT "")"

echo "========================================"
echo "  Service Status - P6 Reader & Converter"
echo "========================================"
echo

echo "--- Frontend / app (Vite dev server, port ${FRONTEND_PORT:-?}) ---"
if [ -z "$FRONTEND_PORT" ]; then
  echo "Status: UNKNOWN (FRONTEND_PORT missing from .env)"
elif [ "$(http_code "http://localhost:$FRONTEND_PORT/")" = "200" ]; then
  echo "Status: RUNNING  (http://localhost:$FRONTEND_PORT)"
else
  echo "Status: STOPPED or not responding"
  echo "Start it with: bash scripts/start-all.sh"
fi

echo
echo "--- Local backend (FastAPI scaffold, port ${BACKEND_PORT:-?}) ---"
if [ -z "$BACKEND_PORT" ]; then
  echo "Status: UNKNOWN (BACKEND_PORT missing from .env)"
elif [ "$(http_code "http://localhost:$BACKEND_PORT/health")" = "200" ]; then
  echo "Status: RUNNING  (health OK)"
else
  echo "Status: STOPPED or not responding"
  echo "Note: optional - the app uses the Base44 cloud API instead."
fi

echo
echo "--- Database ---"
DB_FILE="$ROOT_DIR/backend/db/pyworkflow.db"
if [ -f "$DB_FILE" ]; then
  echo "Status: SQLite file present (backend/db/pyworkflow.db, $(wc -c < "$DB_FILE" | tr -d ' ') bytes)"
else
  echo "Status: SQLite file not created yet (backend/db/pyworkflow.db)"
fi

echo
echo "--- Base44 cloud API (what the app really calls) ---"
if [ "$(http_code "https://chronos-flow-chunwo.base44.app")" = "200" ]; then
  echo "Status: REACHABLE (https://chronos-flow-chunwo.base44.app)"
else
  echo "Status: NOT reachable - check the network / VPN / proxy"
fi

echo
echo "--- Listening ports ---"
if command -v lsof >/dev/null 2>&1; then
  FOUND=0
  for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
    [ -n "$port" ] || continue
    if lsof -ti ":$port" >/dev/null 2>&1; then
      echo "  port $port  ->  PID $(lsof -ti ":$port" | tr '\n' ' ')"
      FOUND=1
    fi
  done
  [ "$FOUND" -eq 1 ] || echo "  none"
else
  echo "  (lsof not available - skipped)"
fi
echo
