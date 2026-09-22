"""Desktop (packaged .exe) HTTP server — one port for everything.

The development setup uses two processes and two Vite proxies:

    Vite :<FRONTEND_PORT>  ──/local-api/*──►  FastAPI :<BACKEND_PORT>
                           ──/api/*───────►  https://<app>.base44.app

A single packaged executable has no Vite, so this module reproduces both proxies and
serves the built UI itself:

    GET  /                     → the built frontend (dist/), SPA fallback to index.html
    *    /local-api/<path>     → the local project/version API (same routers as dev)
    *    /projects/...         → the same routers without the prefix (dev parity)
    *    /api/<path>           → reverse proxy to the Base44 cloud (auth, LLM, feedback)
    GET  /health               → liveness + whether the UI bundle was found

`database.py` keeps the dev behaviour; the launcher points DATABASE_URL at a writable
per-user data directory before importing this module, so nothing is written inside the
executable (PyInstaller's bundle is temporary and read-only in spirit).
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from database import init_db
from routers import projects, versions

# The Base44 app the dev Vite plugin proxies /api to (see the plugin's startup log).
BASE44_URL = os.getenv("P6_BASE44_URL", "https://chronos-flow-chunwo.base44.app").rstrip("/")
STATIC_DIR = Path(os.environ["P6_STATIC_DIR"]).resolve() if os.getenv("P6_STATIC_DIR") else None

# Headers a proxy must not forward (RFC 7230 §6.1) — content-encoding/length are
# recomputed by the client because httpx hands us the decoded body.
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
    "content-encoding", "content-length", "host",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="P6 Reader & Converter (desktop)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "desktop": True,
        "ui": bool(STATIC_DIR and (STATIC_DIR / "index.html").is_file()),
        "base44": BASE44_URL,
    }


# ── Local project / version storage ─────────────────────────────────────────
# Registered twice on purpose: the app calls /local-api/... (what the Vite dev
# proxy strips to the bare path), and the bare paths stay available for parity
# with the development backend.
app.include_router(projects.router)
app.include_router(versions.router)
app.include_router(projects.router, prefix="/local-api")
app.include_router(versions.router, prefix="/local-api")


# ── Base44 cloud proxy (what @base44/vite-plugin does in dev) ───────────────
@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_base44(path: str, request: Request):
    url = f"{BASE44_URL}/api/{path}"
    headers = {k: v for k, v in request.headers.items() if k.lower() not in HOP_BY_HOP}
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=False) as client:
            upstream = await client.request(
                request.method, url, params=request.query_params, content=body, headers=headers
            )
    except httpx.HTTPError as exc:  # offline / DNS / timeout — the UI must still load
        return JSONResponse(
            {"detail": f"Base44 cloud unreachable: {exc.__class__.__name__}"},
            status_code=502,
        )
    out_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in HOP_BY_HOP}
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=out_headers,
        media_type=upstream.headers.get("content-type"),
    )


# ── The built UI (SPA: every unknown path falls back to index.html) ─────────
@app.get("/{full_path:path}")
async def serve_ui(full_path: str):
    if STATIC_DIR and STATIC_DIR.is_dir():
        root = STATIC_DIR
        candidate = (root / full_path).resolve() if full_path else root
        try:                       # never serve outside the bundle
            candidate.relative_to(root)
        except ValueError:
            candidate = None
        if candidate and candidate.is_file():
            return FileResponse(candidate)
        index = root / "index.html"
        if index.is_file():
            return FileResponse(index, media_type="text/html")
    return JSONResponse(
        {"detail": "UI bundle not found — build the frontend and set P6_STATIC_DIR"},
        status_code=404,
    )
