@echo off
REM ============================================================================
REM  Build the standalone Windows executable: desktop\dist\P6ReaderConverter.exe
REM
REM  Steps: (1) rebuild the React UI, (2) package everything with PyInstaller.
REM  Needs: Node.js 20+, uv (Python 3.11+) — see doc\DESKTOP.md.
REM ============================================================================
setlocal enabledelayedexpansion
set ROOT=%~dp0..
set FRONTEND=%ROOT%\Baes44\chronos-flow-chunwo

echo.
echo [1/3] Building the frontend (vite build) ...
pushd "%FRONTEND%"
if errorlevel 1 ( echo   cannot open %FRONTEND% & exit /b 1 )
call npm run build
if errorlevel 1 ( echo   FRONTEND BUILD FAILED & popd & exit /b 1 )
popd

echo.
echo [2/3] Packaging with PyInstaller (a few minutes) ...
pushd "%ROOT%\backend"
if errorlevel 1 ( echo   cannot open %ROOT%\backend & exit /b 1 )
uv run --with pyinstaller pyinstaller "%ROOT%\desktop\p6reader.spec" ^
  --noconfirm --clean ^
  --distpath "%ROOT%\desktop\dist" ^
  --workpath "%ROOT%\desktop\build"
if errorlevel 1 ( echo   PACKAGING FAILED & popd & exit /b 1 )
popd

echo.
echo [3/3] Done.
echo     %ROOT%\desktop\dist\P6ReaderConverter.exe
echo.
echo   Double-click it: it opens http://127.0.0.1:27815 and keeps your projects in
echo   %LOCALAPPDATA%\P6ReaderConverter (see doc\DESKTOP.md for --port / --data-dir).
endlocal
