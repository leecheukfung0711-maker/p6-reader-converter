#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start every service of "P6 Reader & Converter" - macOS / Linux.
#
#   * Ports come from the workspace root .env only (never hardcoded, never
#     port+1 - see AGENTS.md "Port conflict rule").
#   * The frontend (the app itself) is started first because that is what the
#     user needs. The local FastAPI scaffold is OPT-IN: this app talks to the
#     Base44 cloud API and never calls it, so it is not started by default.
#   * Opt in with START_BACKEND=1; when it runs, a failure is a WARNING only.
#     The legacy SKIP_BACKEND=1 still means skip.
#
#   * When everything is ready the app is opened in the default browser: every
#     tool (Gantt view, import, compare, merge, export, feedback) lives on that
#     one page. Disable with NO_BROWSER=1; open extra pages as well with
#     OPEN_URLS="http://localhost:25156/docs https://..." (space separated).
#
# Usage:  bash scripts/start-all.sh
#         START_BACKEND=1 bash scripts/start-all.sh
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

# Listening check without depending on lsof: try lsof first, then curl.
port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$port" >/dev/null 2>&1 && return 0
  fi
  curl -s -o /dev/null --max-time 2 "http://localhost:$port/" >/dev/null 2>&1
}

# Open a URL in the default browser (macOS "open", Linux "xdg-open").
open_url() {
  local url="$1"
  if [ "${NO_BROWSER:-0}" = "1" ]; then
    echo "[start-all] NO_BROWSER=1 - not opening $url"
    return 0
  fi
  echo "[start-all] Opening $url"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  else
    echo "[start-all] no browser opener found - open $url manually."
  fi
}

FRONTEND_PORT="$(read_env FRONTEND_PORT "")"
BACKEND_PORT="$(read_env BACKEND_PORT "")"

if [ -z "$FRONTEND_PORT" ]; then
  echo "[start-all] FRONTEND_PORT not found in $ENV_FILE - aborting." >&2
  exit 1
fi

echo "========================================"
echo "  Starting P6 Reader & Converter"
echo "========================================"
echo "  Root      : $ROOT_DIR"
echo "  Frontend  : http://localhost:$FRONTEND_PORT"
echo "  Backend   : http://localhost:$BACKEND_PORT/health"
echo

# ---- Frontend (the app) ---------------------------------------------------
if port_in_use "$FRONTEND_PORT"; then
  echo "[start-all] Frontend already running on port $FRONTEND_PORT - skipping start."
  FRONTEND_PID="(already running)"
else
  echo ">>> Starting frontend (the app) on port $FRONTEND_PORT ..."
  NO_BROWSER=1 bash "$SCRIPT_DIR/start-frontend.sh" &
  FRONTEND_PID=$!
  echo "[start-all] Waiting for the frontend (timeout 120s) ..."
  RETRY=0
  while [ "$RETRY" -lt 60 ]; do
    if port_in_use "$FRONTEND_PORT"; then break; fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo "[start-all] ERROR: the frontend process died - see the log above." >&2
      exit 1
    fi
    RETRY=$((RETRY + 1))
    sleep 2
  done
  if [ "$RETRY" -ge 60 ]; then
    echo "[start-all] ERROR: frontend not ready after 120s." >&2
    exit 1
  fi
  echo "[start-all] Frontend is ready."
fi

# ---- Backend (local FastAPI scaffold) - OPT-IN -----------------------------
#   Not started by default: the app talks to the Base44 cloud API and never
#   calls this backend. Opt in with START_BACKEND=1, or run
#   scripts/start-backend.sh in its own terminal.
echo
BACKEND_STATE="not running"
if [ "${SKIP_BACKEND:-0}" = "1" ]; then
  echo "[start-all] SKIP_BACKEND=1 - local backend not started."
  BACKEND_PID="(skipped)"
elif [ "${START_BACKEND:-0}" != "1" ]; then
  echo "[start-all] Local backend is opt-in - not started (run scripts/start-backend.sh when you need it)."
  if curl -s --max-time 2 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    BACKEND_STATE="running"
  fi
  BACKEND_PID="(not started)"
elif [ -z "$BACKEND_PORT" ]; then
  echo "[start-all] BACKEND_PORT not found in .env - local backend not started."
  BACKEND_PID="(skipped)"
elif curl -s --max-time 2 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
  echo "[start-all] Backend already running on port $BACKEND_PORT - skipping start."
  BACKEND_PID="(already running)"
  BACKEND_STATE="running"
else
  echo ">>> Starting local backend on port $BACKEND_PORT ..."
  bash "$SCRIPT_DIR/start-backend.sh" &
  BACKEND_PID=$!
  echo "[start-all] Waiting for the backend (timeout 60s) ..."
  RETRY=0
  while [ "$RETRY" -lt 30 ]; do
    if curl -s --max-time 2 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then break; fi
    RETRY=$((RETRY + 1))
    sleep 2
  done
  if [ "$RETRY" -ge 30 ]; then
    echo "[start-all] WARNING: backend not up after 60s - continuing anyway."
    echo "[start-all] The app does not need it - see the start-backend log above."
  else
    echo "[start-all] Backend is ready."
    BACKEND_STATE="running"
  fi
fi

echo
echo "========================================"
echo "  All services started"
echo "  Open       : http://localhost:$FRONTEND_PORT"
if [ "$BACKEND_STATE" = "running" ] && [ -n "$BACKEND_PORT" ]; then
  echo "  Health     : http://localhost:$BACKEND_PORT/health"
else
  echo "  Backend    : not running (opt-in: bash scripts/start-backend.sh)"
fi
echo "  Status     : bash scripts/status.sh"
echo "  Stop       : bash scripts/stop-all.sh"
echo "========================================"
echo
echo "PIDs: frontend=${FRONTEND_PID} backend=${BACKEND_PID}"
echo "Press Ctrl+C to stop the foreground log; services keep running in this shell."

# Everything is ready: open the app (all tools live on that single page).
open_url "http://localhost:$FRONTEND_PORT/"
if [ -n "${OPEN_URLS:-}" ]; then
  for url in $OPEN_URLS; do
    open_url "$url"
  done
fi

wait
