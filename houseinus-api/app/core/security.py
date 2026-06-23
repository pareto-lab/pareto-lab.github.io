from __future__ import annotations

import hashlib
import secrets

import bcrypt


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def generate_opaque_token(n_bytes: int = 32) -> str:
    """URL-safe random token. Use for session IDs, OAuth state, email tokens."""
    return secrets.token_urlsafe(n_bytes)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
