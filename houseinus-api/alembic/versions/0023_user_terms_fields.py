"""add terms_agreed_at and terms_version to users

Revision ID: 0023_user_terms_fields
Revises: 0022_drop_property_files
Create Date: 2026-05-21 00:00:00

Track which version of the Terms of Service each user agreed to and when.
Null means the user pre-dates the terms requirement (existing staff accounts).
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision = "0023_user_terms_fields"
down_revision: str | None = "0022_drop_property_files"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("terms_agreed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("terms_version", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "terms_version")
    op.drop_column("users", "terms_agreed_at")
