"""delivery_question inquiry type + admin notify toggle

Revision ID: 0014_delivery_question_notify
Revises: 0013_property_delivery_link
Create Date: 2026-05-06 00:00:00

The new inquiry type ``delivery_question`` (integer 4) is added to
InquiryType. No DB-level enum migration needed (column is INTEGER-backed).

This revision adds the per-admin notification toggle column.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_delivery_question_notify"
down_revision: str | None = "0013_property_delivery_link"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notify_inquiry_delivery",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_inquiry_delivery")
