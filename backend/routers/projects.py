"""Project CRUD + file import/parse API (local backend).

Ported from `py-workflow-programme reader/backend/routers/projects.py`.
Differences for this app:
  * prefix is /projects (not /api/projects): in this app /api is proxied to the
    Base44 cloud by @base44/vite-plugin, so the local API uses its own prefix
    and is reached through the Vite proxy /local-api/... (see vite.config.js).
  * payload.meta.import_source == "server" marks files parsed by this endpoint,
    so they stay distinguishable from the app's own in-browser parsing.
  * The Python parsers are ports of the same JS parsers but carry fewer
    app-specific fields than src/lib/parseXER.js (e.g. no sectionLevel /
    p6WbsId), which is why POST .../import is a fallback path only - the UI
    parses files in the browser by default.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import ProgrammeVersion, Project
from parsers import parse_excel, parse_p6xml, parse_xer

router = APIRouter(prefix="/projects", tags=["projects"])


def _utcnow() -> datetime:
    """Naive UTC timestamp — same value as the deprecated `datetime.utcnow()`.

    The DB columns are naive `DateTime`, so tzinfo is stripped on purpose:
    `datetime.now(timezone.utc)` is timezone-aware (DTZ003) while the stored
    value stays byte-identical to the previous behaviour.
    """
    return datetime.now(UTC).replace(tzinfo=None)


def _project_to_dict(p: Project, version_count: int | None = None) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "source_filename": p.source_filename,
        "source_format": p.source_format,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "version_count": version_count if version_count is not None else 0,
    }


@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.versions)).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    return [_project_to_dict(p, len(p.versions)) for p in projects]


@router.post("")
async def create_project(
    name: str = Form(...),
    description: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    project = Project(name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return _project_to_dict(project, 0)


@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.versions)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_version = project.versions[-1] if project.versions else None

    data = _project_to_dict(project, len(project.versions))
    data["latest_version"] = latest_version.to_dict(include_payload=True) if latest_version else None
    return data


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/import")
async def import_file(
    project_id: str,
    file: UploadFile = File(...),
    create_version: bool = Form(True),
    db: AsyncSession = Depends(get_db),
):
    """Upload a programme file (.xer/.xml/.xlsx/.xls/.csv) and parse it.

    Saves the parsed task list as the newest ProgrammeVersion payload.
    Returns the parsed payload plus import report stats.
    """
    result = await db.execute(
        select(Project).options(selectinload(Project.versions)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = file.filename or "upload"
    content = await file.read()

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if ext == "xer":
            text = content.decode("utf-8-sig", errors="replace")
            tasks = parse_xer(text) or []
            source_format = "xer"
        elif ext == "xml":
            text = content.decode("utf-8-sig", errors="replace")
            tasks = parse_p6xml(text) or []
            source_format = "xml"
        elif ext in ("xlsx", "xls", "csv"):
            tasks = parse_excel(content, filename) or []
            source_format = "xlsx" if ext != "csv" else "csv"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — any parser failure must surface as a 400, not a 500
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {exc}")

    if not tasks:
        raise HTTPException(status_code=400, detail="No activities found in file")

    # Assign stable ids (1-based sequence) if missing
    next_id = 1
    for t in tasks:
        if "id" not in t:
            t["id"] = next_id
            next_id += 1
        else:
            try:
                next_id = max(next_id, int(t["id"]) + 1)
            except (TypeError, ValueError):
                pass

    # Resolve succCode -> succId so relationship lines render after reload
    code_to_id = {}
    for t in tasks:
        if not t.get("isSection") and t.get("activityId"):
            code_to_id[t["activityId"].strip().lower()] = t["id"]
    for t in tasks:
        if t.get("isSection"):
            continue
        resolved_links = []
        for l in t.get("links") or []:
            if l.get("succId"):
                resolved_links.append(l)
                continue
            succ_code = l.get("succCode")
            if not succ_code:
                continue
            succ_id = code_to_id.get(succ_code.strip().lower())
            if succ_id is not None:
                resolved_links.append({"succId": succ_id, "type": l.get("type", "FS"), "lag": l.get("lag", 0)})
        if resolved_links:
            t["links"] = resolved_links
        if not t.get("link") and t.get("linkSuccCode"):
            succ_id = code_to_id.get(str(t["linkSuccCode"]).strip().lower())
            if succ_id is not None:
                t["link"] = succ_id

    project.source_filename = filename
    project.source_format = source_format
    project.updated_at = _utcnow()

    payload = {
        "tasks": tasks,
        "meta": {
            "source_filename": filename,
            "source_format": source_format,
            "import_source": "server",
        },
    }

    version = ProgrammeVersion(
        project_id=project.id,
        name=f"Import {_utcnow().strftime('%Y-%m-%d %H:%M')}",
        payload=payload,
        is_snapshot=False,
    )

    if create_version:
        db.add(version)
    db.add(project)
    await db.commit()
    await db.refresh(project)

    task_count = len([t for t in tasks if not t.get("isSection")])
    section_count = len([t for t in tasks if t.get("isSection")])

    return {
        "project": _project_to_dict(project, len(project.versions)),
        "version": version.to_dict(include_payload=True) if create_version else None,
        "payload": payload,
        "report": {
            "source_format": source_format,
            "task_count": task_count,
            "section_count": section_count,
            "total_items": len(tasks),
        },
    }