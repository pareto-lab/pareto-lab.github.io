"""properties + property_images + property_files

Revision ID: 0003_properties
Revises: 0002_admin_role_and_ban
Create Date: 2026-04-25 00:00:00

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_properties"
down_revision: str | None = "0002_admin_role_and_ban"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "properties",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=120), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "published", "archived", name="property_status"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "display_order", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("subtitle", sa.String(length=500), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=False),
        sa.Column("price", sa.BigInteger(), nullable=False),
        sa.Column("hero_image_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "portfolio_thumb_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column(
            "portfolio_pdf_id", postgresql.UUID(as_uuid=True), nullable=True
        ),
        sa.Column("lifestyle_story", sa.Text(), nullable=True),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "lifestyle_highlights",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "specs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "loan_info",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "open_house_events",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "house_plan_specs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{\"main\": [], \"collapsed\": []}'::jsonb"),
        ),
        sa.Column(
            "nearby_places",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "evaluation_metrics",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "interior_photos",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "floorplans",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "lifestyle_scenarios",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_properties_slug", "properties", ["slug"], unique=True)
    op.create_index("ix_properties_status", "properties", ["status"])
    op.create_index(
        "ix_properties_display_order", "properties", ["display_order"]
    )

    op.create_table(
        "property_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("caption", sa.String(length=500), nullable=True),
        sa.Column("alt", sa.String(length=500), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["property_id"], ["properties.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_property_images_property_id", "property_images", ["property_id"]
    )

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

    # FKs from properties → images/files (created after both tables exist).
    op.create_foreign_key(
        "fk_properties_hero_image_id",
        "properties",
        "property_images",
        ["hero_image_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_properties_portfolio_thumb_id",
        "properties",
        "property_images",
        ["portfolio_thumb_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_properties_portfolio_pdf_id",
        "properties",
        "property_files",
        ["portfolio_pdf_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_properties_portfolio_pdf_id", "properties", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_properties_portfolio_thumb_id", "properties", type_="foreignkey"
    )
    op.drop_constraint(
        "fk_properties_hero_image_id", "properties", type_="foreignkey"
    )

    op.drop_index("ix_property_files_property_id", table_name="property_files")
    op.drop_table("property_files")

    op.drop_index("ix_property_images_property_id", table_name="property_images")
    op.drop_table("property_images")

    op.drop_index("ix_properties_display_order", table_name="properties")
    op.drop_index("ix_properties_status", table_name="properties")
    op.drop_index("ix_properties_slug", table_name="properties")
    op.drop_table("properties")
    op.execute("DROP TYPE IF EXISTS property_status")
