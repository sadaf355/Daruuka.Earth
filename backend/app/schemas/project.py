import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.project import ProjectType


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    project_type: ProjectType
    start_date: date


class ProjectOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    project_type: ProjectType
    start_date: date
    created_at: datetime
    site_count: int = 0

    model_config = {"from_attributes": True}
