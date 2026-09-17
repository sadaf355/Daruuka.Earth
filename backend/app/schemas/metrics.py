import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.site_status import HealthStatus

MetricName = Literal["carbon", "biodiversity", "ndvi"]


class MetricPointOut(BaseModel):
    model_config = {"from_attributes": True}

    recorded_at: date
    carbon_tco2e: float
    biodiversity_index: float
    ndvi: float


class MetricsOut(BaseModel):
    site_id: uuid.UUID
    range_days: int
    points: list[MetricPointOut]


class ForecastPointOut(BaseModel):
    recorded_at: date
    value: float
    lower: float
    upper: float


class ForecastOut(BaseModel):
    site_id: uuid.UUID
    metric: MetricName
    historical: list[ForecastPointOut]
    forecast: list[ForecastPointOut]
    model: str
    confidence: float = Field(ge=0, le=1)


class StatusOut(BaseModel):
    site_id: uuid.UUID
    status: HealthStatus
    anomaly_score: float
    last_evaluated_at: datetime
    reasons: list[str]


class SiteMetricSummary(BaseModel):
    model_config = {"from_attributes": True}

    site_id: uuid.UUID
    site_name: str
    health: HealthStatus
    anomaly_score: float
    latest: MetricPointOut
    changes: dict[str, float]


class ProjectMetricsOut(BaseModel):
    project_id: uuid.UUID
    sites: list[SiteMetricSummary]
    portfolio_points: list[MetricPointOut]
