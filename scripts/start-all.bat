@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Start every service of "P6 Reader & Converter".
rem
rem   * Ports are ALWAYS read from the workspace root .env - never hardcoded and
rem     never port+1 (see AGENTS.md "Port conflict rule").
rem   * A service that is already LISTENING on its port is skipped.
rem   * Frontend = the P6 Reader & Converter app (Baes44\chronos-flow-chunwo).
rem     It is started through scripts\start-frontend.bat, which in turn calls the
rem     app's own start-local.bat (npm run dev cannot be used: the workspace path
rem     contains "&", which breaks the cmd shims npm writes to node_modules\.bin).
rem   * The local FastAPI backend (backend\ - starter scaffold) is NOT started by
rem     default: this app talks to the Base44 cloud API and never calls it.
rem     Opt in with "set START_BACKEND=1" (or run scripts\start-backend.bat in
rem     its own window). When it is started, a failure is a WARNING only -
rem     never a hard stop. The legacy "set SKIP_BACKEND=1" still means skip.
rem   * Child windows are opened from inside the scripts directory (pushd + a
rem     relative script name), so the "&" in the workspace path can never split
rem     the command line - /D with a quoted path is not reliable here.
rem   * When everything is ready the app is opened in the default browser: every
rem     tool (Gantt view, import, compare, merge, export, feedback) lives on that
rem     one page. Disable with "set NO_BROWSER=1"; open extra pages as well with
rem     "set OPEN_URLS=http://localhost:25156/docs https://..." (space separated).
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\start-all.bat
rem   set START_BACKEND=1 ^&^& scripts\start-all.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "START_DIR=%~dp0."
set "ROOT_DIR=%SCRIPT_DIR%.."
set "APP_DIR=%ROOT_DIR%\Baes44\chronos-flow-chunwo"

set "FRONTEND_PORT="
set "BACKEND_PORT="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
)
if "%FRONTEND_PORT%"=="" (
  echo [start-all] FRONTEND_PORT not found in "%ROOT_DIR%\.env" - aborting.
  exit /b 1
)

echo ========================================
echo   Starting P6 Reader ^& Converter
echo ========================================
echo   Root      : "%ROOT_DIR%"
echo   Frontend  : http://localhost:%FRONTEND_PORT%
echo   Backend   : http://localhost:%BACKEND_PORT%/health
echo.

rem ---- Frontend (the app) ---------------------------------------------------
if not exist "%APP_DIR%\package.json" (
  echo [start-all] ERROR: app not found at "%APP_DIR%" - aborting.
  exit /b 1
)

call :is_listening %FRONTEND_PORT%
if not errorlevel 1 (
  echo [start-all] Frontend already running on port %FRONTEND_PORT% - skipping start.
  goto backend
)

echo ^>^>^> Starting frontend (the app) on port %FRONTEND_PORT% ...
pushd "%START_DIR%"
rem NO_BROWSER=1 for the child so the browser is opened exactly once (here, at the end).
start "P6-Reader frontend" /MIN cmd /c "set NO_BROWSER=1&& start-frontend.bat"
popd

echo [start-all] Waiting for the frontend (timeout 120s) ...
set /a RETRY=0
:wfrt
call :is_listening %FRONTEND_PORT%
if not errorlevel 1 goto ftrdy
set /a RETRY+=1
if !RETRY! GEQ 60 (
  echo.
  echo [start-all] ERROR: frontend not ready after 120s.
  echo [start-all] Check the "P6-Reader frontend" window for the error message.
  exit /b 1
)
timeout /t 2 >nul
goto wfrt
:ftrdy
echo [start-all] Frontend is ready.

rem ---- Backend (local FastAPI scaffold - optional) --------------------------
:backend
set "BACKEND_STATE=skipped"
if "%BACKEND_PORT%"=="" set "BACKEND_STATE=no-port"
rem Legacy switch: SKIP_BACKEND=1 always means "do not start the local backend".
if /i "%SKIP_BACKEND%"=="1" goto backend_skipped
rem The backend is OPT-IN: the app never calls it, so it is not started by default.
if /i not "%START_BACKEND%"=="1" goto backend_skipped

call :is_listening %BACKEND_PORT%
if not errorlevel 1 (
  echo [start-all] Backend already running on port %BACKEND_PORT% - skipping start.
  set "BACKEND_STATE=running"
  goto ready
)

echo.
echo ^>^>^> Starting local backend on port %BACKEND_PORT% ...
pushd "%START_DIR%"
start "P6-Reader backend" /MIN cmd /c "start-backend.bat"
popd

echo [start-all] Waiting for the backend (timeout 60s) ...
set /a RETRY=0
:wbk
call :is_listening %BACKEND_PORT%
if not errorlevel 1 goto bkrdy
set /a RETRY+=1
if !RETRY! GEQ 30 (
  echo [start-all] WARNING: backend not up after 60s - continuing anyway.
  echo [start-all] The app does not need it - see the "P6-Reader backend" window.
  set "BACKEND_STATE=warning"
  goto ready
)
timeout /t 2 >nul
goto wbk
:bkrdy
echo [start-all] Backend is ready.
set "BACKEND_STATE=running"
goto ready

rem ---- backend not started (this is the default) ---------------------------
:backend_skipped
if not "%BACKEND_STATE%"=="no-port" goto backend_skipped_check
echo [start-all] BACKEND_PORT not found in .env - local backend not started.
goto ready

:backend_skipped_check
call :is_listening %BACKEND_PORT%
if errorlevel 1 goto backend_skipped_off
set "BACKEND_STATE=running"
echo [start-all] Local backend already running on port %BACKEND_PORT% - this script did not start it.
goto ready

:backend_skipped_off
if /i "%SKIP_BACKEND%"=="1" echo [start-all] SKIP_BACKEND=1 - local backend not started.
if /i not "%SKIP_BACKEND%"=="1" echo [start-all] Local backend is opt-in - not started ^(run scripts\start-backend.bat when you need it^).

:ready
echo.
echo ========================================
echo   All services started
echo   Open       : http://localhost:%FRONTEND_PORT%
if /i "%BACKEND_STATE%"=="running" echo   Health     : http://localhost:%BACKEND_PORT%/health
if /i not "%BACKEND_STATE%"=="running" echo   Backend    : not running ^(opt-in: scripts\start-backend.bat^)
echo   Status     : scripts\status.bat
echo   Stop       : scripts\stop-all.bat
echo ========================================
call :open_app
exit /b 0

rem ---- helpers --------------------------------------------------------------
:open_app
rem Opens the app in the default browser - every tool lives on that single page.
if /i "%NO_BROWSER%"=="1" (
  echo [start-all] NO_BROWSER=1 - not opening a browser.
  exit /b 0
)
echo [start-all] Opening the app in your default browser: http://localhost:%FRONTEND_PORT%/
start "" "http://localhost:%FRONTEND_PORT%/"
if not "%OPEN_URLS%"=="" (
  for %%U in (%OPEN_URLS%) do (
    echo [start-all] Opening %%U
    start "" "%%U"
  )
)
exit /b 0

:is_listening
rem errorlevel 0  = something is LISTENING on the port given as %1
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul 2>&1
exit /b %ERRORLEVEL%
