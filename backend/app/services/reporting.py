"""Report builder.

Reports are persisted as JSON payloads (not pre-rendered markdown) so the frontend can
lay them out as a real document and so the same record can later be re-rendered as PDF
or emailed without re-running the model.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.report import GeneratedBy, Report, ReportType
from app.models.site import Site
from app.models.site_status import HealthStatus
from app.services.genai import ask
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site, forecast_metric


def _site_payload(db: Session, site: Site, project: Project | None) -> dict:
    metrics = ensure_synthetic_metrics(db, site.id)
    status = evaluate_site(db, site.id, metrics)
    latest = metrics[-1]
    previous = metrics[-8] if len(metrics) >= 8 else metrics[0]
    _, future = forecast_metric(db, site.id, "ndvi", 6)
    reasons = getattr(status, "_darukaa_reasons", [])

    context = {
        "site": {"id": str(site.id), "name": site.name, "area_ha": site.area_ha},
        "project": {"id": str(site.project_id), "name": project.name if project else None},
        "latest": {
            "carbon_tco2e": latest.carbon_tco2e,
            "biodiversity_index": latest.biodiversity_index,
            "ndvi": latest.ndvi,
        },
        "status": {
            "status": status.status.value,
            "anomaly_score": status.anomaly_score or 0,
            "reasons": reasons,
        },
        "forecast": {"model": "Linear trend regression", "confidence": 0.95},
    }
    narrative, provider, model = ask(
        "Write a two-sentence executive summary of this site's current environmental performance.",
        context,
    )

    return {
        "title": f"{site.name} Environmental Intelligence Report",
        "generated_at": datetime.now(UTC).isoformat(),
        "site": context["site"],
        "project": context["project"],
        "health": status.status.value,
        "anomaly_score": status.anomaly_score or 0,
        "reasons": reasons,
        "latest": context["latest"],
        "changes": {
            "carbon": round(latest.carbon_tco2e - previous.carbon_tco2e, 2),
            "biodiversity": round(latest.biodiversity_index - previous.biodiversity_index, 2),
            "ndvi": round(latest.ndvi - previous.ndvi, 4),
        },
        "ndvi_forecast": future,
        "executive_summary": narrative,
        "provider": f"{provider} · {model}",
        "recommendation": (
            "Review the affected signal and validate it against field observations before "
            "operational action."
            if status.status != HealthStatus.healthy
            else "Continue routine monitoring and compare future observations against the forecast."
        ),
    }


def _project_payload(db: Session, project: Project) -> dict:
    sites = db.execute(select(Site).where(Site.project_id == project.id)).scalars().all()
    summaries = []
    distribution = {"healthy": 0, "watch": 0, "at_risk": 0}

    for site in sites:
        metrics = ensure_synthetic_metrics(db, site.id)
        status = evaluate_site(db, site.id, metrics)
        latest = metrics[-1]
        distribution[status.status.value] += 1
        summaries.append(
            {
                "site_id": str(site.id),
                "site_name": site.name,
                "health": status.status.value,
                "anomaly_score": status.anomaly_score or 0,
                "ndvi": latest.ndvi,
                "carbon_tco2e": latest.carbon_tco2e,
                "biodiversity_index": latest.biodiversity_index,
            }
        )

    total_carbon = round(sum(item["carbon_tco2e"] for item in summaries), 2)
    return {
        "title": f"{project.name} Portfolio Intelligence Report",
        "generated_at": datetime.now(UTC).isoformat(),
        "project": {"id": str(project.id), "name": project.name},
        "sites": summaries,
        "distribution": distribution,
        "totals": {"sites": len(sites), "carbon_tco2e": total_carbon},
        "executive_summary": (
            f"{project.name} spans {len(sites)} monitored sites holding an estimated "
            f"{total_carbon:,.0f} tCO₂e. Current health distribution is {distribution['healthy']} healthy, "
            f"{distribution['watch']} on watch and {distribution['at_risk']} at risk."
        ),
        "recommendation": (
            "Prioritize sites classified as at risk, then review watch sites for emerging trends."
        ),
    }


def build_report(
    db: Session,
    *,
    site: Site | None,
    project: Project | None,
    report_type: str,
    generated_by: GeneratedBy = GeneratedBy.user,
) -> Report:
    if site is not None:
        payload = _site_payload(db, site, project or db.get(Project, site.project_id))
        row = Report(
            project_id=site.project_id,
            site_id=site.id,
            report_type=ReportType(report_type),
            content=json.dumps(payload, default=str),
            generated_by=generated_by,
        )
    elif project is not None:
        payload = _project_payload(db, project)
        row = Report(
            project_id=project.id,
            site_id=None,
            report_type=ReportType(report_type),
            content=json.dumps(payload, default=str),
            generated_by=generated_by,
        )
    else:
        raise ValueError("build_report requires either a site or a project")

    db.add(row)
    db.flush()
    return row
