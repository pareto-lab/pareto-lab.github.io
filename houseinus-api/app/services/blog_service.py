from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.blog import BlogMenuItem, BlogPost, BlogPostTag, BlogTag
from app.models.user import User


# ─── Helpers ────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _post_with_tags():
    return selectinload(BlogPost.tag_links).selectinload(BlogPostTag.tag)


def _menu_with_tag():
    return selectinload(BlogMenuItem.tag)


def _menu_with_children():
    return selectinload(BlogMenuItem.children).selectinload(BlogMenuItem.tag)


# ─── Tags ────────────────────────────────────────────────────────────────────


async def list_tags(db: AsyncSession, *, include_deleted: bool = False) -> list[BlogTag]:
    q = select(BlogTag)
    if not include_deleted:
        q = q.where(BlogTag.deleted_at.is_(None))
    q = q.order_by(BlogTag.name)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_tag_by_id(db: AsyncSession, tag_id: uuid.UUID) -> BlogTag | None:
    result = await db.execute(select(BlogTag).where(BlogTag.id == tag_id))
    return result.scalar_one_or_none()


async def get_tag_by_slug(db: AsyncSession, slug: str) -> BlogTag | None:
    result = await db.execute(
        select(BlogTag).where(BlogTag.slug == slug, BlogTag.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_tag(db: AsyncSession, *, name: str, slug: str) -> BlogTag:
    tag = BlogTag(id=uuid.uuid4(), name=name, slug=slug)
    db.add(tag)
    return tag


async def update_tag(
    db: AsyncSession, tag: BlogTag, *, name: str | None, slug: str | None
) -> BlogTag:
    if name is not None:
        tag.name = name
    if slug is not None:
        tag.slug = slug
    return tag


async def delete_tag(db: AsyncSession, tag: BlogTag) -> BlogTag:
    tag.deleted_at = _now()
    return tag


# ─── Posts ───────────────────────────────────────────────────────────────────


async def _set_tags(db: AsyncSession, post: BlogPost, tag_ids: list[uuid.UUID]) -> None:
    for link in list(post.tag_links):
        await db.delete(link)
    post.tag_links.clear()
    for tid in tag_ids:
        db.add(BlogPostTag(blog_post_id=post.id, blog_tag_id=tid))


async def list_posts(
    db: AsyncSession,
    *,
    tag_slug: str | None = None,
    skip: int = 0,
    limit: int = 12,
) -> tuple[list[BlogPost], int]:
    base = (
        select(BlogPost)
        .where(BlogPost.status == "published", BlogPost.deleted_at.is_(None))
        .options(_post_with_tags())
    )
    if tag_slug:
        tag = await get_tag_by_slug(db, tag_slug)
        if tag is None:
            return [], 0
        base = base.join(BlogPost.tag_links).where(BlogPostTag.blog_tag_id == tag.id)

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    items_q = base.order_by(BlogPost.reference_date.desc()).offset(skip).limit(limit)
    items = list((await db.execute(items_q)).scalars().all())
    return items, total


async def list_admin_posts(
    db: AsyncSession,
    *,
    status: str | None = None,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[BlogPost], int]:
    base = select(BlogPost).options(_post_with_tags())
    if not include_deleted:
        base = base.where(BlogPost.deleted_at.is_(None))
    if status:
        base = base.where(BlogPost.status == status)

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    items_q = base.order_by(BlogPost.reference_date.desc()).offset(skip).limit(limit)
    items = list((await db.execute(items_q)).scalars().all())
    return items, total


async def get_post_by_slug(db: AsyncSession, slug: str) -> BlogPost | None:
    result = await db.execute(
        select(BlogPost)
        .where(BlogPost.slug == slug, BlogPost.status == "published", BlogPost.deleted_at.is_(None))
        .options(_post_with_tags())
    )
    return result.scalar_one_or_none()


async def get_post_by_id(db: AsyncSession, post_id: uuid.UUID) -> BlogPost | None:
    result = await db.execute(
        select(BlogPost).where(BlogPost.id == post_id).options(_post_with_tags())
    )
    return result.scalar_one_or_none()


async def create_post(
    db: AsyncSession,
    *,
    title: str,
    slug: str,
    excerpt: str | None,
    cover_image_url: str | None,
    content: dict[str, Any],
    tag_ids: list[uuid.UUID],
    reference_date: datetime | None,
    actor: User,
) -> BlogPost:
    post = BlogPost(
        id=uuid.uuid4(),
        title=title,
        slug=slug,
        excerpt=excerpt,
        cover_image_url=cover_image_url,
        content=content,
        status="draft",
        reference_date=reference_date or _now(),
        created_by_id=actor.id,
        updated_by_id=actor.id,
    )
    db.add(post)
    await db.flush()  # get the id
    for tid in tag_ids:
        db.add(BlogPostTag(blog_post_id=post.id, blog_tag_id=tid))
    return post


async def update_post(
    db: AsyncSession,
    post: BlogPost,
    *,
    title: str | None,
    slug: str | None,
    excerpt: str | None,
    cover_image_url: str | None,
    content: dict[str, Any] | None,
    tag_ids: list[uuid.UUID] | None,
    reference_date: datetime | None,
    actor: User,
) -> BlogPost:
    if title is not None:
        post.title = title
    if slug is not None:
        post.slug = slug
    if excerpt is not None:
        post.excerpt = excerpt
    if cover_image_url is not None:
        post.cover_image_url = cover_image_url
    if content is not None:
        post.content = content
    if tag_ids is not None:
        await _set_tags(db, post, tag_ids)
    if reference_date is not None:
        post.reference_date = reference_date
    post.updated_by_id = actor.id
    return post


async def publish_post(db: AsyncSession, post: BlogPost, actor: User) -> BlogPost:
    post.status = "published"
    if post.published_at is None:
        post.published_at = _now()
    post.updated_by_id = actor.id
    return post


async def unpublish_post(db: AsyncSession, post: BlogPost, actor: User) -> BlogPost:
    post.status = "draft"
    post.updated_by_id = actor.id
    return post


async def delete_post(db: AsyncSession, post: BlogPost, actor: User) -> BlogPost:
    post.deleted_at = _now()
    post.updated_by_id = actor.id
    return post


async def restore_post(db: AsyncSession, post: BlogPost, actor: User) -> BlogPost:
    post.deleted_at = None
    post.updated_by_id = actor.id
    return post


# ─── Menu ────────────────────────────────────────────────────────────────────


async def list_menu(db: AsyncSession) -> list[BlogMenuItem]:
    """Return top-level menu items with children eagerly loaded."""
    result = await db.execute(
        select(BlogMenuItem)
        .where(BlogMenuItem.parent_id.is_(None))
        .options(_menu_with_tag(), _menu_with_children())
        .order_by(BlogMenuItem.sort_order)
    )
    return list(result.scalars().all())


async def get_menu_item(db: AsyncSession, item_id: uuid.UUID) -> BlogMenuItem | None:
    result = await db.execute(
        select(BlogMenuItem)
        .where(BlogMenuItem.id == item_id)
        .options(_menu_with_tag(), _menu_with_children())
    )
    return result.scalar_one_or_none()


async def create_menu_item(
    db: AsyncSession,
    *,
    label: str,
    icon: str | None,
    tag_id: uuid.UUID | None,
    parent_id: uuid.UUID | None,
    sort_order: int,
) -> BlogMenuItem:
    item = BlogMenuItem(
        id=uuid.uuid4(),
        label=label,
        icon=icon,
        tag_id=tag_id,
        parent_id=parent_id,
        sort_order=sort_order,
    )
    db.add(item)
    return item


async def update_menu_item(
    db: AsyncSession,
    item: BlogMenuItem,
    *,
    label: str | None,
    icon: str | None,
    tag_id: uuid.UUID | None,
    parent_id: uuid.UUID | None,
    sort_order: int | None,
) -> BlogMenuItem:
    if label is not None:
        item.label = label
    if icon is not None:
        item.icon = icon
    if tag_id is not None:
        item.tag_id = tag_id
    if parent_id is not None:
        item.parent_id = parent_id
    if sort_order is not None:
        item.sort_order = sort_order
    return item


async def delete_menu_item(db: AsyncSession, item: BlogMenuItem) -> None:
    await db.delete(item)


async def reorder_menu_items(db: AsyncSession, ordered_ids: list[uuid.UUID]) -> None:
    for i, item_id in enumerate(ordered_ids):
        result = await db.execute(select(BlogMenuItem).where(BlogMenuItem.id == item_id))
        item = result.scalar_one_or_none()
        if item:
            item.sort_order = i
