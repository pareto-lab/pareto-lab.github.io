"""add owner role + soft ban columns

Revision ID: 0002_admin_role_and_ban
Revises: 0001_initial_user_auth
Create Date: 2026-04-25 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_admin_role_and_ban"
down_revision: str | None = "0001_initial_user_auth"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # `ALTER TYPE ... ADD VALUE` must run outside a transaction block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner'")

    op.add_column(
        "users",
        sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("ban_reason", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "banned_by_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
    )
    op.create_foreign_key(
        "fk_users_banned_by_id",
        "users",
        "users",
        ["banned_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_banned_by_id", "users", type_="foreignkey")
    op.drop_column("users", "banned_by_id")
    op.drop_column("users", "ban_reason")
    op.drop_column("users", "banned_at")
    # NOTE: removing an enum value in PostgreSQL is non-trivial (needs full type rebuild).
    # Leaving 'owner' in place on downgrade — harmless if unused.
