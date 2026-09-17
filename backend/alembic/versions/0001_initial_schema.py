"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-17

"""

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = sa.Enum("admin", "viewer", name="user_role")
project_type = sa.Enum("carbon", "biodiversity", "both", name="project_type")
health_status = sa.Enum("healthy", "watch", "at_risk", name="health_status")
report_type = sa.Enum("ai_summary", "funder_report", "agent_alert", name="report_type")
generated_by = sa.Enum("system", "user", name="generated_by")
severity = sa.Enum("info", "warning", "critical", name="severity")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # Enum types below are created automatically the first time each is used as a column
    # type in op.create_table (and dropped automatically when their owning table is dropped) —
    # no separate CREATE TYPE / DROP TYPE calls needed.

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="admin"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("project_type", project_type, nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "sites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("geom", geoalchemy2.Geometry(geometry_type="POLYGON", srid=4326), nullable=False),
        sa.Column("area_ha", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sites_geom", "sites", ["geom"], postgresql_using="gist")

    op.create_table(
        "site_metrics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("recorded_at", sa.Date(), nullable=False),
        sa.Column("carbon_tco2e", sa.Float(), nullable=False),
        sa.Column("biodiversity_index", sa.Float(), nullable=False),
        sa.Column("ndvi", sa.Float(), nullable=False),
    )
    op.create_index("ix_site_metrics_site_recorded", "site_metrics", ["site_id", "recorded_at"])

    op.create_table(
        "site_status",
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), primary_key=True),
        sa.Column("status", health_status, nullable=False, server_default="healthy"),
        sa.Column("last_evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("anomaly_score", sa.Float(), nullable=True),
    )

    op.create_table(
        "reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=True),
        sa.Column("report_type", report_type, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("generated_by", generated_by, nullable=False),
    )

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("site_id", UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("severity", severity, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("reports")
    op.drop_table("site_status")
    op.drop_index("ix_site_metrics_site_recorded", table_name="site_metrics")
    op.drop_table("site_metrics")
    op.drop_index("ix_sites_geom", table_name="sites")
    op.drop_table("sites")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    # op.drop_table() does not automatically drop the Postgres ENUM types it created —
    # unlike creation, that has to be done explicitly.
    bind = op.get_bind()
    severity.drop(bind, checkfirst=True)
    generated_by.drop(bind, checkfirst=True)
    report_type.drop(bind, checkfirst=True)
    health_status.drop(bind, checkfirst=True)
    project_type.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
