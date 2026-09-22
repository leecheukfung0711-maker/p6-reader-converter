# Desktop build — `P6ReaderConverter.exe`

Everything in one file: the React UI, the FastAPI backend, the XER/XML/Excel parsers and
the CJK font the Gantt PDF export embeds. No Node.js, no Python and no Docker needed on
the machine that runs it.

## Build it

```bat
scripts\build-exe.bat
```

The script (1) rebuilds the React UI with `vite build`, then (2) packages everything with
PyInstaller. Requirements on the **build** machine: Node.js 20+, `uv` (Python 3.11+).
The result is `desktop\dist\P6ReaderConverter.exe` (≈28 MB).

Manual equivalent:

```bat
cd Baes44\chronos-flow-chunwo && npm run build
cd ..\..\backend
uv run --with pyinstaller pyinstaller ..\desktop\p6reader.spec --noconfirm --clean --distpath ..\desktop\dist --workpath ..\desktop\build
```

## Run it

Double-click `P6ReaderConverter.exe`. A console window shows the address and the state of
the optional OCR plugins, and the default browser opens on it:

```
Address     : http://127.0.0.1:27815
Data folder : C:\Users\<you>\AppData\Local\P6ReaderConverter
UI bundle   : bundled
```

Keep the console open while you work — closing it (or Ctrl+C) stops the app.

| Flag | Meaning |
|------|---------|
| `--port 27815` | port to serve on. The default is stable on purpose: browser `localStorage` (the shared programme, the selected project/version) is per origin, so a fixed port keeps that state between runs. A busy port falls back to any free one. |
| `--data-dir <path>` | where projects are stored. Default `%LOCALAPPDATA%\P6ReaderConverter`. |
| `--no-browser` | do not open a browser window. |

## Forward it to another computer

The executable is self-contained — copy `P6ReaderConverter.exe` on its own and it runs:
no Python, no Node.js, no installer, no dependency on this repository or this machine.

| The other machine needs | Detail |
|---|---|
| Windows | 10 / 11, 64-bit (the build is x86-64; PyInstaller cannot cross-compile) |
| Internet | only for the Base44-backed features (`/api`: sign-in, the cloud vision import, feedback). Gantt, imports, exports, the Data Explorer and project storage all work offline |
| Local OCR (optional) | PP-OCR helper `:8199` / PST-OCR `:7861` / Ollama `:11434` are separate tools; the app detects them and prints `not running` when absent |
| A free port | 27815 by default; if it is taken the launcher picks a free one automatically |

First run on a new machine — a 30-second check:

1. Double-click the exe: the console prints the address and the plugin states, then the browser opens.
2. `Local OCR plugins` normally says `not running` there — expected, the app just loses the OCR import path.
3. Load an XER and save a project once, then confirm `%LOCALAPPDATA%\P6ReaderConverter\db\pyworkflow.db` appears.

**SmartScreen**: the binary is unsigned, so the first launch may warn ("Windows protected your
PC" → *More info* → *Run anyway*). Sign it with your own certificate
(`signtool sign /fd SHA256 …`) if you hand it out widely.

**Taking the projects along**: the exe carries no data — the SQLite file lives in the per-user
folder above (deliberately, so it can sit on a read-only share). To move your work too, copy that
`db` folder next to the exe and start it with `--data-dir <that folder>` (or set `P6_DATA_DIR`).
Nothing else has to travel.

**What was verified for this** (2026-09-22): the exe was copied to a scratch folder outside the
repository, started with that folder as the working directory and a fresh `--data-dir`; the UI
(`/`, `/data-explorer`), the API (`/local-api/projects`), the 11.4 MB CJK font and a project
create/read cycle all worked, and the embedded strings scan found no reference to this machine
(`ken.li` / `Vibe Code Challenge` / `OneDrive`) or to the OCR helper path.

## Where the data lives

```
%LOCALAPPDATA%\P6ReaderConverter\
└── db\
    └── pyworkflow.db      ← projects + programme versions (SQLite)
```

Nothing is written inside the executable, so it can live on a read-only share and upgrading
it means replacing the file. To move your work to another machine, copy that `db` folder next
to the new executable and start it with `--data-dir <folder>`.

The development environment is untouched by all of this: `scripts\start-all.bat` still uses
`backend\db\pyworkflow.db` (the desktop launcher sets `P6_DB_PATH`, which a `.env` cannot
shadow).

## What is inside the single executable

| Part | How |
|------|-----|
| React UI | `vite build` → `frontend/` inside the bundle, served by FastAPI with an SPA fallback (`/data-explorer` works on a hard refresh) |
| `/local-api/*` and `/projects/*` | the same FastAPI routers the Vite dev proxy points at |
| `/api/*` | reverse proxy to the Base44 cloud (`P6_BASE44_URL`, default `https://chronos-flow-chunwo.base44.app`) — in development `@base44/vite-plugin` does this |
| XER / P6 XML / Excel parsing | `backend/parsers/` (pure Python + openpyxl) |
| Chinese labels in exported PDFs | `frontend/fonts/NotoSansHK-VF.ttf` (11.4 MB, served with the UI) |
| SQLite | `aiosqlite` + the SQLAlchemy SQLite dialect |

## Plugins / features that stay external

These are **separate tools you install yourself**; the executable detects them at start-up and
reports them, and the rest of the app works without them:

| Plugin | Port | Used for |
|--------|------|----------|
| PP-OCR helper (+ engine launcher) | 8199 | the local OCR import path for scanned drawings |
| PST-OCR | 7861 | alternative OCR engine |
| Ollama | 11434 | local vision model |

Started by the workspace `scripts\start-all.bat` (`STOP_OCR=1` keeps `stop-all` away from
them) — start it once and the packaged app finds them too. Cloud features (the LLM image
import, feedback widget, Base44 sign-in) need an internet connection because `/api` is proxied
to Base44; everything else is offline.

## Notes and limits

- Windows x86-64 only (PyInstaller does not cross-compile).
- The executable is **unsigned**, so SmartScreen may warn the first time ("More info → Run
  anyway"). Sign it with your own certificate if you distribute it.
- One-file builds unpack to `%TEMP%\_MEIxxxxx` on start, so the first paint takes a few
  seconds; `console=True` keeps the log visible.
- The bundled UI is a snapshot of `dist/` — rebuild the frontend and re-run the packaging
  step after changing the app.
