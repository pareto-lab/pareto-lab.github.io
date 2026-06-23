"""per-admin toggle for self-publish notifications from delivery page

Revision ID: 0020_notify_delivery_publish
Revises: 0019_blog_reference_date
Create Date: 2026-05-14 00:00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_notify_delivery_publish"
down_revision: str | None = "0019_blog_reference_date"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notify_delivery_publish",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_delivery_publish")
