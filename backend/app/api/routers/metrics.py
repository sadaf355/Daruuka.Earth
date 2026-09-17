import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.project import Project
from app.models.site import Site
from app.models.site_metric import SiteMetric
from app.models.user import User
from app.schemas.metrics import (
    ForecastOut,
    MetricPointOut,
    MetricsOut,
    ProjectMetricsOut,
    StatusOut,
)
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site, forecast_metric

router = APIRouter(tags=["intelligence"])

COLUMN_FOR_METRIC = {
    "carbon": "carbon_tco2e",
    "biodiversity": "biodiversity_index",
    "ndvi": "ndvi",
}


def _owned_site(db: Session, site_id: uuid.UUID, owner_id: uuid.UUID) -> Site:
    site = db.execute(
        select(Site).join(Project).where(Site.id == site_id, Project.owner_id == owner_id)
    ).scalar_one_or_none()
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.get("/sites/{site_id}/metrics", response_model=MetricsOut)
def get_metrics(
    site_id: uuid.UUID,
    days: int = Query(180, ge=30, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MetricsOut:
    _owned_site(db, site_id, current_user.id)
    rows = ensure_synthetic_metrics(db, site_id, max(days, 180))
    db.commit()

    cutoff = rows[-1].recorded_at - timedelta(days=days - 1)
    windowed = [row for row in rows if row.recorded_at >= cutoff]
    return MetricsOut(
        site_id=site_id,
        range_days=days,
        points=[MetricPointOut.model_validate(row) for row in windowed],
    )


@router.get("/sites/{site_id}/forecast", response_model=ForecastOut)
def get_forecast(
    site_id: uuid.UUID,
    metric: str = Query("ndvi", pattern="^(carbon|biodiversity|ndvi)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ForecastOut:
    _owned_site(db, site_id, current_user.id)
    historical, future = forecast_metric(db, site_id, COLUMN_FOR_METRIC[metric], 6)
    db.commit()
    return ForecastOut(
        site_id=site_id,
        metric=metric,
        historical=historical,
        forecast=future,
        model="Linear trend regression",
        confidence=0.95,
    )


@router.get("/sites/{site_id}/status", response_model=StatusOut)
def get_status(
    site_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatusOut:
    _owned_site(db, site_id, current_user.id)
    metrics = ensure_synthetic_metrics(db, site_id)
    row = evaluate_site(db, site_id, metrics)
    db.commit()
    return StatusOut(
        site_id=site_id,
        status=row.status,
        anomaly_score=row.anomaly_score or 0,
        last_evaluated_at=row.last_evaluated_at,
        reasons=getattr(row, "_darukaa_reasons", []),
    )


@router.get("/projects/{project_id}/metrics", response_model=ProjectMetricsOut)
def get_project_metrics(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectMetricsOut:
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == current_user.id)
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    sites = db.execute(select(Site).where(Site.project_id == project_id)).scalars().all()
    summaries = []
    series_by_date: dict[str, list[SiteMetric]] = {}

    for site in sites:
        rows = ensure_synthetic_metrics(db, site.id)
        status = evaluate_site(db, site.id, rows)
        latest = rows[-1]
        baseline = rows[-8] if len(rows) >= 8 else rows[0]
        summaries.append(
            {
                "site_id": site.id,
                "site_name": site.name,
                "health": status.status,
                "anomaly_score": status.anomaly_score or 0,
                "latest": MetricPointOut.model_validate(latest),
                "changes": {
                    "carbon": round(latest.carbon_tco2e - baseline.carbon_tco2e, 2),
                    "biodiversity": round(latest.biodiversity_index - baseline.biodiversity_index, 2),
                    "ndvi": round(latest.ndvi - baseline.ndvi, 4),
                },
            }
        )
        for row in rows[-90:]:
            series_by_date.setdefault(str(row.recorded_at), []).append(row)

    portfolio_points = [
        MetricPointOut(
            recorded_at=day,
            carbon_tco2e=round(sum(r.carbon_tco2e for r in rows), 2),
            biodiversity_index=round(sum(r.biodiversity_index for r in rows) / len(rows), 2),
            ndvi=round(sum(r.ndvi for r in rows) / len(rows), 4),
        )
        for day, rows in sorted(series_by_date.items())
    ]

    db.commit()
    return ProjectMetricsOut(
        project_id=project_id,
        sites=summaries,
        portfolio_points=portfolio_points,
    )
