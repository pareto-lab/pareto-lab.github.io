from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models import OAuthAccount, OAuthProvider, User, UserAdmin, UserStatus
from app.utils.time import utcnow


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def create_user_with_password(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    display_name: str,
    terms_version: str,
) -> User:
    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        display_name=display_name,
        status=UserStatus.active,
        terms_agreed_at=utcnow(),
        terms_version=terms_version,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_with_password(
    db: AsyncSession, *, email: str, password: str
) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None or not user.is_active or user.password_hash is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def mark_logged_in(db: AsyncSession, user: User) -> None:
    user.last_login_at = utcnow()
    await db.flush()


async def get_oauth_account(
    db: AsyncSession, provider: OAuthProvider, provider_user_id: str
) -> OAuthAccount | None:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
    )
    return result.scalar_one_or_none()


async def link_existing_oauth_or_email(
    db: AsyncSession,
    *,
    provider: OAuthProvider,
    provider_user_id: str,
    email: str | None,
    raw_profile: dict[str, Any],
    access_token: str | None = None,
    refresh_token: str | None = None,
) -> User | None:
    """Return the user for an OAuth login when one already exists.

    Two paths qualify as "already exists":
    - A matching OAuthAccount → refresh its tokens/profile and return its user.
    - No OAuthAccount yet but a User with the same email → create the
      OAuthAccount linking the two, return the user.

    Returns None when neither path matches — caller must treat this as a
    first-time signup and gate on terms-of-service agreement before creating
    a User row.
    """
    existing = await get_oauth_account(db, provider, provider_user_id)
    if existing is not None:
        existing.email = email
        existing.access_token = access_token
        existing.refresh_token = refresh_token
        existing.raw_profile = raw_profile
        await db.flush()
        # Don't touch `existing.user` — that's a lazy relationship and would
        # trigger MissingGreenlet under AsyncSession. Fetch the row explicitly.
        linked_user = await get_user_by_id(db, existing.user_id)
        if linked_user is None:
            raise RuntimeError(
                f"OAuth account {existing.id} references missing user {existing.user_id}"
            )
        return linked_user

    if email:
        user = await get_user_by_email(db, email)
        if user is not None:
            # Same email → assume the same human. Existing user already agreed
            # to terms at their own signup, so no extra gating needed.
            account = OAuthAccount(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                access_token=access_token,
                refresh_token=refresh_token,
                raw_profile=raw_profile,
            )
            db.add(account)
            await db.flush()
            return user

    return None


async def create_user_from_oauth(
    db: AsyncSession,
    *,
    provider: OAuthProvider,
    provider_user_id: str,
    email: str | None,
    display_name: str | None,
    profile_image_url: str | None,
    raw_profile: dict[str, Any],
    access_token: str | None,
    refresh_token: str | None,
    terms_version: str,
) -> User:
    """Create a fresh user from an OAuth signup with terms agreement recorded.

    Only call after the user has explicitly consented to the terms — this is
    the function the /auth/oauth/consent endpoint uses to finalize signup.
    """
    now = utcnow()
    user = User(
        email=(email or f"{provider.value}_{provider_user_id}@placeholder.local").lower(),
        display_name=display_name or (email.split("@")[0] if email else provider.value),
        profile_image_url=profile_image_url,
        status=UserStatus.active,
        # OAuth-only users verify through the provider itself.
        email_verified_at=now if email else None,
        terms_agreed_at=now,
        terms_version=terms_version,
    )
    db.add(user)
    await db.flush()

    account = OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
        access_token=access_token,
        refresh_token=refresh_token,
        raw_profile=raw_profile,
    )
    db.add(account)
    await db.flush()
    return user


# ----------------------------------------------------------------------------
# Admin operations
# ----------------------------------------------------------------------------
async def search_users(
    db: AsyncSession,
    *,
    query: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[User], int]:
    """Return (items, total) for admin user listing. Search matches email and display_name."""
    base = select(User).order_by(User.created_at.desc())
    count_stmt = select(func.count()).select_from(User)
    if query:
        like = f"%{query.lower()}%"
        cond = or_(
            func.lower(User.email).like(like),
            func.lower(User.display_name).like(like),
        )
        base = base.where(cond)
        count_stmt = count_stmt.where(cond)

    total = (await db.execute(count_stmt)).scalar_one()
    items = (await db.execute(base.offset(skip).limit(limit))).scalars().all()
    return list(items), int(total)


async def ban_user(
    db: AsyncSession,
    *,
    target: User,
    actor: User,
    reason: str | None = None,
) -> User:
    target.banned_at = utcnow()
    target.ban_reason = reason
    target.banned_by_id = actor.id
    await db.flush()
    return target


async def unban_user(db: AsyncSession, *, target: User) -> User:
    target.banned_at = None
    target.ban_reason = None
    target.banned_by_id = None
    await db.flush()
    return target


async def get_admin_profile(db: AsyncSession, user_id: uuid.UUID) -> UserAdmin | None:
    return await db.get(UserAdmin, user_id)


async def ensure_admin_profile(db: AsyncSession, *, user: User) -> UserAdmin:
    """Return the user's UserAdmin row, creating one with defaults if missing.

    Call this when granting admin/owner role (CLI creation, role promotion).
    Demotion intentionally does not remove the row — settings are preserved
    so re-promotion restores the prior preferences.
    """
    existing = await db.get(UserAdmin, user.id)
    if existing is not None:
        return existing
    profile = UserAdmin(user_id=user.id)
    db.add(profile)
    await db.flush()
    return profile
