"""Pending OAuth signup stash.

When a first-time OAuth user completes the provider handshake, we don't want
to create their User row until they explicitly agree to the terms. To avoid
losing the profile/tokens we already fetched, we stash them in Redis under a
short-lived opaque token and redirect the browser to the consent page with
that token. The consent endpoint then atomically consumes the stash and
creates the user with terms recorded.

Lifecycle mirrors oauth_state / email_verification: single-use opaque token,
TTL-bound payload, GETDEL on consume.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.core.redis_client import get_redis
from app.core.security import generate_opaque_token, sha256_hex
from app.models import OAuthProvider

STASH_PREFIX = "pending_oauth_signup:"
STASH_TTL_SECONDS = 15 * 60  # 15 minutes — generous for terms reading


def _stash_key(token: str) -> str:
    return f"{settings.redis.prefix}{STASH_PREFIX}{sha256_hex(token)}"


@dataclass
class PendingOAuthSignup:
    provider: OAuthProvider
    provider_user_id: str
    email: str | None
    display_name: str | None
    profile_image_url: str | None
    raw_profile: dict[str, Any]
    access_token: str | None
    refresh_token: str | None
    redirect_to: str | None


async def stash(signup: PendingOAuthSignup) -> str:
    """Persist a pending signup in Redis and return the opaque token the
    caller should expose to the browser (URL fragment / query param)."""
    token = generate_opaque_token(32)
    payload = {
        "provider": signup.provider.value,
        "provider_user_id": signup.provider_user_id,
        "email": signup.email,
        "display_name": signup.display_name,
        "profile_image_url": signup.profile_image_url,
        "raw_profile": signup.raw_profile,
        "access_token": signup.access_token,
        "refresh_token": signup.refresh_token,
        "redirect_to": signup.redirect_to,
    }
    redis = get_redis()
    await redis.set(_stash_key(token), json.dumps(payload), ex=STASH_TTL_SECONDS)
    return token


async def consume(token: str) -> PendingOAuthSignup | None:
    """Atomically fetch + delete the stash. Returns None if the token is
    unknown, expired, or already consumed."""
    redis = get_redis()
    raw = await redis.getdel(_stash_key(token))
    if raw is None:
        return None
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    try:
        provider = OAuthProvider(data["provider"])
    except (KeyError, ValueError):
        return None
    return PendingOAuthSignup(
        provider=provider,
        provider_user_id=str(data.get("provider_user_id") or ""),
        email=data.get("email"),
        display_name=data.get("display_name"),
        profile_image_url=data.get("profile_image_url"),
        raw_profile=data.get("raw_profile") or {},
        access_token=data.get("access_token"),
        refresh_token=data.get("refresh_token"),
        redirect_to=data.get("redirect_to"),
    )
