"""drop legacy properties.open_house_events JSONB column

Revision ID: 0005_drop_legacy_open_house_col
Revises: 0004_inquiries_mbti_open_house
Create Date: 2026-04-26 00:00:00

The data was already migrated to the dedicated ``open_house_events`` table
in 0004, so the JSONB column on ``properties`` is no longer used. The web
admin UI now manages open-house events through the dedicated endpoints.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005_drop_legacy_open_house_col"
down_revision: str | None = "0004_inquiries_mbti_open_house"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("properties", "open_house_events")


def downgrade() -> None:
    op.add_column(
        "properties",
        sa.Column(
            "open_house_events",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )
