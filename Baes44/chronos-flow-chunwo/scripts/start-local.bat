@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Start the local (host) version of chronos-flow-chunwo.
rem
rem   * FRONTEND_PORT is ALWAYS read from the workspace root .env - never hardcoded.
rem   * If that port is busy this script FAILS. It never falls back to port+1
rem     (Vite's auto-increment is also disabled by strictPort in vite.config.js).
rem     Run scripts\stop-local.bat first, then this script again.
rem   * Vite is launched through node (node_modules\vite\bin\vite.js) instead of
rem     `npm run dev`, because this project lives under a path containing "&",
rem     which breaks the cmd shims npm writes into node_modules\.bin.
rem ---------------------------------------------------------------------------
set "APP_DIR=%~dp0.."
set "FRONTEND_PORT="

for /f "usebackq tokens=1,* delims==" %%A in ("%APP_DIR%\..\..\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
)

if "%FRONTEND_PORT%"=="" (
  echo [start-local] FRONTEND_PORT not found in workspace root .env - aborting.
  exit /b 1
)

echo [start-local] FRONTEND_PORT=%FRONTEND_PORT%

netstat -ano | findstr /r /c:":%FRONTEND_PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo [start-local] Port %FRONTEND_PORT% is already in use.
  echo [start-local] Run scripts\stop-local.bat first, then run this script again.
  exit /b 1
)

cd /d "%APP_DIR%"
echo [start-local] starting vite ...
node "node_modules\vite\bin\vite.js"
endlocal

