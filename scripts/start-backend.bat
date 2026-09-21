@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Start the local FastAPI backend (backend\ - the starter scaffold).
rem
rem   * BACKEND_PORT is ALWAYS read from the workspace root .env - never
rem     hardcoded and never port+1.
rem   * The P6 Reader & Converter app itself talks to the Base44 cloud API
rem     through the Vite proxy; this local backend is the scaffold service and
rem     is optional. scripts\start-all.bat treats a failure here as a warning.
rem   * Started WITHOUT uvicorn --reload on purpose: a single foreground process
rem     owns the port, so scripts\stop-all.bat leaves no orphaned reloader behind.
rem   * uv (https://docs.astral.sh/uv) manages the Python environment, exactly
rem     like the scaffold's documented workflow.
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\start-backend.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%ROOT_DIR%\backend"

echo ========================================
echo   Starting Local Backend (FastAPI)
echo ========================================
echo.

echo [1/4] Checking uv ...
uv --version >nul 2>&1
if not %ERRORLEVEL% EQU 0 (
  echo     uv is not installed - installing via pip ...
  pip install uv
  if not !ERRORLEVEL! EQU 0 (
    echo [start-backend] ERROR: failed to install uv. Install it manually: pip install uv
    exit /b 1
  )
)
echo     uv is ready.

echo.
echo [2/4] Loading the port from the workspace root .env ...
set "BACKEND_PORT="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
)
if "%BACKEND_PORT%"=="" (
  echo [start-backend] ERROR: BACKEND_PORT not found in "%ROOT_DIR%\.env" - aborting.
  exit /b 1
)
echo     BACKEND_PORT=%BACKEND_PORT%

echo.
echo [3/4] Installing Python dependencies (uv sync) ...
if not exist "%BACKEND_DIR%\pyproject.toml" (
  echo [start-backend] ERROR: backend not found at "%BACKEND_DIR%" - aborting.
  exit /b 1
)
cd /d "%BACKEND_DIR%"
if not %ERRORLEVEL% EQU 0 (
  echo [start-backend] ERROR: cannot enter "%BACKEND_DIR%".
  exit /b 1
)
call uv sync
if not !ERRORLEVEL! EQU 0 (
  echo [start-backend] ERROR: uv sync failed.
  exit /b 1
)

echo.
echo [4/4] Starting FastAPI on port %BACKEND_PORT% ...
echo     Health check: http://localhost:%BACKEND_PORT%/health
echo     Press Ctrl+C to stop.
echo.
call uv run uvicorn main:app --host 0.0.0.0 --port %BACKEND_PORT%
exit /b %ERRORLEVEL%
