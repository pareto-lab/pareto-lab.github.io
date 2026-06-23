from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OpenHouseInquiry, Property
from app.schemas.open_house_inquiry import OpenHouseInquiryCreate


async def create_inquiry(
    db: AsyncSession,
    payload: OpenHouseInquiryCreate,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> OpenHouseInquiry:
    inquiry = OpenHouseInquiry(
        property_id=payload.property_id,
        name=payload.name.strip(),
        email=str(payload.email).strip(),
        privacy_consent=payload.privacy_consent,
        source_url=payload.source_url,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(inquiry)
    await db.flush()
    return inquiry


async def list_inquiries(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    stmt = (
        select(OpenHouseInquiry, Property.title)
        .outerjoin(Property, OpenHouseInquiry.property_id == Property.id)
        .order_by(OpenHouseInquiry.created_at.desc())
    )
    count_stmt = select(func.count()).select_from(OpenHouseInquiry)

    total = (await db.execute(count_stmt)).scalar_one()
    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()
    return [
        inquiry_to_payload(inquiry, property_title) for inquiry, property_title in rows
    ], int(total)


def inquiry_to_payload(
    inquiry: OpenHouseInquiry, property_title: str | None = None
) -> dict:
    return {
        "id": inquiry.id,
        "property_id": inquiry.property_id,
        "property_title": property_title,
        "name": inquiry.name,
        "email": inquiry.email,
        "privacy_consent": inquiry.privacy_consent,
        "source_url": inquiry.source_url,
        "created_at": inquiry.created_at,
        "updated_at": inquiry.updated_at,
    }
