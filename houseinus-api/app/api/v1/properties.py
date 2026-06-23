"""Public read-only property endpoints.

Published properties are visible to everyone.
Draft properties are accessible when either:
  - A valid delivery token + birthdate pair is supplied as query params, or
  - The request carries an admin-level session Bearer token.
"""
from __future__ import annotations

import logging
import uuid

log = logging.getLogger(__name__)

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, oauth2_scheme
from app.config import settings
from app.core.session import load_session
from app.models import Property, PropertyStatus
from app.models.user import UserRole, role_at_least
from app.schemas.property import PropertyListItem, PropertyListResponse, PropertyRead
from app.services import (
    open_house_service,
    print_pdf_service,
    property_service,
    storage_service,
    telegram_service,
    user_service,
)

router = APIRouter(prefix="/properties", tags=["properties"])


class DeliveryPublishBody(BaseModel):
    token: str = Field(..., min_length=1)
    birthdate: str = Field(..., min_length=8, max_length=8, pattern=r"^\d{8}$")


async def _caller_is_admin(bearer: str | None, db: AsyncSession) -> bool:
    if not bearer:
        return False
    session = await load_session(bearer)
    if session is None:
        return False
    user = await user_service.get_user_by_id(db, session.user_id)
    if user is None or not user.is_active:
        return False
    return role_at_least(user.role, UserRole.admin)


async def _get_by_delivery_auth(
    db: AsyncSession, slug_or_id: str, token: str, birthdate: str
) -> Property | None:
    try:
        prop_id: uuid.UUID | None = uuid.UUID(slug_or_id)
    except ValueError:
        prop_id = None

    conds = [Property.slug == slug_or_id]
    if prop_id is not None:
        conds.append(Property.id == prop_id)

    stmt = select(Property).where(
        Property.delivery_token == token,
        Property.delivery_birthdate == birthdate,
        Property.deleted_at.is_(None),
        or_(*conds),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


@router.get("", response_model=PropertyListResponse)
async def list_properties(
    db: DbSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> PropertyListResponse:
    items, total = await property_service.list_published(db, skip=skip, limit=limit)
    payloads = []
    for prop in items:
        hero = (
            await property_service.get_image(db, prop.hero_image_id)
            if prop.hero_image_id
            else None
        )
        payloads.append(
            PropertyListItem.model_validate(
                await _with_next_open_house(
                    db,
                    property_service.list_item_payload(prop, hero),
                    prop.id,
                )
            )
        )
    return PropertyListResponse(items=payloads, total=total, skip=skip, limit=limit)


@router.post("/{slug_or_id}/publish", response_model=PropertyRead)
async def delivery_publish(
    slug_or_id: str,
    body: DeliveryPublishBody,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> PropertyRead:
    prop = await _get_by_delivery_auth(db, slug_or_id, body.token, body.birthdate)
    if prop is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 일치하지 않습니다.")
    newly_published = prop.status != PropertyStatus.published
    if newly_published:
        await property_service.publish_self_serve(db, prop=prop)
        await db.commit()
        await db.refresh(prop)
        background_tasks.add_task(
            telegram_service.notify_admins,
            notify_field="notify_delivery_publish",
            text=telegram_service.format_delivery_publish(
                property_title=prop.title,
                property_slug_or_id=prop.slug or str(prop.id),
            ),
        )
    body_payload = await _with_next_open_house(
        db,
        await property_service.assemble_read_payload(db, prop),
        prop.id,
    )
    return PropertyRead.model_validate(body_payload)


@router.get("/{property_id_or_slug}", response_model=PropertyRead)
async def get_property(
    property_id_or_slug: str,
    db: DbSession,
    bearer: str | None = Depends(oauth2_scheme),
    token: str | None = Query(default=None),
    birthdate: str | None = Query(default=None),
) -> PropertyRead:
    prop = None

    # Delivery auth: token + birthdate provided → return draft or published
    if token and birthdate:
        prop = await _get_by_delivery_auth(db, property_id_or_slug, token, birthdate)
        if prop is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 일치하지 않습니다.")

    # Admin session → return any non-deleted property
    if prop is None and await _caller_is_admin(bearer, db):
        try:
            prop_id = uuid.UUID(property_id_or_slug)
        except ValueError:
            prop_id = None

        if prop_id is not None:
            prop = await property_service.get_by_id(db, prop_id)
        if prop is None:
            stmt = select(Property).where(
                Property.slug == property_id_or_slug,
                Property.deleted_at.is_(None),
            )
            prop = (await db.execute(stmt)).scalar_one_or_none()

    # Default: published only
    if prop is None:
        try:
            prop_id = uuid.UUID(property_id_or_slug)
        except ValueError:
            prop_id = None

        if prop_id is not None:
            prop = await property_service.get_published(db, prop_id)
        if prop is None:
            prop = await property_service.get_published_by_slug(db, property_id_or_slug)

    if prop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    body = await _with_next_open_house(
        db,
        await property_service.assemble_read_payload(db, prop),
        prop.id,
    )
    return PropertyRead.model_validate(body)


# ─────────────────────────────────────────────── print-pdf endpoints ──────────


class PrintPdfStatus(BaseModel):
    status: str  # "none" | "pending" | "ready" | "failed"


async def _get_prop_by_delivery_auth_or_401(
    db: AsyncSession, property_id_or_slug: str, token: str | None, birthdate: str | None
) -> Property:
    if not token or not birthdate:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 필요합니다.")
    prop = await _get_by_delivery_auth(db, property_id_or_slug, token, birthdate)
    if prop is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 일치하지 않습니다.")
    return prop


@router.post("/{property_id_or_slug}/print-pdf", response_model=PrintPdfStatus)
async def trigger_print_pdf(
    property_id_or_slug: str,
    background_tasks: BackgroundTasks,
    db: DbSession,
    token: str | None = Query(default=None),
    birthdate: str | None = Query(default=None),
) -> PrintPdfStatus:
    prop = await _get_prop_by_delivery_auth_or_401(db, property_id_or_slug, token, birthdate)

    job = await print_pdf_service.get_current_job(db, prop.id, prop.updated_at)

    if job is not None and job.status == "ready":
        if print_pdf_service._file_exists(job.storage_key):
            return PrintPdfStatus(status="ready")
        # File gone — wipe job and fall through to recreate.
        await print_pdf_service.deprecate_jobs(db, prop.id)
        await db.commit()
        job = None

    if job is not None and job.status == "pending":
        return PrintPdfStatus(status="pending")

    if job is not None and job.status == "failed":
        await print_pdf_service.deprecate_jobs(db, prop.id)
        await db.commit()
        job = None

    # Create a new job and start background PDF generation.
    job = await print_pdf_service.create_job(db, prop.id, prop.updated_at)
    await db.commit()
    await db.refresh(job)

    print_url = (
        f"{settings.frontend_url}/properties/{prop.id}/print"
        f"?token={token}&birthdate={birthdate}"
    )
    log.info("print-pdf: print_url=%s", print_url)
    background_tasks.add_task(
        print_pdf_service.generate_pdf_background,
        job.id,
        print_url,
        job.storage_key,
    )
    return PrintPdfStatus(status="pending")


@router.get("/{property_id_or_slug}/print-pdf/status", response_model=PrintPdfStatus)
async def get_print_pdf_status(
    property_id_or_slug: str,
    db: DbSession,
    token: str | None = Query(default=None),
    birthdate: str | None = Query(default=None),
) -> PrintPdfStatus:
    prop = await _get_prop_by_delivery_auth_or_401(db, property_id_or_slug, token, birthdate)
    job = await print_pdf_service.get_current_job(db, prop.id, prop.updated_at)
    if job is None:
        return PrintPdfStatus(status="none")
    if job.status == "ready" and not print_pdf_service._file_exists(job.storage_key):
        return PrintPdfStatus(status="none")
    return PrintPdfStatus(status=job.status)


@router.get("/{property_id_or_slug}/print-pdf/download")
async def download_print_pdf(
    property_id_or_slug: str,
    db: DbSession,
    token: str | None = Query(default=None),
    birthdate: str | None = Query(default=None),
) -> FileResponse:
    prop = await _get_prop_by_delivery_auth_or_401(db, property_id_or_slug, token, birthdate)
    job = await print_pdf_service.get_current_job(db, prop.id, prop.updated_at)
    if job is None or job.status != "ready":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF가 아직 준비되지 않았습니다.")
    abs_path = storage_service.base_dir() / job.storage_key
    if not abs_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF 파일을 찾을 수 없습니다.")
    filename = f"{prop.slug or prop.id}_소개서.pdf"
    return FileResponse(
        path=str(abs_path),
        media_type="application/pdf",
        filename=filename,
    )


async def _with_next_open_house(
    db: AsyncSession, payload: dict, property_id: uuid.UUID
) -> dict:
    event = await open_house_service.next_public_event(db, property_id)
    payload["open_house_events"] = [_public_event_for_property_payload(event)] if event else []
    return payload


def _public_event_for_property_payload(event: dict | None) -> dict | None:
    if event is None:
        return None
    return {
        **event,
        "date": event["date"].isoformat()
        if hasattr(event.get("date"), "isoformat")
        else event.get("date"),
    }
