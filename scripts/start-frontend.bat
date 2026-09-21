@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Start the P6 Reader & Converter frontend (Vite dev server).
rem
rem   * FRONTEND_PORT is ALWAYS read from the workspace root .env - never
rem     hardcoded and never port+1 (AGENTS.md "Port conflict rule").
rem   * The dev server itself is started by the app's own script
rem       Baes44\chronos-flow-chunwo\scripts\start-local.bat
rem     so the port rule (strictPort + refuse when busy) and the "&"-safe
rem     launcher live in exactly one place.
rem   * npm run dev is used nowhere: the workspace path contains "&", which
rem     breaks the cmd shims npm writes into node_modules\.bin. The app script
rem     therefore calls node node_modules\vite\bin\vite.js directly.
rem   * Dependency install happens only when node_modules is missing, and always
rem     with --ignore-scripts (tesseract.js postinstall fails on the "&" path).
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\start-frontend.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "APP_DIR=%ROOT_DIR%\Baes44\chronos-flow-chunwo"
set "APP_START=%APP_DIR%\scripts\start-local.bat"

echo ========================================
echo   Starting P6 Reader ^& Converter (frontend)
echo ========================================
echo.

echo [1/4] Checking Node.js ...
node --version >nul 2>&1
if not %ERRORLEVEL% EQU 0 (
  echo [start-frontend] ERROR: Node.js is not installed. Install Node.js 20+ from https://nodejs.org
  exit /b 1
)

echo.
echo [2/4] Loading the port from the workspace root .env ...
set "FRONTEND_PORT="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
)
if "%FRONTEND_PORT%"=="" (
  echo [start-frontend] ERROR: FRONTEND_PORT not found in "%ROOT_DIR%\.env" - aborting.
  exit /b 1
)
echo     FRONTEND_PORT=%FRONTEND_PORT%

echo.
echo [3/4] Checking the app ...
if not exist "%APP_DIR%\package.json" (
  echo [start-frontend] ERROR: the app was not found at "%APP_DIR%" - aborting.
  exit /b 1
)
if not exist "%APP_START%" (
  echo [start-frontend] ERROR: "%APP_START%" is missing - aborting.
  exit /b 1
)
if not exist "%APP_DIR%\node_modules" (
  echo [start-frontend] node_modules is missing - installing ^(first run only, may take minutes^) ...
  pushd "%APP_DIR%"
  call npm install --ignore-scripts --no-audit --no-fund
  if not !ERRORLEVEL! EQU 0 (
    popd
    echo [start-frontend] ERROR: dependency install failed.
    exit /b 1
  )
  popd
) else (
  echo     node_modules found - skipping install.
)

echo.
echo [4/4] Starting the dev server on port %FRONTEND_PORT% ...
echo     Open http://localhost:%FRONTEND_PORT% in your browser.
echo     Press Ctrl+C to stop.
echo.
rem Already up (second run / started elsewhere)? Open it now. When this script
rem starts the server itself, use scripts\start-all.bat as the entry point: it
rem waits for the port and then opens the browser for you.
call :is_listening %FRONTEND_PORT%
if not errorlevel 1 call :open_app
call "%APP_START%"
exit /b %ERRORLEVEL%

rem ---- helpers --------------------------------------------------------------
:open_app
rem Opens the app in the default browser unless NO_BROWSER=1.
if /i "%NO_BROWSER%"=="1" (
  echo [start-frontend] NO_BROWSER=1 - not opening a browser.
  exit /b 0
)
echo [start-frontend] Opening the app in your default browser: http://localhost:%FRONTEND_PORT%/
start "" "http://localhost:%FRONTEND_PORT%/"
if not "%OPEN_URLS%"=="" (
  for %%U in (%OPEN_URLS%) do (
    echo [start-frontend] Opening %%U
    start "" "%%U"
  )
)
exit /b 0

:is_listening
rem errorlevel 0 = something is LISTENING on the port given as %1
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
exit /b %ERRORLEVEL%
