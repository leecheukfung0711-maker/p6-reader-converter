#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Start the local FastAPI backend (backend/ - the starter scaffold) - macOS /
# Linux.
#
#   * BACKEND_PORT always comes from the workspace root .env.
#   * The P6 Reader & Converter app talks to the Base44 cloud API through the
#     Vite proxy, so this backend is optional (see scripts/start-all.sh).
#   * Started WITHOUT uvicorn --reload on purpose: one foreground process owns
#     the port, so scripts/stop-all.sh leaves nothing behind.
#   * uv manages the Python environment, exactly like the scaffold workflow.
#
# Usage:  bash scripts/start-backend.sh
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
BACKEND_DIR="$ROOT_DIR/backend"

read_env() {
  local key="$1" default="$2" value=""
  if [ -f "$ENV_FILE" ]; then
    value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  fi
  printf '%s' "${value:-$default}"
}

echo "========================================"
echo "  Starting Local Backend (FastAPI)"
echo "========================================"
echo

echo "[1/4] Checking uv ..."
if ! command -v uv >/dev/null 2>&1; then
  echo "    uv is not installed - installing via pip ..."
  pip install uv || {
    echo "[start-backend] ERROR: failed to install uv. Install it manually: pip install uv" >&2
    exit 1
  }
fi
echo "    uv is ready."

echo
echo "[2/4] Loading the port from the workspace root .env ..."
BACKEND_PORT="$(read_env BACKEND_PORT "")"
if [ -z "$BACKEND_PORT" ]; then
  echo "[start-backend] ERROR: BACKEND_PORT not found in $ENV_FILE - aborting." >&2
  exit 1
fi
echo "    BACKEND_PORT=$BACKEND_PORT"

echo
echo "[3/4] Installing Python dependencies (uv sync) ..."
if [ ! -f "$BACKEND_DIR/pyproject.toml" ]; then
  echo "[start-backend] ERROR: backend not found at $BACKEND_DIR - aborting." >&2
  exit 1
fi
cd "$BACKEND_DIR" || exit 1
uv sync || {
  echo "[start-backend] ERROR: uv sync failed." >&2
  exit 1
}

echo
echo "[4/4] Starting FastAPI on port $BACKEND_PORT ..."
echo "    Health check: http://localhost:$BACKEND_PORT/health"
echo "    Press Ctrl+C to stop."
echo
exec uv run uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT"
