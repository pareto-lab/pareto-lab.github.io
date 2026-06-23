"""add lifestyle_layout column to properties

Revision ID: 0011_lifestyle_layout
Revises: 0010_matched_property_subscribe
Create Date: 2026-05-02 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0012_lifestyle_layout"
down_revision = "0011_property_publish_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("lifestyle_layout", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("properties", "lifestyle_layout")
