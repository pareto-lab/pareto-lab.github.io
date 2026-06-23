"""blog_posts: add reference_date column

Revision ID: 0019_blog_reference_date
Revises: 0018_blog
Create Date: 2026-05-11 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision: str = "0019_blog_reference_date"
down_revision: str | None = "0018_blog"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add as nullable first so existing rows don't violate the constraint
    op.add_column(
        "blog_posts",
        sa.Column("reference_date", sa.DateTime(timezone=True), nullable=True),
    )
    # Back-fill existing rows with their created_at value
    op.execute("UPDATE blog_posts SET reference_date = created_at WHERE reference_date IS NULL")
    # Now enforce NOT NULL
    op.alter_column("blog_posts", "reference_date", nullable=False)
    op.create_index("ix_blog_posts_reference_date", "blog_posts", ["reference_date"])


def downgrade() -> None:
    op.drop_index("ix_blog_posts_reference_date", table_name="blog_posts")
    op.drop_column("blog_posts", "reference_date")
