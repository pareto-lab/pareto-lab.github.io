"""matched property subscribe inquiry type + admin notify toggle

Revision ID: 0010_matched_property_subscribe
Revises: 0009_open_house_inquiries
Create Date: 2026-04-27 01:00:00

The new inquiry type ``matched_property_subscribe`` is captured by the MBTI
result page's "내 취향 저장하기" form. The integer code (3) is added by
:class:`InquiryType` in the model layer; no DB-level enum migration is needed
because the column is already INTEGER-backed (see migration 0006).

This revision only adds the per-admin notification toggle column.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010_matched_property_subscribe"
down_revision: str | None = "0009_open_house_inquiries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "notify_inquiry_matched_property",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_inquiry_matched_property")
