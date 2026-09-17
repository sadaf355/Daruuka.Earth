import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.models.site_status import HealthStatus


class GeoJSONPolygon(BaseModel):
    """A single-ring GeoJSON Polygon, as produced by Mapbox GL Draw."""

    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def must_be_closed_ring(cls, v: list[list[list[float]]]) -> list[list[list[float]]]:
        if not v or len(v[0]) < 4:
            raise ValueError("Polygon ring must have at least 4 positions (closed ring)")
        if v[0][0] != v[0][-1]:
            raise ValueError("Polygon ring must be closed (first point == last point)")
        return v


class SiteCreate(BaseModel):
    name: str
    geometry: GeoJSONPolygon


class SiteOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    area_ha: float
    geometry: dict
    status: HealthStatus | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
