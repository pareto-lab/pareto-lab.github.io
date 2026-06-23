"""blog_tags, blog_posts, blog_post_tags, blog_menu_items tables

Revision ID: 0018_blog
Revises: 0017_property_print_job
Create Date: 2026-05-10 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0018_blog"
down_revision: str | None = "0017_property_print_job"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blog_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_blog_tags_slug", "blog_tags", ["slug"], unique=True)

    op.create_table(
        "blog_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("excerpt", sa.Text, nullable=True),
        sa.Column("cover_image_url", sa.String(500), nullable=True),
        sa.Column(
            "content",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"], unique=True)
    op.create_index("ix_blog_posts_status", "blog_posts", ["status"])

    op.create_table(
        "blog_post_tags",
        sa.Column(
            "blog_post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("blog_posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "blog_tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("blog_tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    op.create_table(
        "blog_menu_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "parent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("blog_menu_items.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("blog_tags.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_blog_menu_items_parent_id", "blog_menu_items", ["parent_id"])


def downgrade() -> None:
    op.drop_index("ix_blog_menu_items_parent_id", "blog_menu_items")
    op.drop_table("blog_menu_items")
    op.drop_table("blog_post_tags")
    op.drop_index("ix_blog_posts_status", "blog_posts")
    op.drop_index("ix_blog_posts_slug", "blog_posts")
    op.drop_table("blog_posts")
    op.drop_index("ix_blog_tags_slug", "blog_tags")
    op.drop_table("blog_tags")
