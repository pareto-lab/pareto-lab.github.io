"""admin notification prefs on users

Revision ID: 0007_admin_notification_prefs
Revises: 0006_enums_to_integers
Create Date: 2026-04-26 00:00:00

Adds telegram user id + four notify_* booleans to ``users``. Used for
admin push notifications on new inquiries / MBTI submissions.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_admin_notification_prefs"
down_revision: str | None = "0006_enums_to_integers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("telegram_user_id", sa.String(length=64), nullable=True),
    )
    for col in (
        "notify_inquiry_house",
        "notify_inquiry_metrics",
        "notify_inquiry_portfolio",
        "notify_mbti",
    ):
        op.add_column(
            "users",
            sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.true()),
        )


def downgrade() -> None:
    for col in (
        "notify_mbti",
        "notify_inquiry_portfolio",
        "notify_inquiry_metrics",
        "notify_inquiry_house",
        "telegram_user_id",
    ):
        op.drop_column("users", col)
