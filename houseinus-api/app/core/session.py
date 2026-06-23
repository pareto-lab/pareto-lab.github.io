from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime

from app.config import settings
from app.core.redis_client import get_redis
from app.core.security import generate_opaque_token
from app.utils.time import utcnow

SESSION_KEY_PREFIX = "session:"
USER_SESSIONS_KEY_PREFIX = "user_sessions:"


def _session_key(sid: str) -> str:
    return f"{settings.redis.prefix}{SESSION_KEY_PREFIX}{sid}"


def _user_sessions_key(user_id: uuid.UUID) -> str:
    return f"{settings.redis.prefix}{USER_SESSIONS_KEY_PREFIX}{user_id}"


@dataclass
class SessionData:
    sid: str
    user_id: uuid.UUID
    created_at: datetime
    ip: str | None = None
    user_agent: str | None = None

    def to_redis(self) -> str:
        return json.dumps(
            {
                "user_id": str(self.user_id),
                "created_at": self.created_at.isoformat(),
                "ip": self.ip,
                "user_agent": self.user_agent,
            }
        )

    @classmethod
    def from_redis(cls, sid: str, raw: str) -> SessionData:
        data = json.loads(raw)
        return cls(
            sid=sid,
            user_id=uuid.UUID(data["user_id"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            ip=data.get("ip"),
            user_agent=data.get("user_agent"),
        )


async def create_session(
    user_id: uuid.UUID,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> SessionData:
    sid = generate_opaque_token(32)
    session = SessionData(
        sid=sid,
        user_id=user_id,
        created_at=utcnow(),
        ip=ip,
        user_agent=user_agent,
    )
    redis = get_redis()
    ttl = settings.session_lifetime_seconds
    await redis.set(_session_key(sid), session.to_redis(), ex=ttl)
    # Track sessions per user so we can revoke them all on password change.
    await redis.sadd(_user_sessions_key(user_id), sid)
    await redis.expire(_user_sessions_key(user_id), ttl)
    return session


async def load_session(sid: str) -> SessionData | None:
    redis = get_redis()
    raw = await redis.get(_session_key(sid))
    if raw is None:
        return None
    return SessionData.from_redis(sid, raw)


async def touch_session(sid: str) -> None:
    """Extend session TTL (sliding window)."""
    redis = get_redis()
    await redis.expire(_session_key(sid), settings.session_lifetime_seconds)


async def destroy_session(sid: str) -> None:
    redis = get_redis()
    raw = await redis.get(_session_key(sid))
    if raw:
        data = json.loads(raw)
        user_id = data["user_id"]
        await redis.srem(_user_sessions_key(uuid.UUID(user_id)), sid)
    await redis.delete(_session_key(sid))


async def destroy_all_user_sessions(user_id: uuid.UUID) -> int:
    redis = get_redis()
    key = _user_sessions_key(user_id)
    sids = await redis.smembers(key)
    if not sids:
        return 0
    pipe = redis.pipeline()
    for sid in sids:
        pipe.delete(_session_key(sid))
    pipe.delete(key)
    await pipe.execute()
    return len(sids)
