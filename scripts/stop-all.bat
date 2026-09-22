@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Stop every service of "P6 Reader & Converter".
rem
rem   * Ports are read from the workspace root .env - never hardcoded.
rem   * Only the processes LISTENING on those ports are killed (with /t, so the
rem     cmd window that started them closes too). Nothing else on the machine is
rem     touched - no blanket kill by image name or window title.
rem   * The OCR plugin is NOT touched by default: the PP-OCR helper and its
rem     engines (PST-OCR, Ollama) may be shared with other tools. Set
rem     STOP_OCR=1 to also ask the helper's launcher to stop those engines.
rem   * This is the documented way to free a busy port: run this script, then
rem     scripts\start-all.bat again. Never edit .env and never use port+1.
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\stop-all.bat
rem   set STOP_OCR=1 ^&^& scripts\stop-all.bat
rem ---------------------------------------------------------------------------

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "ROOT_DIR=%%~fI"

set "FRONTEND_PORT="
set "BACKEND_PORT="
set "OCR_LAUNCHER_URL="
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT_DIR%\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
  if /i "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
  if /i "%%A"=="OCR_LAUNCHER_URL" set "OCR_LAUNCHER_URL=%%B"
)
rem Defaults mirror src/lib/localOcr.js - override in .env if you moved things.
if "%OCR_LAUNCHER_URL%"=="" set "OCR_LAUNCHER_URL=http://127.0.0.1:8199"

echo ========================================
echo   Stopping P6 Reader ^& Converter
echo ========================================
echo.
echo Ports from .env: frontend=%FRONTEND_PORT% backend=%BACKEND_PORT%
echo.

call :kill_port "%FRONTEND_PORT%" "frontend"
call :kill_port "%BACKEND_PORT%" "backend"

if /i "%STOP_OCR%"=="1" goto stop_ocr
echo [stop-all] OCR plugin left running ^(set STOP_OCR=1 to stop its engines too^).
goto done

:stop_ocr
echo.
echo --- OCR plugin (STOP_OCR=1) ---
call :url_has "%OCR_LAUNCHER_URL%/launch/services" "launcher"
if errorlevel 1 (
  echo [stop-all] OCR helper not running - nothing to stop.
  goto done
)
for %%S in (pstocr ollama) do (
  curl -s -o nul --max-time 15 -X POST -H "Content-Type: application/json" -d "{\"id\":\"%%S\"}" "%OCR_LAUNCHER_URL%/launch/stop" >nul 2>&1
  if !ERRORLEVEL! EQU 0 (
    echo [stop-all] OCR engine %%S: stop requested.
  ) else (
    echo [stop-all] WARNING: could not reach the OCR launcher for engine %%S.
  )
)
echo [stop-all] The PP-OCR helper itself keeps running ^(close its window to stop it^).

:done
echo.
echo [stop-all] Done.
exit /b 0

rem ---- helpers --------------------------------------------------------------
:kill_port
rem %1 = port, %2 = label
if "%~1"=="" (
  echo [stop-all] no port for %~2 - skipped.
  exit /b 0
)
set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  echo [stop-all] killing %~2 PID %%P on port %~1
  taskkill /f /t /pid %%P >nul 2>&1
  set "FOUND=1"
)
if not defined FOUND echo [stop-all] port %~1 (%~2) is already free.
exit /b 0

:url_has
rem errorlevel 0 = the URL answered and contains the literal text given as %2
curl -s --max-time 5 "%~1" 2>nul | findstr /c:"%~2" >nul 2>&1
exit /b %ERRORLEVEL%
