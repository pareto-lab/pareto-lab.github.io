from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    """Registration is gated by a verification_token from the email-verify
    flow — the email field is read from the token, not the request body."""

    verification_token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)
    terms_version: str = Field(min_length=1, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetWithCodeRequest(BaseModel):
    verification_token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class EmailCheckRequest(BaseModel):
    email: EmailStr


class EmailCheckResponse(BaseModel):
    exists: bool
    # Whether the account has a password set. False = OAuth-only account, so
    # the frontend can prompt the user to use the matching social button.
    has_password: bool


class EmailVerifyStartRequest(BaseModel):
    email: EmailStr
    purpose: Literal["signup", "reset"]


class EmailVerifyConfirmRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=10)
    purpose: Literal["signup", "reset"]


class EmailVerifyConfirmResponse(BaseModel):
    verification_token: str


class OAuthAccountSummary(BaseModel):
    provider: Literal["google", "naver", "kakao"]
    email: str | None
    linked_at: str  # ISO timestamp


class TokenResponse(BaseModel):
    """OAuth2 password flow compliant response (used by Swagger Authorize)."""

    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    """JSON login/register response — token + user payload."""

    access_token: str
    token_type: str = "bearer"
    user: UserRead


class MessageResponse(BaseModel):
    message: str


class OAuthAuthorizeResponse(BaseModel):
    authorization_url: str
    state: str


class OAuthConsentRequest(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    terms_version: str = Field(min_length=1, max_length=50)
