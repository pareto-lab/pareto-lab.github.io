from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from app.config import OAuthProviderConfig, settings
from app.core.redis_client import get_redis
from app.core.security import generate_opaque_token
from app.models import OAuthProvider

OAUTH_STATE_TTL = 600  # 10 minutes
OAUTH_STATE_PREFIX = "oauth_state:"


def _oauth_state_key(state: str) -> str:
    return f"{settings.redis.prefix}{OAUTH_STATE_PREFIX}{state}"


@dataclass
class OAuthProfile:
    provider_user_id: str
    email: str | None
    display_name: str | None
    profile_image_url: str | None
    raw: dict[str, Any]


def _provider_config(provider: OAuthProvider) -> OAuthProviderConfig:
    cfg: OAuthProviderConfig = getattr(settings.oauth, provider.value)
    if not cfg.enabled or not cfg.client_id or not cfg.client_secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{provider.value} OAuth is not configured",
        )
    return cfg


def _auth_endpoint(provider: OAuthProvider) -> tuple[str, list[str]]:
    # (authorize_url, scopes)
    if provider == OAuthProvider.google:
        return (
            "https://accounts.google.com/o/oauth2/v2/auth",
            ["openid", "email", "profile"],
        )
    if provider == OAuthProvider.naver:
        return ("https://nid.naver.com/oauth2.0/authorize", [])
    if provider == OAuthProvider.kakao:
        return ("https://kauth.kakao.com/oauth/authorize", ["account_email", "profile_nickname"])
    raise ValueError(provider)


def _token_endpoint(provider: OAuthProvider) -> str:
    if provider == OAuthProvider.google:
        return "https://oauth2.googleapis.com/token"
    if provider == OAuthProvider.naver:
        return "https://nid.naver.com/oauth2.0/token"
    if provider == OAuthProvider.kakao:
        return "https://kauth.kakao.com/oauth/token"
    raise ValueError(provider)


def _userinfo_endpoint(provider: OAuthProvider) -> str:
    if provider == OAuthProvider.google:
        return "https://openidconnect.googleapis.com/v1/userinfo"
    if provider == OAuthProvider.naver:
        return "https://openapi.naver.com/v1/nid/me"
    if provider == OAuthProvider.kakao:
        return "https://kapi.kakao.com/v2/user/me"
    raise ValueError(provider)


async def create_authorize_url(
    provider: OAuthProvider, *, redirect_to: str | None = None
) -> tuple[str, str]:
    cfg = _provider_config(provider)
    auth_url, scopes = _auth_endpoint(provider)
    state = generate_opaque_token(24)

    # Stash state in Redis so the callback can verify it's ours and not
    # replayed. ``redirect_to`` rides along on the state because OAuth providers
    # don't forward arbitrary query params to redirect_uri — the only thing
    # they round-trip is ``state``.
    payload: dict[str, object] = {"provider": provider.value}
    if redirect_to:
        payload["redirect_to"] = redirect_to
    redis = get_redis()
    await redis.set(
        _oauth_state_key(state),
        json.dumps(payload),
        ex=OAUTH_STATE_TTL,
    )

    params = {
        "response_type": "code",
        "client_id": cfg.client_id,
        "redirect_uri": cfg.redirect_uri,
        "state": state,
    }
    if scopes:
        params["scope"] = " ".join(scopes)
    return f"{auth_url}?{urlencode(params)}", state


async def consume_state(state: str, expected_provider: OAuthProvider) -> str | None:
    """Validate + delete the state entry. Returns the original ``redirect_to``
    (if any) the frontend passed at /authorize time, so the callback can
    bounce the user back there."""
    redis = get_redis()
    key = _oauth_state_key(state)
    raw = await redis.get(key)
    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired state"
        )
    await redis.delete(key)
    data = json.loads(raw)
    if data.get("provider") != expected_provider.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="State/provider mismatch"
        )
    redirect_to = data.get("redirect_to")
    return redirect_to if isinstance(redirect_to, str) else None


async def exchange_code(provider: OAuthProvider, code: str) -> dict[str, Any]:
    cfg = _provider_config(provider)
    token_url = _token_endpoint(provider)
    data = {
        "grant_type": "authorization_code",
        "client_id": cfg.client_id,
        "client_secret": cfg.client_secret,
        "redirect_uri": cfg.redirect_uri,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(token_url, data=data)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Token exchange failed: {resp.text}",
            )
        return resp.json()


async def fetch_profile(provider: OAuthProvider, access_token: str) -> OAuthProfile:
    url = _userinfo_endpoint(provider)
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Profile fetch failed: {resp.text}",
            )
        raw = resp.json()

    if provider == OAuthProvider.google:
        return OAuthProfile(
            provider_user_id=str(raw["sub"]),
            email=raw.get("email"),
            display_name=raw.get("name"),
            profile_image_url=raw.get("picture"),
            raw=raw,
        )
    if provider == OAuthProvider.naver:
        # Naver wraps the payload: {"resultcode": "00", "message": "success", "response": {...}}
        resp_data = raw.get("response", {})
        return OAuthProfile(
            provider_user_id=str(resp_data["id"]),
            email=resp_data.get("email"),
            display_name=resp_data.get("name") or resp_data.get("nickname"),
            profile_image_url=resp_data.get("profile_image"),
            raw=raw,
        )
    if provider == OAuthProvider.kakao:
        account = raw.get("kakao_account", {}) or {}
        profile = account.get("profile", {}) or {}
        return OAuthProfile(
            provider_user_id=str(raw["id"]),
            email=account.get("email"),
            display_name=profile.get("nickname"),
            profile_image_url=profile.get("profile_image_url"),
            raw=raw,
        )
    raise ValueError(provider)
