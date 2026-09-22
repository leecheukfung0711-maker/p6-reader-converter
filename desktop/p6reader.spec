# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec — the standalone P6 Reader & Converter executable.

Build it with `scripts\\build-exe.bat` (that script rebuilds the frontend first):

    uv run --with pyinstaller pyinstaller desktop/p6reader.spec --noconfirm --clean

The result is ONE file, `desktop/dist/P6ReaderConverter.exe`, containing:

  * the FastAPI backend (routers, SQLAlchemy models, XER/XML/Excel parsers),
  * the SQLite driver + httpx (the /api → Base44 cloud proxy),
  * the built React UI in `frontend/` — including `fonts/NotoSansHK-VF.ttf`, which the
    Gantt PDF export embeds for Chinese labels.

The user's projects live OUTSIDE the executable: `%LOCALAPPDATA%\\P6ReaderConverter\\db`.
"""
from pathlib import Path

ROOT = Path(SPECPATH).resolve().parent                      # repo root (spec lives in desktop/)
FRONTEND_DIST = ROOT / "Baes44" / "chronos-flow-chunwo" / "dist"

if not (FRONTEND_DIST / "index.html").is_file():
    raise SystemExit(
        f"Frontend bundle missing at {FRONTEND_DIST}\n"
        "Run `npm run build` in Baes44/chronos-flow-chunwo first (scripts/build-exe.bat does it for you)."
    )

datas = [(str(FRONTEND_DIST), "frontend")]

# Imported dynamically (uvicorn picks its loop/protocol implementation at runtime) or
# through SQLAlchemy's dialect registry, so PyInstaller cannot see them by itself.
hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
    "aiosqlite",
    "sqlalchemy.dialects.sqlite",
    "sqlalchemy.dialects.sqlite.aiosqlite",
    "multipart",
    "dotenv",
    "httpx",
    "openpyxl",
    "database",
    "models",
    "routers",
    "routers.projects",
    "routers.versions",
    "parsers",
    "parsers.xer_parser",
    "parsers.p6xml_parser",
    "parsers.excel_parser",
    "desktop_server",
]

a = Analysis(
    [str(ROOT / "desktop" / "app_launcher.py")],
    pathex=[str(ROOT / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Nothing here is used at runtime; leaving them out keeps the executable small.
    excludes=["tkinter", "numpy", "pandas", "matplotlib", "PIL", "PyQt5", "PySide2", "IPython", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="P6ReaderConverter",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,                 # shows the address + plugin status; closing it stops the app
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
