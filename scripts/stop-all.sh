#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Stop every service of "P6 Reader & Converter" - macOS / Linux.
#
#   * Ports come from the workspace root .env only.
#   * Only the PIDs listening on those ports are killed; nothing else on the
#     machine is touched (no blanket `pkill -f vite`).
#   * The OCR plugin is NOT touched by default: the PP-OCR helper and its
#     engines (PST-OCR, Ollama) may be shared with other tools. Set
#     STOP_OCR=1 to also ask the helper's launcher to stop those engines.
#   * This is the documented way to free a busy port: run this, then
#     scripts/start-all.sh again. Never edit .env and never use port+1.
#
# Usage:  bash scripts/stop-all.sh
#         STOP_OCR=1 bash scripts/stop-all.sh
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

FRONTEND_PORT="$(read_env FRONTEND_PORT "")"
BACKEND_PORT="$(read_env BACKEND_PORT "")"
OCR_LAUNCHER_URL="$(read_env OCR_LAUNCHER_URL "http://127.0.0.1:8199")"

echo "========================================"
echo "  Stopping P6 Reader & Converter"
echo "========================================"
echo
echo "Ports from .env: frontend=$FRONTEND_PORT backend=$BACKEND_PORT"
echo

if ! command -v lsof >/dev/null 2>&1; then
  echo "[stop-all] ERROR: lsof is not available - cannot find processes by port." >&2
  echo "[stop-all] Install it (e.g. apt install lsof) or stop the services manually." >&2
  exit 1
fi

kill_port() {
  local port="$1" label="$2" pids=""
  if [ -z "$port" ]; then
    echo "[stop-all] no port for $label - skipped."
    return 0
  fi
  pids="$(lsof -ti ":$port" 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "[stop-all] port $port ($label) is already free."
    return 0
  fi
  echo "$pids" | while read -r pid; do
    [ -n "$pid" ] || continue
    echo "[stop-all] killing $label PID $pid on port $port"
    kill -9 "$pid" 2>/dev/null || true
  done
}

kill_port "$FRONTEND_PORT" "frontend"
kill_port "$BACKEND_PORT" "backend"

echo
if [ "${STOP_OCR:-0}" != "1" ]; then
  echo "[stop-all] OCR plugin left running (set STOP_OCR=1 to stop its engines too)."
elif ! curl -s --max-time 5 "$OCR_LAUNCHER_URL/launch/services" 2>/dev/null | grep -q "launcher"; then
  echo "[stop-all] OCR helper not running - nothing to stop."
else
  echo "--- OCR plugin (STOP_OCR=1) ---"
  for engine in pstocr ollama; do
    if curl -s --max-time 15 -o /dev/null \
        -X POST -H "Content-Type: application/json" \
        -d "{\"id\":\"$engine\"}" "$OCR_LAUNCHER_URL/launch/stop" 2>/dev/null; then
      echo "[stop-all] OCR engine $engine: stop requested."
    else
      echo "[stop-all] WARNING: could not reach the OCR launcher for engine $engine."
    fi
  done
  echo "[stop-all] The PP-OCR helper itself keeps running (stop it yourself)."
fi

echo
echo "[stop-all] Done."
