@echo off
setlocal enabledelayedexpansion
rem ---------------------------------------------------------------------------
rem Stop every service of "P6 Reader & Converter".
rem
rem   * Ports are read from the workspace root .env - never hardcoded.
rem   * Only the processes LISTENING on those ports are killed (with /t, so the
rem     cmd window that started them closes too). Nothing else on the machine is
rem     touched - no blanket kill by image name or window title.
rem   * This is the documented way to free a busy port: run this script, then
rem     scripts\start-all.bat again. Never edit .env and never use port+1.
rem
rem Usage (cmd.exe, NOT PowerShell):
rem   scripts\stop-all.bat
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
echo   Stopping P6 Reader ^& Converter
echo ========================================
echo.
echo Ports from .env: frontend=%FRONTEND_PORT% backend=%BACKEND_PORT%
echo.

call :kill_port "%FRONTEND_PORT%" "frontend"
call :kill_port "%BACKEND_PORT%" "backend"

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
