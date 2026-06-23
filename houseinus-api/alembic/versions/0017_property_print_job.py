"""property_print_jobs table — async Playwright PDF generation tracking

Revision ID: 0017_property_print_job
Revises: 0016_drop_publish_key
Create Date: 2026-05-10 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0017_property_print_job"
down_revision: str | None = "0016_drop_publish_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "property_print_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "property_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("property_snapshot_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_property_print_jobs_property_id",
        "property_print_jobs",
        ["property_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_property_print_jobs_property_id", "property_print_jobs")
    op.drop_table("property_print_jobs")
