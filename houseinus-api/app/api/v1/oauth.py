from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse

from app.api.deps import DbSession
from app.core.session import create_session
from app.models import OAuthProvider
from app.schemas.auth import (
    AuthResponse,
    OAuthAuthorizeResponse,
    OAuthConsentRequest,
)
from app.schemas.user import UserRead
from app.services import (
    oauth_service,
    pending_oauth_signup_service,
    user_service,
)
from app.services.pending_oauth_signup_service import PendingOAuthSignup

router = APIRouter(prefix="/auth/oauth", tags=["oauth"])


def _parse_provider(provider: str) -> OAuthProvider:
    try:
        return OAuthProvider(provider)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown provider: {provider}"
        ) from None


def _safe_redirect_target(value: str | None) -> str:
    """Restrict redirect targets to in-app paths.

    Open-redirect protection: anything not starting with "/" or starting with
    "//" (protocol-relative) is dropped back to "/".
    """
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value


@router.get(
    "/{provider}/authorize",
    response_model=OAuthAuthorizeResponse,
    summary="Get authorization URL for an OAuth provider",
)
async def oauth_authorize(
    provider: str,
    redirect_to: str | None = Query(default=None),
) -> OAuthAuthorizeResponse:
    prov = _parse_provider(provider)
    safe_redirect = _safe_redirect_target(redirect_to)
    # Only persist redirect_to if the frontend actually asked for one and it
    # passed the safety check — avoids storing a meaningless "/" everywhere.
    stash = safe_redirect if safe_redirect != "/" else None
    url, state = await oauth_service.create_authorize_url(prov, redirect_to=stash)
    return OAuthAuthorizeResponse(authorization_url=url, state=state)


@router.get(
    "/{provider}/callback",
    summary="Handle OAuth callback, create session, redirect with token in fragment",
)
async def oauth_callback(
    provider: str,
    request: Request,
    db: DbSession,
    code: str = Query(...),
    state: str = Query(...),
) -> RedirectResponse:
    prov = _parse_provider(provider)
    stashed_redirect = await oauth_service.consume_state(state, prov)

    token_resp = await oauth_service.exchange_code(prov, code)
    provider_access_token = token_resp.get("access_token")
    provider_refresh_token = token_resp.get("refresh_token")
    if not provider_access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No access token from provider"
        )

    profile = await oauth_service.fetch_profile(prov, provider_access_token)
    safe_redirect = _safe_redirect_target(stashed_redirect)

    # If this OAuth identity (or its email) already maps to a user, log them
    # in. Otherwise this is a first-time signup — stash the profile and bounce
    # to the consent page so we never persist a User without explicit terms
    # agreement.
    user = await user_service.link_existing_oauth_or_email(
        db,
        provider=prov,
        provider_user_id=profile.provider_user_id,
        email=profile.email,
        raw_profile=profile.raw,
        access_token=provider_access_token,
        refresh_token=provider_refresh_token,
    )

    if user is None:
        await db.commit()
        signup_token = await pending_oauth_signup_service.stash(
            PendingOAuthSignup(
                provider=prov,
                provider_user_id=profile.provider_user_id,
                email=profile.email,
                display_name=profile.display_name,
                profile_image_url=profile.profile_image_url,
                raw_profile=profile.raw,
                access_token=provider_access_token,
                refresh_token=provider_refresh_token,
                redirect_to=safe_redirect if safe_redirect != "/" else None,
            )
        )
        consent_url = f"/oauth-consent?token={quote(signup_token, safe='')}"
        return RedirectResponse(url=consent_url, status_code=status.HTTP_302_FOUND)

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive"
        )
    await user_service.mark_logged_in(db, user)
    await db.commit()

    session = await create_session(
        user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Redirect back to the web app with the token in the URL fragment so it's
    # not sent to the server or logged. Frontend JS reads `location.hash` and
    # pulls both the access token and the optional redirect_to out of it.
    target = "/"
    fragment_parts = [
        f"access_token={quote(session.sid, safe='')}",
        "token_type=bearer",
    ]
    if safe_redirect != "/":
        fragment_parts.append(f"redirect_to={quote(safe_redirect, safe='/?&=')}")
    redirect_url = f"{target}#{'&'.join(fragment_parts)}"
    return RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)


@router.post(
    "/consent",
    response_model=AuthResponse,
    summary="Complete a first-time OAuth signup after terms agreement",
)
async def oauth_consent(
    payload: OAuthConsentRequest,
    request: Request,
    db: DbSession,
) -> AuthResponse:
    signup = await pending_oauth_signup_service.consume(payload.token)
    if signup is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup token is invalid or expired",
        )

    # A racing /callback may have created the user under the same identity
    # between stash and consent — re-check before creating.
    existing = await user_service.link_existing_oauth_or_email(
        db,
        provider=signup.provider,
        provider_user_id=signup.provider_user_id,
        email=signup.email,
        raw_profile=signup.raw_profile,
        access_token=signup.access_token,
        refresh_token=signup.refresh_token,
    )
    if existing is not None:
        user = existing
    else:
        user = await user_service.create_user_from_oauth(
            db,
            provider=signup.provider,
            provider_user_id=signup.provider_user_id,
            email=signup.email,
            display_name=signup.display_name,
            profile_image_url=signup.profile_image_url,
            raw_profile=signup.raw_profile,
            access_token=signup.access_token,
            refresh_token=signup.refresh_token,
            terms_version=payload.terms_version,
        )

    await user_service.mark_logged_in(db, user)
    await db.commit()
    await db.refresh(user)

    session = await create_session(
        user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return AuthResponse(
        access_token=session.sid,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )
