"""drop properties.publish_key — self-publish flow removed

Revision ID: 0016_drop_publish_key
Revises: 0015_lifestyle_story_overlay
Create Date: 2026-05-08 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0016_drop_publish_key"
down_revision: str | None = "0015_lifestyle_story_overlay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("properties", "publish_key")


def downgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("publish_key", sa.String(8), nullable=True),
    )
