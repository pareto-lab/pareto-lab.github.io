"""open house schedule inquiries

Revision ID: 0009_open_house_inquiries
Revises: 0008_user_enums_to_integers
Create Date: 2026-04-27 00:00:00

Adds the ``open_house_inquiries`` table backing the property page's
"다음 일정 안내 받기" form, plus a per-admin ``notify_open_house_inquiry``
toggle on ``users``.

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009_open_house_inquiries"
down_revision: str | None = "0008_user_enums_to_integers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "open_house_inquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column(
            "privacy_consent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
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
            ["property_id"], ["properties.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_open_house_inquiries_property_id",
        "open_house_inquiries",
        ["property_id"],
    )
    op.create_index(
        "ix_open_house_inquiries_created_at",
        "open_house_inquiries",
        ["created_at"],
    )

    op.add_column(
        "users",
        sa.Column(
            "notify_open_house_inquiry",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_open_house_inquiry")
    op.drop_index(
        "ix_open_house_inquiries_created_at",
        table_name="open_house_inquiries",
    )
    op.drop_index(
        "ix_open_house_inquiries_property_id",
        table_name="open_house_inquiries",
    )
    op.drop_table("open_house_inquiries")
