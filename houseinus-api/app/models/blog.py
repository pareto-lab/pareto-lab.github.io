from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BlogTag(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "blog_tags"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    post_links: Mapped[list["BlogPostTag"]] = relationship(
        "BlogPostTag", back_populates="tag", cascade="all, delete-orphan"
    )
    menu_items: Mapped[list["BlogMenuItem"]] = relationship(
        "BlogMenuItem", back_populates="tag", foreign_keys="BlogMenuItem.tag_id"
    )


class BlogPost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "blog_posts"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    # draft | published
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reference_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    tag_links: Mapped[list["BlogPostTag"]] = relationship(
        "BlogPostTag", back_populates="post", cascade="all, delete-orphan"
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])  # type: ignore[name-defined]


class BlogPostTag(Base):
    __tablename__ = "blog_post_tags"

    blog_post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    blog_tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    post: Mapped["BlogPost"] = relationship("BlogPost", back_populates="tag_links")
    tag: Mapped["BlogTag"] = relationship("BlogTag", back_populates="post_links")


class BlogMenuItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "blog_menu_items"

    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_menu_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tag_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_tags.id", ondelete="SET NULL"),
        nullable=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tag: Mapped["BlogTag | None"] = relationship(
        "BlogTag", back_populates="menu_items", foreign_keys=[tag_id]
    )
    children: Mapped[list["BlogMenuItem"]] = relationship(
        "BlogMenuItem",
        foreign_keys=[parent_id],
        back_populates="parent",
        order_by="BlogMenuItem.sort_order",
    )
    parent: Mapped["BlogMenuItem | None"] = relationship(
        "BlogMenuItem",
        foreign_keys=[parent_id],
        back_populates="children",
        remote_side="BlogMenuItem.id",
    )
