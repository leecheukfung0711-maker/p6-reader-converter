"""Programme version + task update + compare API (local backend).

Ported from `py-workflow-programme reader/backend/routers/versions.py`;
the router prefix is /projects/{project_id}/versions (not /api/projects/...),
because in this app /api belongs to the Base44 cloud proxy.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import ProgrammeVersion, Project

router = APIRouter(prefix="/projects/{project_id}/versions", tags=["versions"])


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _load_version(project_id: str, version_id: str, db: AsyncSession) -> ProgrammeVersion:
    version = await db.get(ProgrammeVersion, version_id)
    if not version or version.project_id != project_id:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.get("")
async def list_versions(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Project).options(selectinload(Project.versions)).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return [v.to_dict() for v in project.versions]


@router.get("/{version_id}")
async def get_version(project_id: str, version_id: str, db: AsyncSession = Depends(get_db)):
    version = await _load_version(project_id, version_id, db)
    return version.to_dict(include_payload=True)


@router.post("")
async def create_version(project_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Create a new version. Body: { payload, name?, is_snapshot? }"""
    await _get_project_or_404(project_id, db)
    payload = body.get("payload")
    if payload is None or not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload is required")
    name = body.get("name") or f"Version {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
    version = ProgrammeVersion(
        project_id=project_id,
        name=name,
        payload=payload,
        is_snapshot=bool(body.get("is_snapshot", False)),
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version.to_dict(include_payload=True)


class UpdateTaskPayload(BaseModel):
    id: int | str
    updates: dict = Field(default_factory=dict)


class BulkUpdatePayload(BaseModel):
    updates: list[UpdateTaskPayload] = Field(default_factory=list)


@router.put("/{version_id}/tasks/{task_id}")
async def update_task(
    project_id: str, version_id: str, task_id: int | str,
    body: dict, db: AsyncSession = Depends(get_db),
):
    """Update a single task's fields in the version payload."""
    version = await _load_version(project_id, version_id, db)
    payload = version.payload if isinstance(version.payload, dict) else {}
    tasks = payload.get("tasks", [])
    target = next((t for t in tasks if str(t.get("id")) == str(task_id)), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in body.items():
        target[key] = value
    version.payload = payload
    await db.commit()
    return {"ok": True, "task": target}


@router.post("/{version_id}/tasks/bulk")
async def bulk_update_tasks(
    project_id: str, version_id: str,
    body: BulkUpdatePayload, db: AsyncSession = Depends(get_db),
):
    """Bulk-update tasks (used by BulkEditBar / paste updates)."""
    version = await _load_version(project_id, version_id, db)
    payload = version.payload if isinstance(version.payload, dict) else {}
    tasks = payload.get("tasks", [])
    lookup = {str(t.get("id")): i for i, t in enumerate(tasks)}
    updated_ids = []
    for upd in body.updates:
        idx = lookup.get(str(upd.id))
        if idx is None:
            continue
        for key, value in upd.updates.items():
            tasks[idx][key] = value
        updated_ids.append(str(upd.id))
    version.payload = payload
    await db.commit()
    return {"ok": True, "updated": updated_ids}


@router.post("/{version_id}/tasks")
async def replace_tasks(
    project_id: str, version_id: str, body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Replace the full task list of a version."""
    version = await _load_version(project_id, version_id, db)
    tasks = body.get("tasks")
    if tasks is None or not isinstance(tasks, list):
        raise HTTPException(status_code=400, detail="tasks array is required")
    payload = version.payload if isinstance(version.payload, dict) else {}
    payload["tasks"] = tasks
    version.payload = payload
    await db.commit()
    return {"ok": True, "task_count": len(tasks)}


@router.post("/{version_id}/compare")
async def compare_versions(
    project_id: str, version_id: str, body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Compare two versions. Body: { other_version_id: str }"""
    version_a = await _load_version(project_id, version_id, db)
    other_id = body.get("other_version_id")
    version_b = await _load_version(project_id, other_id, db) if other_id else None
    if not version_b:
        raise HTTPException(status_code=404, detail="Version B not found")

    def task_map(version):
        payload = version.payload if isinstance(version.payload, dict) else {}
        return {str(t.get("activityId", t.get("id"))): t for t in payload.get("tasks", [])}

    map_a = task_map(version_a)
    map_b = task_map(version_b)

    only_a = [t for key, t in sorted(map_a.items()) if key not in map_b and not t.get("isSection")]
    only_b = [t for key, t in sorted(map_b.items()) if key not in map_a and not t.get("isSection")]

    changed = []
    for key, ta in map_a.items():
        tb = map_b.get(key)
        if tb is None or ta.get("isSection") or tb.get("isSection"):
            continue
        diff_fields = {}
        for field in ("start", "end", "pct", "remainDur", "float", "activity"):
            va, vb = ta.get(field), tb.get(field)
            if va != vb:
                diff_fields[field] = {"before": va, "after": vb}
        if diff_fields:
            changed.append({"activityId": key, "activity": ta.get("activity", ""), "fields": diff_fields})

    return {
        "version_a": {"id": version_a.id, "name": version_a.name},
        "version_b": {"id": version_b.id, "name": version_b.name},
        "only_in_a": only_a,
        "only_in_b": only_b,
        "changed": changed,
    }