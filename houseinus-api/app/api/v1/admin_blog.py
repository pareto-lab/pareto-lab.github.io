"""Admin-only blog management endpoints."""
from __future__ import annotations

import pathlib
import uuid

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DbSession
from app.api.v1.blog import _menu_read, _post_list_item, _tag_read  # noqa: F401
from app.models.blog import BlogPost
from app.schemas.blog import (
    BlogImageUploadResponse,
    BlogMenuItemCreate,
    BlogMenuItemRead,
    BlogMenuItemUpdate,
    BlogMenuReorder,
    BlogPostAdminDetail,
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostUpdate,
    BlogTagCreate,
    BlogTagRead,
    BlogTagUpdate,
)
from app.services import blog_service, storage_service

router = APIRouter(prefix="/admin/blog", tags=["admin-blog"])


# ─── Tags ────────────────────────────────────────────────────────────────────


@router.get("/tags", response_model=list[BlogTagRead])
async def admin_list_tags(admin: CurrentAdmin, db: DbSession) -> list[BlogTagRead]:
    tags = await blog_service.list_tags(db, include_deleted=True)
    return [_tag_read(t) for t in tags]


@router.post("/tags", response_model=BlogTagRead, status_code=status.HTTP_201_CREATED)
async def admin_create_tag(
    payload: BlogTagCreate, admin: CurrentAdmin, db: DbSession
) -> BlogTagRead:
    existing = await blog_service.get_tag_by_slug(db, payload.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Tag slug already exists")
    tag = await blog_service.create_tag(db, name=payload.name, slug=payload.slug)
    await db.commit()
    await db.refresh(tag)
    return _tag_read(tag)


@router.patch("/tags/{tag_id}", response_model=BlogTagRead)
async def admin_update_tag(
    tag_id: uuid.UUID, payload: BlogTagUpdate, admin: CurrentAdmin, db: DbSession
) -> BlogTagRead:
    tag = await blog_service.get_tag_by_id(db, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    if payload.slug:
        existing = await blog_service.get_tag_by_slug(db, payload.slug)
        if existing and existing.id != tag_id:
            raise HTTPException(status_code=409, detail="Tag slug already exists")
    await blog_service.update_tag(db, tag, name=payload.name, slug=payload.slug)
    await db.commit()
    await db.refresh(tag)
    return _tag_read(tag)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_tag(
    tag_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> None:
    tag = await blog_service.get_tag_by_id(db, tag_id)
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    await blog_service.delete_tag(db, tag)
    await db.commit()


# ─── Posts ───────────────────────────────────────────────────────────────────


@router.get("/posts", response_model=BlogPostListResponse)
async def admin_list_posts(
    admin: CurrentAdmin,
    db: DbSession,
    status_filter: str | None = Query(default=None, alias="status"),
    include_deleted: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> BlogPostListResponse:
    posts, total = await blog_service.list_admin_posts(
        db,
        status=status_filter,
        include_deleted=include_deleted,
        skip=skip,
        limit=limit,
    )
    items = [_post_list_item(p) for p in posts]
    return BlogPostListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("/posts", response_model=BlogPostAdminDetail, status_code=status.HTTP_201_CREATED)
async def admin_create_post(
    payload: BlogPostCreate, admin: CurrentAdmin, db: DbSession
) -> BlogPostAdminDetail:
    post = await blog_service.create_post(
        db,
        title=payload.title,
        slug=payload.slug,
        excerpt=payload.excerpt,
        cover_image_url=payload.cover_image_url,
        content=payload.content,
        tag_ids=payload.tag_ids,
        reference_date=payload.reference_date,
        actor=admin,
    )
    await db.commit()
    await db.refresh(post)
    post = await blog_service.get_post_by_id(db, post.id)
    return _post_admin_detail(post)


@router.get("/posts/{post_id}", response_model=BlogPostAdminDetail)
async def admin_get_post(
    post_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> BlogPostAdminDetail:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return _post_admin_detail(post)


@router.patch("/posts/{post_id}", response_model=BlogPostAdminDetail)
async def admin_update_post(
    post_id: uuid.UUID,
    payload: BlogPostUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> BlogPostAdminDetail:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if payload.slug:
        existing_q = await db.execute(
            select(BlogPost).where(BlogPost.slug == payload.slug, BlogPost.id != post_id)
        )
        if existing_q.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Slug already in use")
    await blog_service.update_post(
        db,
        post,
        title=payload.title,
        slug=payload.slug,
        excerpt=payload.excerpt,
        cover_image_url=payload.cover_image_url,
        content=payload.content,
        tag_ids=payload.tag_ids,
        reference_date=payload.reference_date,
        actor=admin,
    )
    await db.commit()
    post = await blog_service.get_post_by_id(db, post_id)
    return _post_admin_detail(post)


@router.post("/posts/{post_id}/publish", response_model=BlogPostAdminDetail)
async def admin_publish_post(
    post_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> BlogPostAdminDetail:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.deleted_at:
        raise HTTPException(status_code=400, detail="Cannot publish a deleted post")
    await blog_service.publish_post(db, post, admin)
    await db.commit()
    post = await blog_service.get_post_by_id(db, post_id)
    return _post_admin_detail(post)


@router.post("/posts/{post_id}/unpublish", response_model=BlogPostAdminDetail)
async def admin_unpublish_post(
    post_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> BlogPostAdminDetail:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    await blog_service.unpublish_post(db, post, admin)
    await db.commit()
    post = await blog_service.get_post_by_id(db, post_id)
    return _post_admin_detail(post)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_post(
    post_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> None:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    await blog_service.delete_post(db, post, admin)
    await db.commit()


@router.post("/posts/{post_id}/restore", response_model=BlogPostAdminDetail)
async def admin_restore_post(
    post_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> BlogPostAdminDetail:
    post = await blog_service.get_post_by_id(db, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.deleted_at:
        raise HTTPException(status_code=400, detail="Post is not deleted")
    await blog_service.restore_post(db, post, admin)
    await db.commit()
    post = await blog_service.get_post_by_id(db, post_id)
    return _post_admin_detail(post)


# ─── Image upload ────────────────────────────────────────────────────────────


@router.post("/images", response_model=BlogImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def admin_upload_image(
    admin: CurrentAdmin,
    file: UploadFile = File(...),
) -> BlogImageUploadResponse:
    content = await file.read()
    mime = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"
    try:
        storage_service.validate_image_upload(filename, mime, len(content))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    asset_id = uuid.uuid4()
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(mime) or pathlib.Path(filename).suffix.lower() or ".bin"
    storage_key = f"blog/images/{asset_id}{ext}"
    storage_service.save_bytes(storage_key, content)
    url = storage_service.public_url(storage_key)
    return BlogImageUploadResponse(url=url)


# ─── Menu ────────────────────────────────────────────────────────────────────


@router.get("/menu", response_model=list[BlogMenuItemRead])
async def admin_list_menu(admin: CurrentAdmin, db: DbSession) -> list[BlogMenuItemRead]:
    items = await blog_service.list_menu(db)
    return [_menu_read(item) for item in items]


@router.post("/menu", response_model=BlogMenuItemRead, status_code=status.HTTP_201_CREATED)
async def admin_create_menu_item(
    payload: BlogMenuItemCreate, admin: CurrentAdmin, db: DbSession
) -> BlogMenuItemRead:
    item = await blog_service.create_menu_item(
        db,
        label=payload.label,
        icon=payload.icon,
        tag_id=payload.tag_id,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    await db.commit()
    await db.refresh(item)
    item = await blog_service.get_menu_item(db, item.id)
    return _menu_read(item)


@router.patch("/menu/{item_id}", response_model=BlogMenuItemRead)
async def admin_update_menu_item(
    item_id: uuid.UUID,
    payload: BlogMenuItemUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> BlogMenuItemRead:
    item = await blog_service.get_menu_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    await blog_service.update_menu_item(
        db,
        item,
        label=payload.label,
        icon=payload.icon,
        tag_id=payload.tag_id,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    await db.commit()
    item = await blog_service.get_menu_item(db, item_id)
    return _menu_read(item)


@router.delete("/menu/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_menu_item(
    item_id: uuid.UUID, admin: CurrentAdmin, db: DbSession
) -> None:
    item = await blog_service.get_menu_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")
    await blog_service.delete_menu_item(db, item)
    await db.commit()


@router.post("/menu/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def admin_reorder_menu(
    payload: BlogMenuReorder, admin: CurrentAdmin, db: DbSession
) -> None:
    await blog_service.reorder_menu_items(db, payload.ordered_ids)
    await db.commit()


# ─── Serialization helpers ────────────────────────────────────────────────────


def _post_admin_detail(post) -> BlogPostAdminDetail:
    return BlogPostAdminDetail(
        id=post.id,
        title=post.title,
        slug=post.slug,
        excerpt=post.excerpt,
        cover_image_url=post.cover_image_url,
        content=post.content,
        status=post.status,
        reference_date=post.reference_date,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
        deleted_at=post.deleted_at,
        created_by_id=post.created_by_id,
        updated_by_id=post.updated_by_id,
        tags=[_tag_read(link.tag) for link in post.tag_links if link.tag],
    )
