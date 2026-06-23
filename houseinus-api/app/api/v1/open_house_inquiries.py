from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Request, status

from app.api.deps import CurrentAdmin, DbSession
from app.schemas.open_house_inquiry import (
    OpenHouseInquiryCreate,
    OpenHouseInquiryListResponse,
    OpenHouseInquiryRead,
)
from app.services import (
    open_house_inquiry_service,
    property_service,
    telegram_service,
)

router = APIRouter(tags=["open-house-inquiries"])


@router.post(
    "/open-house-inquiries",
    response_model=OpenHouseInquiryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_open_house_inquiry(
    payload: OpenHouseInquiryCreate,
    request: Request,
    db: DbSession,
    background_tasks: BackgroundTasks,
) -> OpenHouseInquiryRead:
    property_title = None
    if payload.property_id:
        prop = await property_service.get_published(db, payload.property_id)
        if prop is None:
            raise HTTPException(status_code=404, detail="Property not found")
        property_title = prop.title

    inquiry = await open_house_inquiry_service.create_inquiry(
        db,
        payload,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(inquiry)

    background_tasks.add_task(
        telegram_service.notify_admins,
        notify_field="notify_open_house_inquiry",
        text=telegram_service.format_open_house_inquiry(
            property_title=property_title,
            name=inquiry.name,
            email=inquiry.email,
        ),
    )

    return OpenHouseInquiryRead.model_validate(
        open_house_inquiry_service.inquiry_to_payload(inquiry, property_title)
    )


@router.get(
    "/admin/open-house-inquiries",
    response_model=OpenHouseInquiryListResponse,
)
async def admin_list_open_house_inquiries(
    admin: CurrentAdmin,
    db: DbSession,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> OpenHouseInquiryListResponse:
    items, total = await open_house_inquiry_service.list_inquiries(
        db, skip=skip, limit=limit
    )
    return OpenHouseInquiryListResponse(
        items=[OpenHouseInquiryRead.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )
