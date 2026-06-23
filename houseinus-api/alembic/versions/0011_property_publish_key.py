"""property.publish_key for self-serve publish links

Revision ID: 0011_property_publish_key
Revises: 0010_matched_property_subscribe
Create Date: 2026-05-01 00:00:00

Adds an 8-char [a-z0-9] key that, paired with the property slug, lets the
seller hit ``/property/{slug}/publish?key={key}`` without admin auth.
"""
from __future__ import annotations

import secrets
import string
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_property_publish_key"
down_revision: str | None = "0010_matched_property_subscribe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_ALPHABET = string.ascii_lowercase + string.digits


def _gen_key() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))


def upgrade() -> None:
    op.add_column(
        "properties",
        sa.Column("publish_key", sa.String(length=8), nullable=True),
    )

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM properties")).fetchall()
    for (prop_id,) in rows:
        bind.execute(
            sa.text("UPDATE properties SET publish_key = :k WHERE id = :id"),
            {"k": _gen_key(), "id": prop_id},
        )

    op.alter_column("properties", "publish_key", nullable=False)


def downgrade() -> None:
    op.drop_column("properties", "publish_key")
