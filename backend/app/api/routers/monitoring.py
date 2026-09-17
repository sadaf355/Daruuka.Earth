"""Agentic AI: the observe → evaluate → act → report loop, exposed as an endpoint.

`run_for_user` is deliberately importable so both the HTTP endpoint (manual demo trigger)
and the background scheduler call exactly the same code path — there is no "demo-only"
shortcut that behaves differently from the real agent.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification, Severity
from app.models.project import Project
from app.models.report import GeneratedBy
from app.models.site import Site
from app.models.site_status import SiteStatus
from app.models.user import User
from app.schemas.ai import MonitoringRunOut
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site
from app.services.reporting import build_report

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


def run_for_user(db: Session, user: User) -> MonitoringRunOut:
    """Evaluate every site owned by `user`, raising alerts only on a health *transition*."""
    sites = db.execute(select(Site).join(Project).where(Project.owner_id == user.id)).scalars().all()

    evaluated = 0
    alerts_created = 0
    reports_created = 0
    counts = {"healthy": 0, "watch": 0, "at_risk": 0}

    for site in sites:
        previous_row = db.get(SiteStatus, site.id)
        previous_status = previous_row.status.value if previous_row else None

        metrics = ensure_synthetic_metrics(db, site.id)
        status = evaluate_site(db, site.id, metrics, force=True)
        evaluated += 1
        counts[status.status.value] += 1

        degraded = status.status.value in {"watch", "at_risk"}
        changed = previous_status != status.status.value
        if degraded and changed:
            severity = Severity.critical if status.status.value == "at_risk" else Severity.warning
            message = (
                f"{site.name} changed to {status.status.value.replace('_', ' ')} "
                f"(anomaly score {(status.anomaly_score or 0):.2f})."
            )
            db.add(Notification(site_id=site.id, message=message, severity=severity))
            alerts_created += 1

            build_report(
                db,
                site=site,
                project=site.project,
                report_type="agent_alert",
                generated_by=GeneratedBy.system,
            )
            reports_created += 1

    db.commit()
    return MonitoringRunOut(
        evaluated=evaluated,
        alerts_created=alerts_created,
        reports_created=reports_created,
        at_risk=counts["at_risk"],
        watch=counts["watch"],
        healthy=counts["healthy"],
    )


@router.post("/run", response_model=MonitoringRunOut)
def run_monitoring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MonitoringRunOut:
    return run_for_user(db, current_user)
