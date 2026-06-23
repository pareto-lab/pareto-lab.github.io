from __future__ import annotations

from types import SimpleNamespace

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.api.deps import CurrentAdmin, CurrentSession, DbSession
from app.core.errors import ApiException
from app.core.session import load_session, touch_session
from app.database import SessionFactory
from app.models.user import UserRole, role_at_least
from app.services import codex_bridge_service, user_service

router = APIRouter(prefix="/admin/agent", tags=["admin-agent"])


class CodexSessionRead(BaseModel):
    id: str
    user_id: str
    user_email: str
    conversation_id: str | None
    model: str | None
    rollout_path: str | None
    cwd: str
    agent_provider: str
    agent_home: str
    running: bool
    pending_approvals: list[dict] = Field(default_factory=list)


class CodexMessageRequest(BaseModel):
    text: str = Field(min_length=1)
    pathname: str | None = Field(default=None, max_length=500)


class ApprovalRequest(BaseModel):
    decision: str = Field(pattern="^(approved|approved_for_session|denied|abort)$")


def _agent_error(exc: codex_bridge_service.CodexBridgeError) -> ApiException:
    return ApiException(400, "agent-bridge-error", detail=str(exc))


@router.post("/sessions", response_model=CodexSessionRead)
async def create_or_get_session(
    admin: CurrentAdmin,
    session: CurrentSession,
) -> CodexSessionRead:
    try:
        codex_session = await codex_bridge_service.get_or_create_session(admin, session.sid)
    except codex_bridge_service.CodexBridgeError as exc:
        raise _agent_error(exc) from exc
    return CodexSessionRead(**codex_bridge_service.serialize_session(codex_session))


@router.get("/sessions/current", response_model=CodexSessionRead | None)
async def get_current_session(admin: CurrentAdmin) -> CodexSessionRead | None:
    codex_session = await codex_bridge_service.get_user_session(admin)
    if codex_session is None:
        return None
    return CodexSessionRead(**codex_bridge_service.serialize_session(codex_session))


@router.post("/sessions/current/messages")
async def send_message(admin: CurrentAdmin, payload: CodexMessageRequest) -> dict[str, bool]:
    codex_session = await codex_bridge_service.get_user_session(admin)
    if codex_session is None:
        raise ApiException(404, "agent-session-not-running")
    try:
        await codex_bridge_service.send_user_message(codex_session, payload.text, pathname=payload.pathname)
    except codex_bridge_service.CodexBridgeError as exc:
        raise _agent_error(exc) from exc
    return {"ok": True}


@router.post("/sessions/current/interrupt")
async def interrupt(admin: CurrentAdmin) -> dict:
    codex_session = await codex_bridge_service.get_user_session(admin)
    if codex_session is None:
        raise ApiException(404, "agent-session-not-running")
    try:
        return await codex_bridge_service.interrupt_session(codex_session)
    except codex_bridge_service.CodexBridgeError as exc:
        raise _agent_error(exc) from exc


@router.post("/sessions/current/approvals/{approval_id}")
async def resolve_approval(
    approval_id: str,
    payload: ApprovalRequest,
    admin: CurrentAdmin,
) -> dict[str, bool]:
    codex_session = await codex_bridge_service.get_user_session(admin)
    if codex_session is None:
        raise ApiException(404, "agent-session-not-running")
    try:
        await codex_bridge_service.resolve_approval(codex_session, approval_id, payload.decision)
    except codex_bridge_service.CodexBridgeError as exc:
        raise _agent_error(exc) from exc
    return {"ok": True}


@router.post("/sessions/current/stop")
async def stop(admin: CurrentAdmin) -> dict[str, bool]:
    codex_session = await codex_bridge_service.get_user_session(admin)
    if codex_session is not None:
        await codex_bridge_service.stop_session(codex_session)
    return {"ok": True}


@router.websocket("/sessions/current/events")
async def events(websocket: WebSocket) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    session_data = await load_session(token)
    if session_data is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await touch_session(token)

    # Do not keep a request-scoped DB session open for the lifetime of the
    # WebSocket. MCP tools call the same API server and need DB connections too.
    async with SessionFactory() as db:
        user = await user_service.get_user_by_id(db, session_data.user_id)
        if user is None or not user.is_active or not role_at_least(user.role, UserRole.admin):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = user.id

    user_session = SimpleNamespace(id=user_id)
    codex_session = await codex_bridge_service.get_user_session(user_session)
    if codex_session is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        queue = await codex_bridge_service.subscribe(codex_session)
    except codex_bridge_service.CodexBridgeError:
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    await websocket.accept()
    try:
        await websocket.send_json(
            {
                "type": "session",
                "session": codex_bridge_service.serialize_session(codex_session),
            }
        )
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if event.get("type") == "closed":
                break
    except WebSocketDisconnect:
        pass
    finally:
        codex_bridge_service.unsubscribe(codex_session, queue)
