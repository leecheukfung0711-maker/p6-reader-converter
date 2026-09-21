import json
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _uuid():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    source_filename: Mapped[str] = mapped_column(String(255), default="")
    source_format: Mapped[str] = mapped_column(String(16), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    versions: Mapped[list["ProgrammeVersion"]] = relationship(
        "ProgrammeVersion",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProgrammeVersion.created_at",
    )


class ProgrammeVersion(Base):
    __tablename__ = "programme_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), default="")
    # payload stores the full programme state: { meta, settings, tasks, ... }
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    is_snapshot: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="versions")

    @property
    def task_count(self) -> int:
        tasks = self.payload.get("tasks", []) if isinstance(self.payload, dict) else []
        return len([t for t in tasks if not t.get("isSection")])

    def to_dict(self, include_payload: bool = False) -> dict:
        base = {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "is_snapshot": self.is_snapshot,
            "task_count": self.task_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_payload:
            base["payload"] = self.payload if isinstance(self.payload, dict) else {}
        return base