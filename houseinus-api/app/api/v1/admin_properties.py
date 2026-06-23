"""Admin-only property management endpoints.

Layered as a separate router from ``admin.py`` (user management) for clarity.
Both still mounted under ``/api/v1/admin``.
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field
from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.api.deps import CurrentAdmin, DbSession
from app.models import PropertyStatus
from app.schemas.property import (
    ImageMetaUpdate,
    PropertyAdminRead,
    PropertyBasicUpdate,
    PropertyCreate,
    PropertyImageRead,
    PropertyInteriorUpdate,
    PropertyLifestyleUpdate,
    PropertyListItem,
    PropertyListResponse,
    PropertySpecsUpdate,
    PropertyUpdate,
)
from app.services import print_pdf_service, property_service, storage_service

router = APIRouter(prefix="/admin/properties", tags=["admin-properties"])


# ----------------------------------------------------------------- list / read


@router.get("", response_model=PropertyListResponse)
async def admin_list(
    admin: CurrentAdmin,
    db: DbSession,
    q: str | None = Query(default=None),
    statuses: list[PropertyStatus] | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> PropertyListResponse:
    items, total = await property_service.list_admin(
        db, query=q, statuses=statuses, skip=skip, limit=limit
    )
    # Resolve hero image for each item.
    payloads = []
    for prop in items:
        hero = (
            await property_service.get_image(db, prop.hero_image_id)
            if prop.hero_image_id
            else None
        )
        payloads.append(
            PropertyListItem.model_validate(
                property_service.list_item_payload(prop, hero)
            )
        )
    return PropertyListResponse(items=payloads, total=total, skip=skip, limit=limit)


@router.get("/{property_id}", response_model=PropertyAdminRead)
async def admin_get(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )
    payload = await property_service.assemble_read_payload(db, prop)
    return PropertyAdminRead.model_validate(payload)


# ----------------------------------------------------------------- MCP section reads
#
# These split the full admin_get payload into smaller sections so MCP tool
# responses stay under the JSON-RPC stdio line-buffer limit (~64 KiB on most
# clients). Web/admin UIs should keep using ``GET /admin/properties/{id}``.


async def _load_property_or_404(
    db: DbSession, property_id: uuid.UUID
):
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )
    return prop


@router.get("/{property_id}/mcp/summary")
async def admin_mcp_summary(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    return await property_service.assemble_mcp_summary(db, prop)


@router.get("/{property_id}/mcp/lifestyle")
async def admin_mcp_lifestyle(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    return {
        "lifestyle_story": prop.lifestyle_story,
        "lifestyle_story_overlay": prop.lifestyle_story_overlay,
        "lifestyle_highlights": prop.lifestyle_highlights,
        "lifestyle_layout": prop.lifestyle_layout,
        "lifestyle_scenarios": prop.lifestyle_scenarios,
    }


@router.get("/{property_id}/mcp/interior")
async def admin_mcp_interior(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    return {
        "interior_photos": prop.interior_photos,
        "floorplans": prop.floorplans,
    }


@router.get("/{property_id}/mcp/specs")
async def admin_mcp_specs(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    return {
        "specs": prop.specs,
        "loan_info": prop.loan_info,
        "house_plan_specs": prop.house_plan_specs,
        "nearby_places": prop.nearby_places,
        "evaluation_metrics": prop.evaluation_metrics,
    }


@router.get("/{property_id}/mcp/images")
async def admin_mcp_images(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    return await property_service.assemble_mcp_images_page(db, prop, skip=skip, limit=limit)


async def _apply_section_update(
    db: DbSession, prop, payload: BaseModel, admin
) -> None:
    raw = _flatten_update_payload(payload)
    await property_service.update(db, prop=prop, payload=raw, actor=admin)
    await print_pdf_service.deprecate_jobs(db, prop.id)
    await db.commit()
    await db.refresh(prop)


@router.patch("/{property_id}/mcp/basic")
async def admin_mcp_update_basic(
    property_id: uuid.UUID,
    payload: PropertyBasicUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    await _apply_section_update(db, prop, payload, admin)
    return await property_service.assemble_mcp_summary(db, prop)


@router.patch("/{property_id}/mcp/lifestyle")
async def admin_mcp_update_lifestyle(
    property_id: uuid.UUID,
    payload: PropertyLifestyleUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    await _apply_section_update(db, prop, payload, admin)
    return {
        "lifestyle_story": prop.lifestyle_story,
        "lifestyle_story_overlay": prop.lifestyle_story_overlay,
        "lifestyle_highlights": prop.lifestyle_highlights,
        "lifestyle_layout": prop.lifestyle_layout,
        "lifestyle_scenarios": prop.lifestyle_scenarios,
    }


@router.patch("/{property_id}/mcp/interior")
async def admin_mcp_update_interior(
    property_id: uuid.UUID,
    payload: PropertyInteriorUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    await _apply_section_update(db, prop, payload, admin)
    return {
        "interior_photos": prop.interior_photos,
        "floorplans": prop.floorplans,
    }


@router.patch("/{property_id}/mcp/specs")
async def admin_mcp_update_specs(
    property_id: uuid.UUID,
    payload: PropertySpecsUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> dict:
    prop = await _load_property_or_404(db, property_id)
    await _apply_section_update(db, prop, payload, admin)
    return {
        "specs": prop.specs,
        "loan_info": prop.loan_info,
        "house_plan_specs": prop.house_plan_specs,
        "nearby_places": prop.nearby_places,
        "evaluation_metrics": prop.evaluation_metrics,
    }


# ----------------------------------------------------------------- create / update


@router.post(
    "",
    response_model=PropertyAdminRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create(
    payload: PropertyCreate,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.create(
        db,
        title=payload.title,
        location=payload.location,
        price=payload.price,
        actor=admin,
    )
    await db.commit()
    await db.refresh(prop)
    body = await property_service.assemble_read_payload(db, prop)
    return PropertyAdminRead.model_validate(body)


def _flatten_update_payload(payload: BaseModel) -> dict:
    """Convert a partial-update Pydantic model into a JSONB-safe dict.

    ``mode="json"`` already flattens nested Pydantic models, but we keep the
    explicit ``model_dump`` fallbacks below as a safety net for fields whose
    annotated type is ``Any``.
    """
    raw = payload.model_dump(exclude_unset=True, mode="json")
    for key in ("specs", "loan_info", "house_plan_specs"):
        if key in raw and hasattr(raw[key], "model_dump"):
            raw[key] = raw[key].model_dump(mode="json")
    for key in (
        "nearby_places",
        "evaluation_metrics",
        "interior_photos",
        "lifestyle_scenarios",
    ):
        if key in raw:
            raw[key] = [
                v.model_dump(mode="json") if hasattr(v, "model_dump") else v
                for v in raw[key]
            ]
    if "floorplans" in raw and isinstance(raw["floorplans"], dict):
        raw["floorplans"] = {
            k: (v.model_dump(mode="json") if hasattr(v, "model_dump") else v)
            for k, v in raw["floorplans"].items()
        }
    return raw


@router.patch("/{property_id}", response_model=PropertyAdminRead)
async def admin_update(
    property_id: uuid.UUID,
    payload: PropertyUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Property not found"
        )

    raw = _flatten_update_payload(payload)
    await property_service.update(db, prop=prop, payload=raw, actor=admin)
    await print_pdf_service.deprecate_jobs(db, property_id)
    await db.commit()
    await db.refresh(prop)
    body = await property_service.assemble_read_payload(db, prop)
    return PropertyAdminRead.model_validate(body)


# ----------------------------------------------------------------- delivery link


class DeliveryLinkPayload(BaseModel):
    birthdate: str = Field(..., min_length=8, max_length=8, pattern=r"^\d{8}$")


@router.post("/{property_id}/delivery-link", response_model=PropertyAdminRead)
async def admin_create_delivery_link(
    property_id: uuid.UUID,
    body: DeliveryLinkPayload,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    prop.delivery_token = property_service.generate_delivery_token()
    prop.delivery_birthdate = body.birthdate
    await db.commit()
    await db.refresh(prop)
    return PropertyAdminRead.model_validate(
        await property_service.assemble_read_payload(db, prop)
    )


# ----------------------------------------------------------------- status


@router.post("/{property_id}/publish", response_model=PropertyAdminRead)
async def admin_publish(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    await property_service.publish(db, prop=prop, actor=admin)
    await db.commit()
    await db.refresh(prop)
    return PropertyAdminRead.model_validate(
        await property_service.assemble_read_payload(db, prop)
    )


@router.post("/{property_id}/unpublish", response_model=PropertyAdminRead)
async def admin_unpublish(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyAdminRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    await property_service.unpublish(db, prop=prop, actor=admin)
    await db.commit()
    await db.refresh(prop)
    return PropertyAdminRead.model_validate(
        await property_service.assemble_read_payload(db, prop)
    )


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_archive(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> None:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    await property_service.archive(db, prop=prop, actor=admin)
    await db.commit()


# ----------------------------------------------------------------- images


@router.post(
    "/{property_id}/images",
    response_model=PropertyImageRead,
    status_code=status.HTTP_201_CREATED,
)
async def admin_upload_image(
    property_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    alt: str | None = Form(default=None),
) -> PropertyImageRead:
    prop = await property_service.get_by_id(db, property_id)
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")

    content = await file.read()
    try:
        storage_service.validate_image_upload(
            file.filename or "", file.content_type or "", len(content)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    image_id = uuid.uuid4()
    storage_key = storage_service.storage_key_for_asset(
        property_id,
        image_id,
        filename=file.filename or "",
        mime_type=file.content_type or "",
    )
    storage_service.save_bytes(storage_key, content)

    image = await property_service.create_image_record(
        db,
        property_id=property_id,
        storage_key=storage_key,
        original_filename=file.filename or "",
        mime_type=file.content_type or "application/octet-stream",
        byte_size=len(content),
        caption=caption,
        alt=alt,
    )
    # Override generated id with our pre-allocated one for predictable storage path.
    image.id = image_id
    await db.commit()
    await db.refresh(image)

    return PropertyImageRead.model_validate(property_service.image_to_payload(image))


@router.patch(
    "/{property_id}/images/{image_id}",
    response_model=PropertyImageRead,
)
async def admin_update_image_meta(
    property_id: uuid.UUID,
    image_id: uuid.UUID,
    payload: ImageMetaUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> PropertyImageRead:
    image = await property_service.get_image(db, image_id)
    if image is None or image.property_id != property_id:
        raise HTTPException(status_code=404, detail="Image not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(image, k, v)
    await db.commit()
    await db.refresh(image)
    return PropertyImageRead.model_validate(property_service.image_to_payload(image))


@router.delete(
    "/{property_id}/images/{image_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def admin_delete_image(
    property_id: uuid.UUID,
    image_id: uuid.UUID,
    admin: CurrentAdmin,
    db: DbSession,
) -> None:
    image = await property_service.get_image(db, image_id)
    if image is None or image.property_id != property_id:
        raise HTTPException(status_code=404, detail="Image not found")
    await property_service.delete_image(db, image)
    await db.commit()


