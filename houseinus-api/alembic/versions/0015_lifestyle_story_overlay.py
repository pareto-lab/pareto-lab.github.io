"""add lifestyle_story_overlay column to properties

Revision ID: 0015_lifestyle_story_overlay
Revises: 0014_delivery_question_notify
Create Date: 2026-05-08 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0015_lifestyle_story_overlay"
down_revision = "0014_delivery_question_notify"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column(
            "lifestyle_story_overlay",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("properties", "lifestyle_story_overlay")
