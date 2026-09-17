import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HealthStatus(str, enum.Enum):
    healthy = "healthy"
    watch = "watch"
    at_risk = "at_risk"


class SiteStatus(Base):
    __tablename__ = "site_status"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), primary_key=True)
    status: Mapped[HealthStatus] = mapped_column(
        Enum(HealthStatus, name="health_status"), default=HealthStatus.healthy, nullable=False
    )
    last_evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anomaly_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    site: Mapped["Site"] = relationship(back_populates="status")
