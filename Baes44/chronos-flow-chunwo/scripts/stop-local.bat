@echo off
setlocal
rem ---------------------------------------------------------------------------
rem Stop whatever is listening on FRONTEND_PORT (read from workspace root .env).
rem Never change .env to work around a busy port - kill the occupant instead.
rem ---------------------------------------------------------------------------
set "APP_DIR=%~dp0.."
set "FRONTEND_PORT="

for /f "usebackq tokens=1,* delims==" %%A in ("%APP_DIR%\..\..\.env") do (
  if /i "%%A"=="FRONTEND_PORT" set "FRONTEND_PORT=%%B"
)

if "%FRONTEND_PORT%"=="" (
  echo [stop-local] FRONTEND_PORT not found in workspace root .env - aborting.
  exit /b 1
)

set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%FRONTEND_PORT% .*LISTENING"') do (
  echo [stop-local] Killing PID %%P listening on port %FRONTEND_PORT%
  taskkill /F /PID %%P >nul 2>&1
  set "FOUND=1"
)

if not defined FOUND echo [stop-local] Port %FRONTEND_PORT% is free.
endlocal
