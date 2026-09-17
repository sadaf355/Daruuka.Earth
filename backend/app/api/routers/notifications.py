import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.notification import Notification
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.ai import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible(user: User):
    """Notifications are scoped through site -> project -> owner; there is no global feed."""
    return (
        select(Notification)
        .join(Site, Site.id == Notification.site_id)
        .join(Project, Project.id == Site.project_id)
        .where(Project.owner_id == user.id)
    )


def _to_out(row: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(row.id),
        site_id=str(row.site_id),
        message=row.message,
        severity=row.severity.value,
        created_at=row.created_at.isoformat(),
        read_at=row.read_at.isoformat() if row.read_at else None,
    )


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[NotificationOut]:
    query = _visible(current_user)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    query = query.order_by(Notification.created_at.desc()).limit(100)
    return [_to_out(row) for row in db.execute(query).scalars().all()]


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationOut:
    row = db.execute(_visible(current_user).where(Notification.id == notification_id)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    row.read_at = datetime.now(UTC)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    owned = (
        select(Notification.id)
        .join(Site, Site.id == Notification.site_id)
        .join(Project, Project.id == Site.project_id)
        .where(Project.owner_id == current_user.id, Notification.read_at.is_(None))
    )
    db.execute(update(Notification).where(Notification.id.in_(owned)).values(read_at=datetime.now(UTC)))
    db.commit()
    return {"status": "ok"}
