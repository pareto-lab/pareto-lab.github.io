"""extract admin-only User columns into a new user_admins table

Revision ID: 0021_split_user_admin_profile
Revises: 0020_notify_delivery_publish
Create Date: 2026-05-14 00:00:01

Moves admin-only profile fields (telegram id + per-kind notification toggles)
off the ``users`` table into a separate ``user_admins`` table with a 1:1
relationship. Backfills rows for users whose stored role is admin (1) or
owner (2).
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0021_split_user_admin_profile"
down_revision: str | None = "0020_notify_delivery_publish"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ADMIN_FIELDS = [
    "telegram_user_id",
    "notify_inquiry_house",
    "notify_inquiry_metrics",
    "notify_inquiry_portfolio",
    "notify_open_house_inquiry",
    "notify_inquiry_matched_property",
    "notify_inquiry_delivery",
    "notify_mbti",
    "notify_delivery_publish",
]


def upgrade() -> None:
    op.create_table(
        "user_admins",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("telegram_user_id", sa.String(64), nullable=True),
        sa.Column(
            "notify_inquiry_house",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_inquiry_metrics",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_inquiry_portfolio",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_open_house_inquiry",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_inquiry_matched_property",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_inquiry_delivery",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_mbti",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "notify_delivery_publish",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
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

    # Backfill: copy current per-user settings for admin/owner role users.
    # IntegerEnum mapping: admin=1, owner=2.
    columns_csv = ", ".join(_ADMIN_FIELDS)
    op.execute(
        sa.text(
            f"""
            INSERT INTO user_admins (user_id, {columns_csv})
            SELECT id, {columns_csv}
            FROM users
            WHERE role IN (1, 2)
            """
        )
    )

    for col in _ADMIN_FIELDS:
        op.drop_column("users", col)


def downgrade() -> None:
    # Re-add the columns on users with the original defaults.
    op.add_column(
        "users",
        sa.Column("telegram_user_id", sa.String(64), nullable=True),
    )
    for col in _ADMIN_FIELDS[1:]:
        op.add_column(
            "users",
            sa.Column(
                col, sa.Boolean(), nullable=False, server_default=sa.true()
            ),
        )

    # Copy settings back from user_admins.
    set_clause = ", ".join(f"{c} = user_admins.{c}" for c in _ADMIN_FIELDS)
    op.execute(
        sa.text(
            f"""
            UPDATE users
            SET {set_clause}
            FROM user_admins
            WHERE users.id = user_admins.user_id
            """
        )
    )

    op.drop_table("user_admins")
