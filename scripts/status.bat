@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Service status for "P6 Reader & Converter".
rem
rem   * Ports come from the workspace root .env - never hardcoded.
rem   * Checks the frontend dev server, the local FastAPI scaffold, the SQLite
rem     file and the Base44 cloud API the app actually talks to.
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\status.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."

set "FRONTEND_PORT="
set "BACKEND_PORT="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
)

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
    echo Note: optional - the app uses the Base44 cloud API instead.
  )
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
