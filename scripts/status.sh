#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Service status for "P6 Reader & Converter" - macOS / Linux.
#
#   * Ports come from the workspace root .env only.
#   * Reports the app dev server, the local FastAPI backend, the local OCR
#     plugin (PP-OCR helper + the engines it can launch), the SQLite file and
#     the Base44 cloud API the app actually calls.
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
OCR_LAUNCHER_URL="$(read_env OCR_LAUNCHER_URL "http://127.0.0.1:8199")"

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
  echo "Start it with: bash scripts/start-all.sh (or bash scripts/start-backend.sh)"
fi

echo
echo "--- Local OCR plugin (PP-OCR helper + engines) ---"
LAUNCHER_JSON="$(curl -s --max-time 5 "$OCR_LAUNCHER_URL/launch/services" 2>/dev/null || true)"
if ! printf '%s' "$LAUNCHER_JSON" | grep -q "launcher"; then
  echo "Status: helper NOT running ($OCR_LAUNCHER_URL)"
  echo "Start it with: bash scripts/start-all.sh (set OCR_HELPER_CMD)"
else
  echo "Status: helper RUNNING ($OCR_LAUNCHER_URL)"
  for engine in pstocr ollama; do
    if printf '%s' "$LAUNCHER_JSON" | grep -q "\"id\": \"$engine\"[^}]*\"running\": true"; then
      echo "  engine $engine: running"
    else
      echo "  engine $engine: stopped - the app starts it on demand"
    fi
  done
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
