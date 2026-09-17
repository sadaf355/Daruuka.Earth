"""Ask Darukaa + report generation endpoints.

Both endpoints assemble a *structured* context from the database first and only then hand
it to the GenAI layer. The model never queries the database itself, which is what keeps
answers grounded in the user's own project data.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.project import Project
from app.models.report import Report
from app.models.site import Site
from app.models.user import User
from app.schemas.ai import AssistantQuery, AssistantResponse, ReportGenerateRequest, ReportOut
from app.services.genai import ask
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site, forecast_metric
from app.services.reporting import build_report

router = APIRouter(tags=["ai"])


def _owned_context(
    db: Session,
    user: User,
    site_id: str | None,
    project_id: str | None,
) -> tuple[Site | None, Project | None]:
    """Resolve the requested site/project, enforcing ownership before any AI call."""
    if site_id:
        try:
            parsed = uuid.UUID(site_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid site_id") from exc
        site = db.execute(
            select(Site).join(Project).where(Site.id == parsed, Project.owner_id == user.id)
        ).scalar_one_or_none()
        if site is None:
            raise HTTPException(status_code=404, detail="Site not found")
        return site, db.get(Project, site.project_id)

    if project_id:
        try:
            parsed = uuid.UUID(project_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid project_id") from exc
        project = db.execute(
            select(Project).where(Project.id == parsed, Project.owner_id == user.id)
        ).scalar_one_or_none()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        return None, project

    return None, None


def _to_out(row: Report) -> ReportOut:
    return ReportOut(
        id=str(row.id),
        project_id=str(row.project_id) if row.project_id else None,
        site_id=str(row.site_id) if row.site_id else None,
        report_type=row.report_type.value,
        content=row.content,
        generated_at=row.generated_at.isoformat(),
        generated_by=row.generated_by.value,
    )


@router.post("/assistant/query", response_model=AssistantResponse)
def assistant_query(
    payload: AssistantQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssistantResponse:
    site, project = _owned_context(db, current_user, payload.site_id, payload.project_id)

    context: dict = {}
    sources: list[str] = []

    if project is not None:
        site_count = len(db.execute(select(Site).where(Site.project_id == project.id)).scalars().all())
        context["project"] = {"id": str(project.id), "name": project.name, "site_count": site_count}
        sources.append("project_sites")

    if site is not None:
        metrics = ensure_synthetic_metrics(db, site.id)
        status = evaluate_site(db, site.id, metrics)
        _, future = forecast_metric(db, site.id, "ndvi", 6)
        latest = metrics[-1]
        context["site"] = {"id": str(site.id), "name": site.name, "area_ha": site.area_ha}
        context["latest"] = {
            "carbon_tco2e": latest.carbon_tco2e,
            "biodiversity_index": latest.biodiversity_index,
            "ndvi": latest.ndvi,
        }
        context["status"] = {
            "status": status.status.value,
            "anomaly_score": status.anomaly_score or 0,
            "reasons": getattr(status, "_darukaa_reasons", []),
        }
        context["forecast"] = {
            "model": "Linear trend regression",
            "confidence": 0.95,
            "next_ndvi": future[0]["value"] if future else None,
        }
        sources = ["site_metrics", "site_status", "ml_forecast"]

    db.commit()

    answer, provider, model = ask(payload.question, context)
    return AssistantResponse(
        answer=answer,
        provider=provider,
        model=model,
        context=context,
        sources=sources or ["portfolio"],
    )


@router.post("/reports/generate", response_model=ReportOut)
def generate_report(
    payload: ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportOut:
    site, project = _owned_context(db, current_user, payload.site_id, payload.project_id)
    if site is None and project is None:
        raise HTTPException(status_code=400, detail="site_id or project_id is required")

    row = build_report(db, site=site, project=project, report_type=payload.report_type)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.get("/reports", response_model=list[ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReportOut]:
    owned_projects = select(Project.id).where(Project.owner_id == current_user.id)
    rows = (
        db.execute(
            select(Report).where(Report.project_id.in_(owned_projects)).order_by(Report.generated_at.desc())
        )
        .scalars()
        .all()
    )
    return [_to_out(row) for row in rows]


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportOut:
    owned_projects = select(Project.id).where(Project.owner_id == current_user.id)
    row = db.execute(
        select(Report).where(Report.id == report_id, Report.project_id.in_(owned_projects))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return _to_out(row)
