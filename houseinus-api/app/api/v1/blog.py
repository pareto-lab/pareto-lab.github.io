"""Public blog endpoints — no authentication required."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession
from app.schemas.blog import (
    BlogMenuItemRead,
    BlogPostDetail,
    BlogPostListResponse,
    BlogPostListItem,
    BlogTagRead,
)
from app.services import blog_service

router = APIRouter(prefix="/blog", tags=["blog"])


@router.get("/menu", response_model=list[BlogMenuItemRead])
async def get_menu(db: DbSession) -> list[BlogMenuItemRead]:
    items = await blog_service.list_menu(db)
    return [_menu_read(item) for item in items]


@router.get("/tags", response_model=list[BlogTagRead])
async def get_tags(db: DbSession) -> list[BlogTagRead]:
    tags = await blog_service.list_tags(db)
    return [BlogTagRead.model_validate(t) for t in tags]


@router.get("/posts", response_model=BlogPostListResponse)
async def list_posts(
    db: DbSession,
    tag: str | None = Query(default=None, description="Filter by tag slug"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=12, ge=1, le=50),
) -> BlogPostListResponse:
    posts, total = await blog_service.list_posts(db, tag_slug=tag, skip=skip, limit=limit)
    items = [_post_list_item(p) for p in posts]
    return BlogPostListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/posts/{slug}", response_model=BlogPostDetail)
async def get_post(slug: str, db: DbSession) -> BlogPostDetail:
    post = await blog_service.get_post_by_slug(db, slug)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _post_detail(post)


# ─── Serialization helpers ────────────────────────────────────────────────────


def _tag_read(tag) -> BlogTagRead:
    return BlogTagRead.model_validate(tag)


def _post_list_item(post) -> BlogPostListItem:
    return BlogPostListItem(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        cover_image_url=post.cover_image_url,
        status=post.status,
        reference_date=post.reference_date,
        tags=[_tag_read(link.tag) for link in post.tag_links if link.tag],
    )


def _post_detail(post) -> BlogPostDetail:
    return BlogPostDetail(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        cover_image_url=post.cover_image_url,
        content=post.content,
        status=post.status,
        reference_date=post.reference_date,
        tags=[_tag_read(link.tag) for link in post.tag_links if link.tag],
    )


def _menu_read(item) -> BlogMenuItemRead:
    return BlogMenuItemRead(
        id=item.id,
        label=item.label,
        icon=item.icon,
        tag_id=item.tag_id,
        tag=_tag_read(item.tag) if item.tag else None,
        parent_id=item.parent_id,
        sort_order=item.sort_order,
        children=[_menu_read(child) for child in (item.children or [])],
    )
