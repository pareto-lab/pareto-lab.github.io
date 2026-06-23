from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MbtiResult
from app.schemas.mbti import MbtiResultCreate


async def create_result(
    db: AsyncSession,
    payload: MbtiResultCreate,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> MbtiResult:
    result = MbtiResult(
        participant_id=payload.participant_id,
        email=str(payload.email) if payload.email else None,
        email_consent=payload.email_consent,
        age=payload.age,
        gender=payload.gender,
        family_type=payload.family_type,
        driving=payload.driving,
        plants=payload.plants,
        pets=payload.pets,
        camping=payload.camping,
        hobbies=payload.hobbies,
        dreams=payload.dreams,
        source=payload.source,
        source_url=payload.source_url,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(result)
    await db.flush()
    return result


async def list_results(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[MbtiResult], int]:
    stmt = select(MbtiResult).order_by(MbtiResult.created_at.desc())
    count_stmt = select(func.count()).select_from(MbtiResult)
    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(stmt.offset(skip).limit(limit))).scalars().all()
    return list(items), int(total)
