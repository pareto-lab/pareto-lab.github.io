from __future__ import annotations

import secrets
import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Property, PropertyImage, PropertyStatus, User
from app.services import storage_service
from app.utils.time import utcnow

def generate_delivery_token() -> str:
    return secrets.token_urlsafe(32)


# ---------------------------------------------------------------- queries


async def get_by_id(
    db: AsyncSession, property_id: uuid.UUID, *, include_archived: bool = True
) -> Property | None:
    stmt = select(Property).where(Property.id == property_id)
    if not include_archived:
        stmt = stmt.where(Property.deleted_at.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_published(db: AsyncSession, property_id: uuid.UUID) -> Property | None:
    stmt = select(Property).where(
        Property.id == property_id,
        Property.status == PropertyStatus.published,
        Property.deleted_at.is_(None),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def get_published_by_slug(db: AsyncSession, slug: str) -> Property | None:
    stmt = select(Property).where(
        Property.slug == slug,
        Property.status == PropertyStatus.published,
        Property.deleted_at.is_(None),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def publish_self_serve(db: AsyncSession, *, prop: Property) -> Property:
    """Publish a property without an admin actor — used by the self-publish link."""
    prop.status = PropertyStatus.published
    prop.published_at = utcnow()
    await db.flush()
    return prop


async def list_admin(
    db: AsyncSession,
    *,
    query: str | None = None,
    statuses: list[PropertyStatus] | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Property], int]:
    base = (
        select(Property)
        .where(Property.deleted_at.is_(None))
        .order_by(Property.display_order.asc(), Property.created_at.desc())
    )
    count_stmt = (
        select(func.count())
        .select_from(Property)
        .where(Property.deleted_at.is_(None))
    )
    if query:
        like = f"%{query.lower()}%"
        cond = or_(
            func.lower(Property.title).like(like),
            func.lower(Property.location).like(like),
        )
        base = base.where(cond)
        count_stmt = count_stmt.where(cond)
    if statuses:
        base = base.where(Property.status.in_(statuses))
        count_stmt = count_stmt.where(Property.status.in_(statuses))

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(base.offset(skip).limit(limit))).scalars().all()
    return list(items), int(total)


async def list_published(
    db: AsyncSession, *, skip: int = 0, limit: int = 50
) -> tuple[list[Property], int]:
    base = (
        select(Property)
        .where(
            Property.status == PropertyStatus.published,
            Property.deleted_at.is_(None),
        )
        .order_by(Property.display_order.asc(), Property.published_at.desc().nullslast())
    )
    count_stmt = (
        select(func.count())
        .select_from(Property)
        .where(
            Property.status == PropertyStatus.published,
            Property.deleted_at.is_(None),
        )
    )
    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(base.offset(skip).limit(limit))).scalars().all()
    return list(items), int(total)


# ---------------------------------------------------------------- mutations


_DEFAULT_EVALUATION_METRICS: list[dict] = [
    {
        "score": 81,
        "title": "유지관리 용이성",
        "description": "경사형 징크 지붕과 석재 마당으로 관리가 매우 수월하고 누수/범람의 위험이 적습니다. 스타코 외장 및 펜스는 주기적인 도장이 필요합니다.",
    },
    {
        "score": 71,
        "title": "쾌적도",
        "description": '단열 성능은 "우수"로 예상됩니다. 일반 및 재활용 쓰레기는 집 앞에서 수거되나, 음식물쓰레기 배출 동선이 길어 다소 불편합니다.',
    },
    {
        "score": 16,
        "title": "보행 친화도",
        "description": "도보권 내 편의시설이 부족하여 자차 이용이 권장되는 입지입니다. 집 앞 도로가 가파른 편으로, 특히 노약자는 도보로 이동하기 어렵습니다.",
    },
    {
        "score": 88,
        "title": "가격 적정성",
        "description": '"적정"수준의 가격으로 등록되었습니다.',
    },
]


async def create(
    db: AsyncSession,
    *,
    title: str,
    location: str,
    price: int,
    actor: User,
) -> Property:
    prop = Property(
        title=title,
        location=location,
        price=price,
        status=PropertyStatus.draft,
        created_by_id=actor.id,
        updated_by_id=actor.id,
        evaluation_metrics=list(_DEFAULT_EVALUATION_METRICS),
    )
    db.add(prop)
    await db.flush()
    return prop


async def update(
    db: AsyncSession,
    *,
    prop: Property,
    payload: dict[str, Any],
    actor: User,
) -> Property:
    for key, value in payload.items():
        if hasattr(prop, key):
            setattr(prop, key, value)
    prop.updated_by_id = actor.id
    await db.flush()
    return prop


async def publish(db: AsyncSession, *, prop: Property, actor: User) -> Property:
    prop.status = PropertyStatus.published
    prop.published_at = utcnow()
    prop.updated_by_id = actor.id
    await db.flush()
    return prop


async def unpublish(db: AsyncSession, *, prop: Property, actor: User) -> Property:
    prop.status = PropertyStatus.draft
    prop.published_at = None
    prop.updated_by_id = actor.id
    await db.flush()
    return prop


async def archive(db: AsyncSession, *, prop: Property, actor: User) -> Property:
    prop.status = PropertyStatus.archived
    prop.deleted_at = utcnow()
    prop.updated_by_id = actor.id
    await db.flush()
    return prop


# ---------------------------------------------------------------- images / files


async def create_image_record(
    db: AsyncSession,
    *,
    property_id: uuid.UUID,
    storage_key: str,
    original_filename: str,
    mime_type: str,
    byte_size: int,
    width: int | None = None,
    height: int | None = None,
    caption: str | None = None,
    alt: str | None = None,
) -> PropertyImage:
    image = PropertyImage(
        property_id=property_id,
        storage_key=storage_key,
        original_filename=original_filename,
        mime_type=mime_type,
        byte_size=byte_size,
        width=width,
        height=height,
        caption=caption,
        alt=alt,
        uploaded_at=utcnow(),
    )
    db.add(image)
    await db.flush()
    return image


async def get_image(db: AsyncSession, image_id: uuid.UUID) -> PropertyImage | None:
    return await db.get(PropertyImage, image_id)


async def delete_image(db: AsyncSession, image: PropertyImage) -> None:
    storage_service.delete(image.storage_key)
    await db.delete(image)
    await db.flush()


# ---------------------------------------------------------------- serialization helpers


def image_to_payload(img: PropertyImage) -> dict[str, Any]:
    """Convert ORM image into a dict that PropertyImageRead can validate.
    Adds the ``url`` field that's not in the DB."""
    return {
        "id": img.id,
        "storage_key": img.storage_key,
        "original_filename": img.original_filename,
        "mime_type": img.mime_type,
        "byte_size": img.byte_size,
        "width": img.width,
        "height": img.height,
        "caption": img.caption,
        "alt": img.alt,
        "uploaded_at": img.uploaded_at,
        "url": storage_service.public_url(img.storage_key),
    }


async def assemble_read_payload(db: AsyncSession, prop: Property) -> dict[str, Any]:
    """Return a dict shaped for PropertyRead.  Loads all images and
    pre-resolves hero/portfolio refs."""
    # Force-load relationships if not already loaded.
    images_stmt = select(PropertyImage).where(PropertyImage.property_id == prop.id)
    images = (await db.execute(images_stmt)).scalars().all()

    images_by_id = {img.id: img for img in images}

    return {
        "id": prop.id,
        "slug": prop.slug,
        "delivery_token": prop.delivery_token,
        "delivery_birthdate": prop.delivery_birthdate,
        "status": prop.status,
        "title": prop.title,
        "subtitle": prop.subtitle,
        "location": prop.location,
        "price": prop.price,
        "display_order": prop.display_order,
        "tags": prop.tags,
        "lifestyle_story": prop.lifestyle_story,
        "lifestyle_story_overlay": prop.lifestyle_story_overlay,
        "lifestyle_highlights": prop.lifestyle_highlights,
        "lifestyle_layout": prop.lifestyle_layout,
        "specs": prop.specs,
        "loan_info": prop.loan_info,
        "open_house_events": [],
        "house_plan_specs": prop.house_plan_specs,
        "nearby_places": prop.nearby_places,
        "evaluation_metrics": prop.evaluation_metrics,
        "interior_photos": prop.interior_photos,
        "floorplans": prop.floorplans,
        "lifestyle_scenarios": prop.lifestyle_scenarios,
        "hero_image": image_to_payload(images_by_id[prop.hero_image_id])
        if prop.hero_image_id and prop.hero_image_id in images_by_id
        else None,
        "portfolio_thumb": image_to_payload(images_by_id[prop.portfolio_thumb_id])
        if prop.portfolio_thumb_id and prop.portfolio_thumb_id in images_by_id
        else None,
        "images": [image_to_payload(i) for i in images],
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
        "published_at": prop.published_at,
    }


async def assemble_mcp_summary(db: AsyncSession, prop: Property) -> dict[str, Any]:
    """Slim payload for MCP: scalar fields, hero/portfolio refs, and per-section counts.

    Heavy JSONB lists (interior_photos, lifestyle_*, specs, nearby_places, ...) and
    the full images array are excluded — fetch them via the section endpoints.
    """
    images_count_stmt = (
        select(func.count())
        .select_from(PropertyImage)
        .where(PropertyImage.property_id == prop.id)
    )
    images_count = (await db.execute(images_count_stmt)).scalar_one()

    hero = await get_image(db, prop.hero_image_id) if prop.hero_image_id else None
    portfolio_thumb = (
        await get_image(db, prop.portfolio_thumb_id) if prop.portfolio_thumb_id else None
    )

    return {
        "id": prop.id,
        "slug": prop.slug,
        "delivery_token": prop.delivery_token,
        "delivery_birthdate": prop.delivery_birthdate,
        "status": prop.status,
        "title": prop.title,
        "subtitle": prop.subtitle,
        "location": prop.location,
        "price": prop.price,
        "display_order": prop.display_order,
        "tags": prop.tags,
        "lifestyle_layout": prop.lifestyle_layout,
        "lifestyle_story_overlay": prop.lifestyle_story_overlay,
        "hero_image": image_to_payload(hero) if hero else None,
        "portfolio_thumb": image_to_payload(portfolio_thumb) if portfolio_thumb else None,
        "counts": {
            "images": int(images_count),
            "interior_photos": len(prop.interior_photos or []),
            "lifestyle_scenarios": len(prop.lifestyle_scenarios or []),
            "lifestyle_highlights": len(prop.lifestyle_highlights or []),
            "nearby_places": len(prop.nearby_places or []),
            "evaluation_metrics": len(prop.evaluation_metrics or []),
            "floorplans": len(prop.floorplans or {}),
        },
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
        "published_at": prop.published_at,
    }


async def assemble_mcp_images_page(
    db: AsyncSession, prop: Property, *, skip: int, limit: int
) -> dict[str, Any]:
    count_stmt = (
        select(func.count())
        .select_from(PropertyImage)
        .where(PropertyImage.property_id == prop.id)
    )
    total = (await db.execute(count_stmt)).scalar_one()
    items_stmt = (
        select(PropertyImage)
        .where(PropertyImage.property_id == prop.id)
        .order_by(PropertyImage.uploaded_at.asc())
        .offset(skip)
        .limit(limit)
    )
    images = (await db.execute(items_stmt)).scalars().all()
    return {
        "items": [image_to_payload(i) for i in images],
        "total": int(total),
        "skip": skip,
        "limit": limit,
    }


def list_item_payload(prop: Property, hero: PropertyImage | None) -> dict[str, Any]:
    return {
        "id": prop.id,
        "slug": prop.slug,
        "status": prop.status,
        "title": prop.title,
        "subtitle": prop.subtitle,
        "location": prop.location,
        "price": prop.price,
        "display_order": prop.display_order,
        "tags": prop.tags,
        "specs": prop.specs,
        "open_house_events": [],
        "hero_image": image_to_payload(hero) if hero else None,
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
        "published_at": prop.published_at,
    }


__all__ = [
    "archive",
    "assemble_read_payload",
    "create",
    "create_image_record",
    "delete_image",
    "get_by_id",
    "get_image",
    "get_published",
    "get_published_by_slug",
    "image_to_payload",
    "list_admin",
    "list_item_payload",
    "list_published",
    "publish",
    "unpublish",
    "update",
]
