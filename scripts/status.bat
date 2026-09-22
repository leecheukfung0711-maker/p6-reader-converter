@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Service status for "P6 Reader & Converter".
rem
rem   * Ports come from the workspace root .env - never hardcoded.
rem   * Checks the frontend dev server, the local FastAPI backend, the local OCR
rem     plugin (PP-OCR helper + the engines it can launch), the SQLite file and
rem     the Base44 cloud API the app actually talks to.
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\status.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"

set "FRONTEND_PORT="
set "BACKEND_PORT="
set "OCR_LAUNCHER_URL="
set "OCR_HELPER_BAT="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
  if /i "%%A"=="OCR_LAUNCHER_URL" set "OCR_LAUNCHER_URL=%%B"
  if /i "%%A"=="OCR_HELPER_BAT" set "OCR_HELPER_BAT=%%B"
)
rem Defaults mirror src/lib/localOcr.js - override in .env if you moved things.
if "%OCR_LAUNCHER_URL%"=="" set "OCR_LAUNCHER_URL=http://127.0.0.1:8199"
if "%OCR_HELPER_BAT%"=="" set "OCR_HELPER_BAT=C:\dev\paddle-ocr\run-ocr-server.bat"

echo ========================================
echo   Service Status - P6 Reader ^& Converter
echo ========================================
echo.

echo --- Frontend / app (Vite dev server, port %FRONTEND_PORT%) ---
if "%FRONTEND_PORT%"=="" (
  echo Status: UNKNOWN ^(FRONTEND_PORT missing from .env^)
) else (
  curl -s -o nul -w "%%{http_code}" http://localhost:%FRONTEND_PORT%/ 2>nul | findstr "200" >nul
  if !ERRORLEVEL! EQU 0 (
    echo Status: RUNNING  ^(http://localhost:%FRONTEND_PORT%^)
  ) else (
    echo Status: STOPPED or not responding
    echo Start it with: scripts\start-all.bat
  )
)

echo.
echo --- Local backend ^(FastAPI scaffold, port %BACKEND_PORT%^) ---
if "%BACKEND_PORT%"=="" (
  echo Status: UNKNOWN ^(BACKEND_PORT missing from .env^)
) else (
  curl -s -o nul -w "%%{http_code}" http://localhost:%BACKEND_PORT%/health 2>nul | findstr "200" >nul
  if !ERRORLEVEL! EQU 0 (
    echo Status: RUNNING  ^(health OK^)
  ) else (
    echo Status: STOPPED or not responding
    echo Start it with: scripts\start-all.bat ^(or scripts\start-backend.bat^)
  )
)

echo.
echo --- Local OCR plugin ^(PP-OCR helper + engines^) ---
call :url_has "%OCR_LAUNCHER_URL%/launch/services" "launcher"
if errorlevel 1 (
  echo Status: helper NOT running ^(%OCR_LAUNCHER_URL%^)
  echo Start it with: scripts\start-all.bat ^(helper: %OCR_HELPER_BAT%^)
) else (
  echo Status: helper RUNNING ^(%OCR_LAUNCHER_URL%^)
  call :ocr_engine pstocr
  call :ocr_engine ollama
)

echo.
echo --- Database ---
if exist "%ROOT_DIR%\backend\db\pyworkflow.db" (
  for %%F in ("%ROOT_DIR%\backend\db\pyworkflow.db") do echo Status: SQLite file present ^(backend\db\pyworkflow.db, %%~zF bytes, updated %%~tF^)
) else (
  echo Status: SQLite file not created yet ^(backend\db\pyworkflow.db - created on first backend start^)
)

echo.
echo --- Base44 cloud API ^(what the app really calls^) ---
curl -s -o nul -w "%%{http_code}" https://chronos-flow-chunwo.base44.app 2>nul | findstr "200" >nul
if %ERRORLEVEL% EQU 0 (
  echo Status: REACHABLE ^(https://chronos-flow-chunwo.base44.app^)
) else (
  echo Status: NOT reachable - check the network / VPN / proxy
)

echo.
echo --- Listening ports ---
set "PORTS_FOUND="
for /f "tokens=2,5" %%A in ('netstat -ano ^| findstr /r /c:":%FRONTEND_PORT% .*LISTENING" /c:":%BACKEND_PORT% .*LISTENING"') do (
  echo   %%A  %%B
  set "PORTS_FOUND=1"
)
if not defined PORTS_FOUND echo   none
echo.
exit /b 0

rem ---- helpers --------------------------------------------------------------
:url_has
rem errorlevel 0 = the URL answered and contains the literal text given as %2
curl -s --max-time 5 "%~1" 2>nul | findstr /c:"%~2" >nul 2>&1
exit /b %ERRORLEVEL%

:ocr_engine
rem %1 = engine id as reported by the launcher's /launch/services
curl -s --max-time 5 "%OCR_LAUNCHER_URL%/launch/services" 2>nul | findstr /r /c:"\"id\": \"%~1\".*\"running\": true" >nul
if errorlevel 1 (
  echo   engine %~1: stopped - the app starts it on demand ^(or run scripts\start-all.bat^)
) else (
  echo   engine %~1: running
)
exit /b 0
