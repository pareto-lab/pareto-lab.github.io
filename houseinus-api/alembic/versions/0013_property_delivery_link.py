"""property.delivery_token and delivery_birthdate for customer delivery pages

Revision ID: 0013_property_delivery_link
Revises: 0012_lifestyle_layout
Create Date: 2026-05-06 00:00:00
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013_property_delivery_link"
down_revision: str | None = "0012_lifestyle_layout"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("properties", sa.Column("delivery_token", sa.String(64), nullable=True))
    op.add_column("properties", sa.Column("delivery_birthdate", sa.String(8), nullable=True))
    op.create_unique_constraint("uq_properties_delivery_token", "properties", ["delivery_token"])
    op.create_index("ix_properties_delivery_token", "properties", ["delivery_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_properties_delivery_token", table_name="properties")
    op.drop_constraint("uq_properties_delivery_token", "properties", type_="unique")
    op.drop_column("properties", "delivery_birthdate")
    op.drop_column("properties", "delivery_token")
