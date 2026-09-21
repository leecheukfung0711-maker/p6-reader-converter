from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import projects, versions


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="P6 Reader & Converter — local backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ── Project / programme-version storage (used by the app's ProjectBar) ──────
# Routers live at /projects and /projects/{id}/versions (no /api prefix, unlike
# the py-workflow-programme reader project: in THIS app /api is proxied to the
# Base44 cloud). The app reaches them through the Vite dev proxy:
#   /local-api/projects/...  →  http://localhost:<BACKEND_PORT>/projects/...
# See vite.config.js (proxy entry) and src/lib/localApi.js (client).
app.include_router(projects.router)
app.include_router(versions.router)

