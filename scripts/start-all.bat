@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Start EVERY service of "P6 Reader & Converter":
rem
rem   1. Frontend   - the app itself (Vite dev server, FRONTEND_PORT).
rem   2. Backend    - local FastAPI scaffold (BACKEND_PORT): stores projects and
rem                   programme versions for the ProjectBar.
rem   3. OCR plugin - the PP-OCR helper (default http://127.0.0.1:8199) and, via
rem                   its launcher API, the local OCR engines it can bring up
rem                   (PST-OCR :7861, Ollama :11434). This is what the Import
rem                   dialog's "Local OCR" engines talk to.
rem
rem   * Ports are ALWAYS read from the workspace root .env - never hardcoded and
rem     never port+1 (see AGENTS.md "Port conflict rule"). The OCR endpoints are
rem     not part of .env: they mirror src/lib/localOcr.js and can be overridden
rem     with the optional keys OCR_LAUNCHER_URL / OCR_HELPER_BAT.
rem   * A service that is already LISTENING on its port is skipped.
rem   * Frontend = the P6 Reader & Converter app (Baes44\chronos-flow-chunwo).
rem     It is started through scripts\start-frontend.bat, which in turn calls the
rem     app's own start-local.bat (npm run dev cannot be used: the workspace path
rem     contains "&", which breaks the cmd shims npm writes to node_modules\.bin).
rem   * Everything starts by default. Opt out per group:
rem       set SKIP_BACKEND=1  -> do not start the FastAPI backend
rem       set SKIP_OCR=1      -> do not start the OCR helper / engines
rem     "set START_BACKEND=1" is still accepted and now simply means the default.
rem     Backend / OCR problems are WARNINGS only - never a hard stop.
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
rem   set SKIP_OCR=1 ^&^& scripts\start-all.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
set "START_DIR=%~dp0."
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\Baes44\chronos-flow-chunwo"

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
echo   OCR plugin: %OCR_LAUNCHER_URL% ^(helper^)
echo.

rem ---- 1) Frontend (the app) ------------------------------------------------
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

rem ---- 2) Backend (local FastAPI scaffold) - started by default -------------
:backend
set "BACKEND_STATE=skipped"
if "%BACKEND_PORT%"=="" set "BACKEND_STATE=no-port"
if /i "%SKIP_BACKEND%"=="1" goto backend_skipped

call :is_listening %BACKEND_PORT%
if not errorlevel 1 (
  echo [start-all] Backend already running on port %BACKEND_PORT% - skipping start.
  set "BACKEND_STATE=running"
  goto ocr
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
  echo [start-all] See the "P6-Reader backend" window.
  set "BACKEND_STATE=warning"
  goto ocr
)
timeout /t 2 >nul
goto wbk
:bkrdy
echo [start-all] Backend is ready.
set "BACKEND_STATE=running"
goto ocr

:backend_skipped
if "%BACKEND_STATE%"=="no-port" (
  echo [start-all] BACKEND_PORT not found in .env - local backend not started.
  goto ocr
)
call :is_listening %BACKEND_PORT%
if not errorlevel 1 (
  set "BACKEND_STATE=running"
  echo [start-all] Local backend already running on port %BACKEND_PORT% - not started by this script.
  goto ocr
)
if /i "%SKIP_BACKEND%"=="1" echo [start-all] SKIP_BACKEND=1 - local backend not started.

rem ---- 3) OCR plugin (PP-OCR helper + local engines) ------------------------
:ocr
set "OCR_STATE=skipped"
if /i "%SKIP_OCR%"=="1" goto ocr_done

call :url_has "%OCR_LAUNCHER_URL%/launch/services" "launcher"
if not errorlevel 1 (
  echo [start-all] OCR helper already running ^(%OCR_LAUNCHER_URL%^).
  goto ocr_engines
)

echo.
echo ^>^>^> Starting the PP-OCR helper: "%OCR_HELPER_BAT%" ...
if not exist "%OCR_HELPER_BAT%" (
  echo [start-all] WARNING: helper not found - OCR is optional.
  echo [start-all] Set OCR_HELPER_BAT in .env or start the helper yourself; then
  echo [start-all] the Import dialog's Local OCR engines become available.
  set "OCR_STATE=warning"
  goto ocr_done
)
start "P6-Reader OCR helper" /MIN cmd /c ""%OCR_HELPER_BAT%""

echo [start-all] Waiting for the OCR helper (timeout 60s) ...
set /a RETRY=0
:wocr
call :url_has "%OCR_LAUNCHER_URL%/launch/services" "launcher"
if not errorlevel 1 goto ocrdy
set /a RETRY+=1
if !RETRY! GEQ 30 (
  echo [start-all] WARNING: OCR helper not up after 60s - continuing anyway.
  set "OCR_STATE=warning"
  goto ocr_done
)
timeout /t 2 >nul
goto wocr
:ocrdy
echo [start-all] OCR helper is ready.

:ocr_engines
rem Ask the launcher to bring every engine it knows up. It is idempotent: an
rem engine that is already running comes back as alreadyRunning = true.
for %%S in (pstocr ollama) do (
  curl -s -o nul --max-time 20 -X POST -H "Content-Type: application/json" -d "{\"id\":\"%%S\"}" "%OCR_LAUNCHER_URL%/launch/start" >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    echo [start-all] OCR engine %%S: start requested ^(running engines are left alone^).
  ) else (
    echo [start-all] WARNING: OCR launcher did not answer for engine %%S - the app can start it later.
  )
)
set "OCR_STATE=running"

:ocr_done
if /i "%SKIP_OCR%"=="1" echo [start-all] SKIP_OCR=1 - OCR helper / engines not started.

rem ---- Summary --------------------------------------------------------------
:ready
echo.
echo ========================================
echo   All services started
echo   App        : http://localhost:%FRONTEND_PORT%
if /i "%BACKEND_STATE%"=="running" echo   Backend    : running - http://localhost:%BACKEND_PORT%/health
if /i not "%BACKEND_STATE%"=="running" echo   Backend    : NOT running - run scripts\start-backend.bat
if /i "%OCR_STATE%"=="running" echo   OCR plugin : running - %OCR_LAUNCHER_URL% ^(helper + engines^)
if /i not "%OCR_STATE%"=="running" echo   OCR plugin : NOT running - see the note above
echo   Status     : scripts\status.bat
echo   Stop       : scripts\stop-all.bat ^(set STOP_OCR=1 to stop the OCR engines too^)
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

:url_has
rem errorlevel 0 = the URL answered and contains the literal text given as %2
curl -s --max-time 5 "%~1" 2>nul | findstr /c:"%~2" >nul 2>&1
exit /b %ERRORLEVEL%
