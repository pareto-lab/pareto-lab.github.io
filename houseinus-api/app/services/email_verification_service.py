"""Email verification by short numeric code.

Used by the email signup and password-reset flows.

Lifecycle:
    1. start_verification(email, purpose) → stash a 6-digit code in Redis,
       email it to the user.
    2. confirm_verification(email, code, purpose) → if code matches and isn't
       expired, mint a verification_token (also Redis) and return it. The code
       entry is deleted in both success and failure (after attempts exhaust).
    3. consume_verification_token(token, purpose) → atomic GETDEL; returns the
       email if the token is valid for the given purpose, else None.

Codes are 6 digits, hashed in Redis (sha256). Tokens are opaque random strings.
Max 5 attempts per code, then we evict it and the user must request a new one.
"""
from __future__ import annotations

import json
import logging
import secrets

from app.config import settings
from app.core.redis_client import get_redis
from app.core.security import generate_opaque_token, sha256_hex

log = logging.getLogger(__name__)

CODE_PREFIX = "email_verify_code:"
TOKEN_PREFIX = "email_verify_token:"
MAX_CODE_ATTEMPTS = 5

# Purposes a verification can be issued for. Tokens are bound to a single
# purpose so a signup code can't be used to reset a password and vice versa.
PURPOSES = frozenset({"signup", "reset"})


def _code_key(email: str, purpose: str) -> str:
    return f"{settings.redis.prefix}{CODE_PREFIX}{purpose}:{email.lower()}"


def _token_key(token: str) -> str:
    return f"{settings.redis.prefix}{TOKEN_PREFIX}{sha256_hex(token)}"


def _generate_code() -> str:
    # 6-digit code, leading-zero preserved. secrets.randbelow gives a uniform
    # distribution unlike random.randint.
    return f"{secrets.randbelow(1_000_000):06d}"


async def start_verification(email: str, purpose: str) -> str:
    """Generate a fresh code, stash it in Redis, return the raw code.

    Caller is responsible for emailing the returned code to the user. Any
    previous outstanding code for this (email, purpose) is overwritten.
    """
    if purpose not in PURPOSES:
        raise ValueError(f"Unknown verification purpose: {purpose}")

    code = _generate_code()
    payload = {"code_hash": sha256_hex(code), "attempts": 0}
    redis = get_redis()
    await redis.set(
        _code_key(email, purpose),
        json.dumps(payload),
        ex=settings.email.verification_code_lifetime_seconds,
    )
    return code


async def confirm_verification(email: str, code: str, purpose: str) -> str | None:
    """Validate `code` against the stashed entry.

    Returns a fresh `verification_token` on success, None otherwise.
    After MAX_CODE_ATTEMPTS wrong tries the entry is evicted so the user
    has to request a new code.
    """
    if purpose not in PURPOSES:
        return None

    redis = get_redis()
    key = _code_key(email, purpose)
    raw = await redis.get(key)
    if raw is None:
        return None

    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        await redis.delete(key)
        return None

    expected_hash = data.get("code_hash")
    attempts = int(data.get("attempts", 0))

    if expected_hash != sha256_hex(code):
        attempts += 1
        if attempts >= MAX_CODE_ATTEMPTS:
            await redis.delete(key)
        else:
            # Preserve original TTL so attackers can't extend the window.
            ttl = await redis.ttl(key)
            if ttl > 0:
                await redis.set(
                    key,
                    json.dumps({"code_hash": expected_hash, "attempts": attempts}),
                    ex=ttl,
                )
        return None

    # Code matched. Consume it and mint a verification token.
    await redis.delete(key)
    token = generate_opaque_token(32)
    await redis.set(
        _token_key(token),
        json.dumps({"email": email.lower(), "purpose": purpose}),
        ex=settings.email.verification_token_lifetime_seconds,
    )
    return token


async def consume_verification_token(token: str, purpose: str) -> str | None:
    """Atomically validate + delete a verification token. Returns the
    associated email on success."""
    if purpose not in PURPOSES:
        return None
    redis = get_redis()
    raw = await redis.getdel(_token_key(token))
    if raw is None:
        return None
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if data.get("purpose") != purpose:
        return None
    email = data.get("email")
    return email if isinstance(email, str) else None
