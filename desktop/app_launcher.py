"""P6 Reader & Converter — desktop launcher (the entry point of the packaged .exe).

Run it and it:

1. picks a writable per-user data directory (`%LOCALAPPDATA%\\P6ReaderConverter` by
   default) and points the SQLite database at it — projects survive upgrades and
   nothing is written inside the executable;
2. serves the built UI, the local project API and the Base44 proxy from ONE port
   (`--port`, default 27815 so localStorage state is kept between runs; a busy port
   falls back to any free one);
3. opens the default browser on that URL;
4. reports the optional local OCR plugins (they are separate, user-installed tools:
   PP-OCR helper :8199, PST-OCR :7861, Ollama :11434) — the app works without them.

Stop it with Ctrl+C in the console window (or close that window).
"""
import argparse
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

DEFAULT_PORT = 27815
OCR_PLUGINS = [
    ("PP-OCR helper", "127.0.0.1", 8199),
    ("PST-OCR", "127.0.0.1", 7861),
    ("Ollama", "127.0.0.1", 11434),
]


def bundle_root() -> Path:
    """Where the bundled payload lives (`sys._MEIPASS` in a frozen build)."""
    meipass = getattr(sys, "_MEIPASS", None)
    return Path(meipass) if meipass else Path(__file__).resolve().parent.parent


def resolve_data_dir(override: str | None) -> Path:
    if override:
        return Path(override).expanduser().resolve()
    if os.getenv("P6_DATA_DIR"):
        return Path(os.environ["P6_DATA_DIR"]).expanduser().resolve()
    base = os.getenv("LOCALAPPDATA") or os.path.expanduser("~")
    return Path(base) / "P6ReaderConverter"


def pick_port(preferred: int) -> int:
    """The preferred port when free (stable origin → localStorage survives), else any."""
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket() as free:
        free.bind(("127.0.0.1", 0))
        return int(free.getsockname()[1])


def port_open(host: str, port: int, timeout: float = 0.4) -> bool:
    with socket.socket() as s:
        s.settimeout(timeout)
        return s.connect_ex((host, port)) == 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="P6ReaderConverter", description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.getenv("P6_PORT", DEFAULT_PORT)),
                        help=f"port to serve on (default {DEFAULT_PORT}; a busy port is replaced)")
    parser.add_argument("--data-dir", default=None,
                        help="where projects are stored (default %%LOCALAPPDATA%%\\P6ReaderConverter)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = parser.parse_args(argv)

    data_dir = resolve_data_dir(args.data_dir)
    db_dir = data_dir / "db"
    db_dir.mkdir(parents=True, exist_ok=True)

    root = bundle_root()
    for candidate in (root, root / "backend"):
        if candidate.is_dir() and str(candidate) not in sys.path:
            sys.path.insert(0, str(candidate))

    # The server reads these; database.load_dotenv() finds no .env in the bundle, but
    # P6_DB_PATH cannot be shadowed by one anyway, so the data folder always wins.
    db_file = db_dir / "pyworkflow.db"
    os.environ["P6_DB_PATH"] = str(db_file)
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    static_dir = root / "frontend"
    if not static_dir.is_dir() and os.getenv("P6_STATIC_DIR"):
        # Not a frozen build (running from the sources): honour the env override, so
        # the banner below tells the truth during development and testing.
        static_dir = Path(os.environ["P6_STATIC_DIR"])
    if static_dir.is_dir():
        os.environ["P6_STATIC_DIR"] = str(static_dir)

    port = pick_port(args.port)
    url = f"http://127.0.0.1:{port}"

    print("=" * 74)
    print("  P6 Reader & Converter")
    print("=" * 74)
    print(f"  Address     : {url}")
    print(f"  Data folder : {data_dir}")
    print(f"  UI bundle   : {'bundled' if static_dir.is_dir() else 'MISSING (set P6_STATIC_DIR)'}")
    print("  Local OCR plugins (optional, install separately):")
    for label, host, plugin_port in OCR_PLUGINS:
        print(f"    - {label:<14} {'available' if port_open(host, plugin_port) else 'not running'}")
    print("-" * 74)
    print("  Leave this window open while you work. Ctrl+C (or close it) stops the app.")
    print("=" * 74, flush=True)

    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    import uvicorn

    from desktop_server import app as desktop_app

    uvicorn.run(desktop_app, host="127.0.0.1", port=port, log_level="info", access_log=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
