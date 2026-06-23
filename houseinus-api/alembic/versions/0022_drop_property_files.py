"""drop property_files table and properties.portfolio_pdf_id

Revision ID: 0022_drop_property_files
Revises: 0021_split_user_admin_profile
Create Date: 2026-05-14 00:00:02

The "portfolio PDF" upload feature is removed. No frontend ever consumed the
uploaded file (only the admin upload tab itself rendered the link), and the
generated 소개서(print-pdf) covers the same purpose. Drop the column, the
FK constraint, and the now-orphan property_files table.

Stored files under ``<base_path>/properties/<property_id>/...`` are not
removed by this migration — clean those up out-of-band if disk usage matters.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0022_drop_property_files"
down_revision: str | None = "0021_split_user_admin_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "fk_properties_portfolio_pdf_id", "properties", type_="foreignkey"
    )
    op.drop_column("properties", "portfolio_pdf_id")
    op.drop_index("ix_property_files_property_id", table_name="property_files")
    op.drop_table("property_files")


def downgrade() -> None:
    op.create_table(
        "property_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["property_id"], ["properties.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_property_files_property_id", "property_files", ["property_id"]
    )
    op.add_column(
        "properties",
        sa.Column("portfolio_pdf_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_properties_portfolio_pdf_id",
        "properties",
        "property_files",
        ["portfolio_pdf_id"],
        ["id"],
        ondelete="SET NULL",
    )
