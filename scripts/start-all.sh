#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start every service of "P6 Reader & Converter" - macOS / Linux.
#
#   1. Frontend   - the app itself (Vite dev server, FRONTEND_PORT).
#   2. Backend    - local FastAPI scaffold (BACKEND_PORT): stores projects and
#                   programme versions for the ProjectBar.
#   3. OCR plugin - the PP-OCR helper (default http://127.0.0.1:8199) and, via
#                   its launcher API, the local OCR engines it can bring up
#                   (PST-OCR :7861, Ollama :11434). This is what the Import
#                   dialog's "Local OCR" engines talk to.
#
#   * Ports come from the workspace root .env only (never hardcoded, never
#     port+1 - see AGENTS.md "Port conflict rule"). The OCR endpoints are not
#     part of .env: they mirror src/lib/localOcr.js and can be overridden with
#     OCR_LAUNCHER_URL / OCR_HELPER_CMD.
#   * Everything starts by default. Opt out per group with SKIP_BACKEND=1 /
#     SKIP_OCR=1 (START_BACKEND=1 is still accepted and now just means the
#     default). Backend / OCR problems are WARNINGS only - never a hard stop.
#
#   * When everything is ready the app is opened in the default browser: every
#     tool (Gantt view, import, compare, merge, export, feedback) lives on that
#     one page. Disable with NO_BROWSER=1; open extra pages as well with
#     OPEN_URLS="http://localhost:25156/docs https://..." (space separated).
#
# Usage:  bash scripts/start-all.sh
#         SKIP_OCR=1 bash scripts/start-all.sh
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

# Does the URL answer and contain the given text?
url_has() {
  curl -s --max-time 5 "$1" 2>/dev/null | grep -q "$2"
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
OCR_LAUNCHER_URL="$(read_env OCR_LAUNCHER_URL "http://127.0.0.1:8199")"

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
echo "  OCR plugin: $OCR_LAUNCHER_URL (helper)"
echo

# ---- 1) Frontend (the app) ------------------------------------------------
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

# ---- 2) Backend (local FastAPI scaffold) - started by default --------------
echo
BACKEND_STATE="not running"
if [ "${SKIP_BACKEND:-0}" = "1" ]; then
  echo "[start-all] SKIP_BACKEND=1 - local backend not started."
  BACKEND_PID="(skipped)"
elif [ -z "$BACKEND_PORT" ]; then
  echo "[start-all] BACKEND_PORT not found in .env - local backend not started."
  BACKEND_PID="(skipped)"
elif port_in_use "$BACKEND_PORT"; then
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
    echo "[start-all] See the start-backend log above."
  else
    echo "[start-all] Backend is ready."
    BACKEND_STATE="running"
  fi
fi

# ---- 3) OCR plugin (PP-OCR helper + local engines) -------------------------
# The helper is what the Import dialog's "Local OCR" engines talk to; it also
# exposes /launch/services + /launch/start, which start the engines for us.
OCR_STATE="not running"
OCR_PID="(not started)"
if [ "${SKIP_OCR:-0}" = "1" ]; then
  echo "[start-all] SKIP_OCR=1 - OCR helper / engines not started."
elif url_has "$OCR_LAUNCHER_URL/launch/services" "launcher"; then
  echo "[start-all] OCR helper already running ($OCR_LAUNCHER_URL)."
  OCR_PID="(already running)"
  OCR_STATE="running"
elif [ -n "${OCR_HELPER_CMD:-}" ]; then
  echo ">>> Starting the PP-OCR helper: $OCR_HELPER_CMD ..."
  sh -c "$OCR_HELPER_CMD" >/dev/null 2>&1 &
  OCR_PID=$!
  echo "[start-all] Waiting for the OCR helper (timeout 60s) ..."
  RETRY=0
  while [ "$RETRY" -lt 30 ]; do
    if url_has "$OCR_LAUNCHER_URL/launch/services" "launcher"; then break; fi
    RETRY=$((RETRY + 1))
    sleep 2
  done
  if [ "$RETRY" -ge 30 ]; then
    echo "[start-all] WARNING: OCR helper not up after 60s - continuing anyway."
  else
    echo "[start-all] OCR helper is ready."
    OCR_STATE="running"
  fi
else
  echo "[start-all] OCR helper not running - OCR is optional. On Windows"
  echo "[start-all] start-all.bat starts C:\\dev\\paddle-ocr\\run-ocr-server.bat"
  echo "[start-all] for you; here, set OCR_HELPER_CMD to the command that starts"
  echo "[start-all] the helper (the app can also start engines on demand)."
fi

# Ask the launcher to bring every engine it knows up. It is idempotent: an
# engine that is already running comes back as alreadyRunning = true.
if [ "${SKIP_OCR:-0}" != "1" ] && url_has "$OCR_LAUNCHER_URL/launch/services" "launcher"; then
  for engine in pstocr ollama; do
    if curl -s --max-time 20 -o /dev/null \
        -X POST -H "Content-Type: application/json" \
        -d "{\"id\":\"$engine\"}" "$OCR_LAUNCHER_URL/launch/start" 2>/dev/null; then
      echo "[start-all] OCR engine $engine: start requested (running engines are left alone)."
    else
      echo "[start-all] WARNING: OCR launcher did not answer for engine $engine - the app can start it later."
    fi
  done
  OCR_STATE="running"
fi

echo
echo "========================================"
echo "  All services started"
echo "  App        : http://localhost:$FRONTEND_PORT"
if [ "$BACKEND_STATE" = "running" ] && [ -n "$BACKEND_PORT" ]; then
  echo "  Backend    : running - http://localhost:$BACKEND_PORT/health"
else
  echo "  Backend    : NOT running - run bash scripts/start-backend.sh"
fi
if [ "$OCR_STATE" = "running" ]; then
  echo "  OCR plugin : running - $OCR_LAUNCHER_URL (helper + engines)"
else
  echo "  OCR plugin : NOT running - see the note above"
fi
echo "  Status     : bash scripts/status.sh"
echo "  Stop       : bash scripts/stop-all.sh (STOP_OCR=1 stops the OCR engines too)"
echo "========================================"
echo
echo "PIDs: frontend=${FRONTEND_PID} backend=${BACKEND_PID} ocr=${OCR_PID}"
echo "Press Ctrl+C to stop the foreground log; services keep running in this shell."

# Everything is ready: open the app (all tools live on that single page).
open_url "http://localhost:$FRONTEND_PORT/"
if [ -n "${OPEN_URLS:-}" ]; then
  for url in $OPEN_URLS; do
    open_url "$url"
  done
fi

wait
