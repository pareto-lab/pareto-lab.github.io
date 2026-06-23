from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentSession, CurrentUser, DbSession
from app.config import settings
from app.core.errors import ApiException
from app.core.security import hash_password
from app.core.session import (
    SessionData,
    create_session,
    destroy_all_user_sessions,
    destroy_session,
)
from app.schemas.auth import (
    AuthResponse,
    EmailCheckRequest,
    EmailCheckResponse,
    EmailVerifyConfirmRequest,
    EmailVerifyConfirmResponse,
    EmailVerifyStartRequest,
    LoginRequest,
    MessageResponse,
    OAuthAccountSummary,
    PasswordChangeRequest,
    PasswordResetWithCodeRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserRead
from app.services import email_service, email_verification_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)


async def _create_bearer_session(
    user_id, request: Request
) -> SessionData:
    return await create_session(
        user_id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: DbSession,
) -> AuthResponse:
    # The email comes from the verification token, not the request body —
    # so we can trust it as verified.
    email = await email_verification_service.consume_verification_token(
        payload.verification_token, purpose="signup"
    )
    if email is None:
        raise ApiException(400, "verification-token-invalid")

    existing = await user_service.get_user_by_email(db, email)
    if existing is not None:
        raise ApiException(409, "email-already-registered")

    user = await user_service.create_user_with_password(
        db,
        email=email,
        password=payload.password,
        display_name=payload.display_name,
        terms_version=payload.terms_version,
    )
    # Coming through email verification implies the address is reachable —
    # mark it verified so we don't ask again.
    from app.utils.time import utcnow

    user.email_verified_at = utcnow()
    await user_service.mark_logged_in(db, user)
    await db.commit()
    await db.refresh(user)

    session = await _create_bearer_session(user.id, request)
    return AuthResponse(
        access_token=session.sid,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: DbSession,
) -> AuthResponse:
    user = await user_service.authenticate_with_password(
        db, email=payload.email, password=payload.password
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )
    await user_service.mark_logged_in(db, user)
    await db.commit()
    await db.refresh(user)

    session = await _create_bearer_session(user.id, request)
    return AuthResponse(
        access_token=session.sid,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="OAuth2 password flow — used by Swagger UI Authorize button",
)
async def token(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    request: Request,
    db: DbSession,
) -> TokenResponse:
    # OAuth2 spec names the field `username`; we treat it as the user's email.
    user = await user_service.authenticate_with_password(
        db, email=form.username, password=form.password
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await user_service.mark_logged_in(db, user)
    await db.commit()

    session = await _create_bearer_session(user.id, request)
    return TokenResponse(access_token=session.sid, token_type="bearer")


@router.post("/logout", response_model=MessageResponse)
async def logout(session: CurrentSession) -> MessageResponse:
    await destroy_session(session.sid)
    return MessageResponse(message="logged out")


@router.get("/me", response_model=UserRead)
async def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.get("/me/oauth-accounts", response_model=list[OAuthAccountSummary])
async def list_my_oauth_accounts(
    user: CurrentUser,
    db: DbSession,
) -> list[OAuthAccountSummary]:
    """List OAuth providers linked to the current user."""
    from sqlalchemy import select

    from app.models import OAuthAccount

    result = await db.execute(
        select(OAuthAccount)
        .where(OAuthAccount.user_id == user.id)
        .order_by(OAuthAccount.created_at)
    )
    rows = result.scalars().all()
    return [
        OAuthAccountSummary(
            provider=row.provider.value,
            email=row.email,
            linked_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.post("/password", response_model=MessageResponse)
async def change_password(
    payload: PasswordChangeRequest,
    user: CurrentUser,
    db: DbSession,
) -> MessageResponse:
    from app.core.security import verify_password

    if user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Set a password first (OAuth-only account)",
        )
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect"
        )
    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    # Force re-login on all other devices.
    await destroy_all_user_sessions(user.id)
    return MessageResponse(message="password changed")


# ---------------------------------------------------------------------------
# Email verification flow (signup + password reset)
# ---------------------------------------------------------------------------

@router.post("/email/check", response_model=EmailCheckResponse)
async def email_check(
    payload: EmailCheckRequest,
    db: DbSession,
) -> EmailCheckResponse:
    """Lookup whether an email is registered, and whether it has a password.

    Frontend uses this to branch between password-login and email-verify-signup.
    has_password=False means the account exists but was created via OAuth only —
    the user should use the matching social button (or set a password via the
    reset flow first).
    """
    user = await user_service.get_user_by_email(db, payload.email)
    if user is None or not user.is_active:
        return EmailCheckResponse(exists=False, has_password=False)
    return EmailCheckResponse(exists=True, has_password=user.has_password)


@router.post("/email/verify/start", response_model=MessageResponse)
async def email_verify_start(
    payload: EmailVerifyStartRequest,
    db: DbSession,
) -> MessageResponse:
    """Issue a 6-digit code to the email for the given purpose.

    - purpose=signup: refuses if the email is already registered.
    - purpose=reset:  returns a generic OK (and skips sending) if the email
      isn't registered, to avoid leaking account existence.
    """
    generic_ok = MessageResponse(message="인증번호를 발송했습니다.")
    user = await user_service.get_user_by_email(db, payload.email)

    if payload.purpose == "signup":
        if user is not None:
            raise ApiException(409, "email-already-registered")
    else:  # reset
        if user is None or not user.is_active or not user.has_password:
            return generic_ok

    code = await email_verification_service.start_verification(
        payload.email, payload.purpose
    )

    if not settings.email.enabled:
        log.warning(
            "[DEV] SMTP not configured — verification code for %s: %s",
            payload.email,
            code,
        )
        return generic_ok

    lifetime_minutes = max(
        1, settings.email.verification_code_lifetime_seconds // 60
    )
    try:
        await email_service.send_verification_code_email(
            to=payload.email,
            code=code,
            purpose=payload.purpose,
            lifetime_minutes=lifetime_minutes,
        )
    except email_service.EmailNotConfigured:
        raise ApiException(503, "email-service-unavailable") from None
    except Exception as exc:  # noqa: BLE001
        log.exception("failed to send verification email to %s: %s", payload.email, exc)
        raise ApiException(500, "email-send-failed") from None
    return generic_ok


@router.post("/email/verify/confirm", response_model=EmailVerifyConfirmResponse)
async def email_verify_confirm(
    payload: EmailVerifyConfirmRequest,
) -> EmailVerifyConfirmResponse:
    token = await email_verification_service.confirm_verification(
        payload.email, payload.code, payload.purpose
    )
    if token is None:
        raise ApiException(400, "verification-code-invalid")
    return EmailVerifyConfirmResponse(verification_token=token)


@router.post("/password/reset", response_model=MessageResponse)
async def reset_password(
    payload: PasswordResetWithCodeRequest,
    db: DbSession,
) -> MessageResponse:
    email = await email_verification_service.consume_verification_token(
        payload.verification_token, purpose="reset"
    )
    if email is None:
        raise ApiException(400, "verification-token-invalid")

    user = await user_service.get_user_by_email(db, email)
    if user is None or not user.is_active:
        raise ApiException(404, "user-not-found")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()
    # Invalidate every existing session — the user must re-login with the new password.
    await destroy_all_user_sessions(user.id)
    return MessageResponse(message="비밀번호가 변경되었습니다. 다시 로그인해주세요.")
