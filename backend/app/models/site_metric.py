import uuid
from datetime import date as date_

from sqlalchemy import Date, Float, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SiteMetric(Base):
    __tablename__ = "site_metrics"
    __table_args__ = (Index("ix_site_metrics_site_recorded", "site_id", "recorded_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)
    recorded_at: Mapped[date_] = mapped_column(Date, nullable=False)
    carbon_tco2e: Mapped[float] = mapped_column(Float, nullable=False)
    biodiversity_index: Mapped[float] = mapped_column(Float, nullable=False)
    ndvi: Mapped[float] = mapped_column(Float, nullable=False)

    site: Mapped["Site"] = relationship(back_populates="metrics")
