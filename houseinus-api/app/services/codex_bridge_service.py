from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import re
import shutil
import sys
import uuid
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.config import PROJECT_ROOT, settings
from app.core.redis_client import get_redis
from app.models import User

log = logging.getLogger(__name__)

AGENTS_SOURCE = PROJECT_ROOT / "agent" / "AGENTS.md"
AGENTS_DEST_NAME = "AGENTS.md"
MAX_BUFFERED_EVENTS = 300

# Redis key suffixes (combined with settings.redis.prefix).
BRIDGE_KEY_PREFIX = "agent:bridge:user:"      # written/refreshed by the bridge daemon
SESSION_KEY_PREFIX = "agent:session:user:"    # written by FastAPI workers

# Time to wait for the bridge to publish its "listening" port before giving up.
BRIDGE_SPAWN_TIMEOUT = 15.0


class CodexBridgeError(RuntimeError):
    pass


# We retain subprocess handles + monitor tasks here so the bridge processes
# don't get garbage-collected (which would close their stdio pipes and trigger
# unintended teardown). The bridge daemons themselves are detached
# (`start_new_session=True`) and will outlive a worker restart, but as long as
# this worker stays alive we want to keep their pipes drained.
_bridge_procs: dict[uuid.UUID, asyncio.subprocess.Process] = {}
_bridge_monitor_tasks: set[asyncio.Task[None]] = set()


# ---------------------------------------------------------------------------
# Public session shape
# ---------------------------------------------------------------------------


@dataclass
class CodexSession:
    """Logical handle held by callers. State of record lives in Redis;
    this dataclass is a snapshot built from the Redis blob."""

    id: str
    user_id: uuid.UUID
    user_email: str
    agent_home: Path
    cwd: Path
    bridge_host: str
    bridge_port: int
    created_at: float
    conversation_id: str | None = None
    active_turn_id: str | None = None
    model: str | None = None
    rollout_path: str | None = None
    pending_approvals: dict[str, dict[str, Any]] = field(default_factory=dict)

    @property
    def running(self) -> bool:
        # Caller can verify liveness by calling get_user_session() again, which
        # consults Redis. We optimistically return True so existing serialization
        # stays sensible.
        return True


# ---------------------------------------------------------------------------
# Worker-local TCP connections
# ---------------------------------------------------------------------------


@dataclass
class _Connection:
    user_id: uuid.UUID
    host: str
    port: int
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    reader_task: asyncio.Task[None] | None = None
    pending: dict[str, asyncio.Future[dict[str, Any]]] = field(default_factory=dict)
    subscribers: set[asyncio.Queue[dict[str, Any]]] = field(default_factory=set)
    event_buffer: deque[dict[str, Any]] = field(
        default_factory=lambda: deque(maxlen=MAX_BUFFERED_EVENTS)
    )
    write_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    closed: bool = False


_connections: dict[uuid.UUID, _Connection] = {}
_connections_lock = asyncio.Lock()
_spawn_locks: dict[uuid.UUID, asyncio.Lock] = {}


def _spawn_lock_for(user_id: uuid.UUID) -> asyncio.Lock:
    lock = _spawn_locks.get(user_id)
    if lock is None:
        lock = asyncio.Lock()
        _spawn_locks[user_id] = lock
    return lock


# ---------------------------------------------------------------------------
# Filesystem & codex-home setup (unchanged from previous in-process bridge)
# ---------------------------------------------------------------------------


def _harness_base() -> Path:
    return settings.harness.resolve_base_path(PROJECT_ROOT)


def _safe_mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _copy_agent_instructions(cwd: Path) -> None:
    if not AGENTS_SOURCE.exists():
        raise CodexBridgeError(f"Missing agent instructions: {AGENTS_SOURCE}")
    shutil.copyfile(AGENTS_SOURCE, cwd / AGENTS_DEST_NAME)


def _link_uploads_into_cwd(cwd: Path) -> None:
    """Expose the uploads directory inside the codex cwd as a symlink so the
    agent can read property images from the filesystem.

    The symlink target is outside the workspace, so Codex's ``workspace-write``
    sandbox blocks writes through it on macOS/Linux — the agent gets read-only
    access while the API server (unsandboxed) keeps full read/write.
    """
    uploads_root = settings.storage.resolve_base_path(PROJECT_ROOT).resolve()
    link_path = cwd / "uploads"
    if link_path.is_symlink():
        try:
            current = link_path.resolve(strict=False)
        except OSError:
            current = None
        if current == uploads_root:
            return
        link_path.unlink()
    elif link_path.exists():
        raise CodexBridgeError(
            f"Cannot create uploads symlink: {link_path} already exists as a non-symlink"
        )
    if not uploads_root.exists():
        uploads_root.mkdir(parents=True, exist_ok=True)
    link_path.symlink_to(uploads_root, target_is_directory=True)


def _seed_codex_home(codex_home: Path) -> None:
    source_path = _source_codex_home()
    if not source_path.exists():
        return
    for filename in ("auth.json", "credentials.json"):
        src = source_path / filename
        dest = codex_home / filename
        if src.exists() and not dest.exists():
            shutil.copyfile(src, dest)


def _source_codex_home() -> Path:
    source = settings.harness.seed_codex_home
    return Path(source).expanduser() if source else Path.home() / ".codex"


def _read_seed_top_level_codex_config() -> dict[str, str]:
    config_path = _source_codex_home() / "config.toml"
    if not config_path.exists():
        return {}
    copied: dict[str, str] = {}
    allowed = {"model", "model_provider", "model_reasoning_effort"}
    pattern = re.compile(r'^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"\s*$')
    try:
        for raw_line in config_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("["):
                break
            match = pattern.match(line)
            if not match:
                continue
            key, value = match.groups()
            if key in allowed:
                copied[key] = value
    except OSError as exc:
        log.warning("failed to read Codex seed config: %s", exc)
    return copied


def _toml_string(value: str) -> str:
    return json.dumps(value)


def _write_codex_config(codex_home: Path, admin_token: str) -> None:
    # Use the FastAPI worker's own Python (absolute path) so codex doesn't have
    # to look anything up on PATH. systemd's minimal PATH typically doesn't
    # include `uv` or user-local bins, which used to silently break MCP spawn.
    mcp_command = sys.executable
    mcp_args = ["-m", "app.mcp.server"]
    if settings.harness.mcp_disable_status_changes:
        mcp_args.append("--disable-status-changes")
    if settings.harness.mcp_disable_high_risk:
        mcp_args.append("--disable-high-risk")

    args_toml = ", ".join(_toml_string(arg) for arg in mcp_args)
    top_level: dict[str, str] = {}
    if settings.harness.default_model:
        top_level["model"] = settings.harness.default_model
    else:
        top_level.update(_read_seed_top_level_codex_config())

    top_level_lines = "".join(
        f"{key} = {_toml_string(value)}\n" for key, value in top_level.items()
    )
    config = f"""{top_level_lines}approval_policy = "on-request"
sandbox_mode = "workspace-write"

[mcp_servers.houseinus-admin]
command = {_toml_string(mcp_command)}
args = [{args_toml}]
cwd = {_toml_string(str(PROJECT_ROOT))}
startup_timeout_sec = 20
tool_timeout_sec = {settings.harness.mcp_tool_timeout_seconds}

[mcp_servers.houseinus-admin.env]
HOUSEINUS_API_BASE_URL = {_toml_string(settings.harness.api_base_url)}
HOUSEINUS_ADMIN_TOKEN = {_toml_string(admin_token)}
HOUSEINUS_MCP_HTTP_TIMEOUT_SECONDS = {_toml_string(str(settings.harness.mcp_http_timeout_seconds))}
"""
    (codex_home / "config.toml").write_text(config, encoding="utf-8")


# ---------------------------------------------------------------------------
# Redis helpers
# ---------------------------------------------------------------------------


def _bridge_key(user_id: uuid.UUID) -> str:
    return f"{settings.redis.prefix}{BRIDGE_KEY_PREFIX}{user_id}"


def _session_key(user_id: uuid.UUID) -> str:
    return f"{settings.redis.prefix}{SESSION_KEY_PREFIX}{user_id}"


async def _read_bridge_entry(user_id: uuid.UUID) -> dict[str, Any] | None:
    raw = await get_redis().get(_bridge_key(user_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _read_session_blob(user_id: uuid.UUID) -> dict[str, Any] | None:
    raw = await get_redis().get(_session_key(user_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def _write_session_blob(user_id: uuid.UUID, blob: dict[str, Any]) -> None:
    await get_redis().set(_session_key(user_id), json.dumps(blob))


async def _delete_session_blob(user_id: uuid.UUID) -> None:
    await get_redis().delete(_session_key(user_id))


async def _update_session_field(user_id: uuid.UUID, **fields: Any) -> None:
    """Read-modify-write a few fields on the session blob. Best-effort, no
    strong consistency — codex protocol writes are inherently serialized by
    the bridge, so concurrent updates from the same worker are negligible."""
    blob = await _read_session_blob(user_id)
    if blob is None:
        return
    blob.update(fields)
    await _write_session_blob(user_id, blob)


def _session_from_blob(blob: dict[str, Any]) -> CodexSession:
    return CodexSession(
        id=str(blob["id"]),
        user_id=uuid.UUID(blob["user_id"]),
        user_email=str(blob["user_email"]),
        agent_home=Path(blob["agent_home"]),
        cwd=Path(blob["cwd"]),
        bridge_host=str(blob["bridge_host"]),
        bridge_port=int(blob["bridge_port"]),
        created_at=float(blob.get("created_at") or 0.0),
        conversation_id=blob.get("conversation_id"),
        active_turn_id=blob.get("active_turn_id"),
        model=blob.get("model"),
        rollout_path=blob.get("rollout_path"),
        pending_approvals=dict(blob.get("pending_approvals") or {}),
    )


def _blob_from_session(session: CodexSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "user_id": str(session.user_id),
        "user_email": session.user_email,
        "agent_home": str(session.agent_home),
        "cwd": str(session.cwd),
        "bridge_host": session.bridge_host,
        "bridge_port": session.bridge_port,
        "created_at": session.created_at,
        "conversation_id": session.conversation_id,
        "active_turn_id": session.active_turn_id,
        "model": session.model,
        "rollout_path": session.rollout_path,
        "pending_approvals": session.pending_approvals,
    }


# ---------------------------------------------------------------------------
# Bridge spawn
# ---------------------------------------------------------------------------


async def _spawn_bridge(
    user_id: uuid.UUID,
    agent_home: Path,
    cwd: Path,
) -> dict[str, Any]:
    """Spawn the socket-bridge process. Returns
        {"host": str, "port": int, "is_owner": bool}
    `is_owner=True` means OUR spawned subprocess produced the listening frame
    (i.e. won Redis SETNX). `is_owner=False` means our subprocess exited
    without announcing (lost the SETNX race) and we fell back to the existing
    Redis entry — some other worker owns the codex session lifecycle.
    """
    env = os.environ.copy()
    env["CODEX_HOME"] = str(agent_home)
    env["KORI_HOME"] = str(agent_home)

    args = [
        sys.executable,
        "-m",
        "app.services.codex_socket_bridge",
        "--user-id", str(user_id),
        "--redis-url", settings.redis.url,
        "--redis-key", _bridge_key(user_id),
        "--port-min", str(settings.harness.bridge_port_min),
        "--port-max", str(settings.harness.bridge_port_max),
        "--idle-seconds", str(settings.harness.bridge_idle_shutdown_seconds),
        "--startup-grace", str(settings.harness.bridge_startup_grace_seconds),
        "--redis-ttl", str(settings.harness.bridge_redis_ttl_seconds),
        "--child-cwd", str(cwd),
        "--",
        settings.harness.codex_command,
        "app-server",
    ]
    # Bridge runs from project root (so `app.*` imports keep working). The
    # actual codex child gets cwd via `--child-cwd`.
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(PROJECT_ROOT),
        env=env,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        start_new_session=True,
    )

    # Wait for "listening" frame on stdout (max BRIDGE_SPAWN_TIMEOUT).
    assert proc.stdout is not None
    deadline = asyncio.get_running_loop().time() + BRIDGE_SPAWN_TIMEOUT
    while True:
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            with contextlib.suppress(ProcessLookupError):
                proc.terminate()
            raise CodexBridgeError("bridge did not announce listening port in time")
        try:
            line = await asyncio.wait_for(proc.stdout.readline(), timeout=remaining)
        except asyncio.TimeoutError:
            with contextlib.suppress(ProcessLookupError):
                proc.terminate()
            raise CodexBridgeError("bridge spawn timed out") from None
        if not line:
            # Bridge exited before announcing. Possibly lost SETNX race.
            existing = await _read_bridge_entry(user_id)
            if existing:
                log.info(
                    "bridge subprocess exited without announcing — using existing "
                    "Redis entry for user=%s port=%s",
                    user_id, existing.get("port"),
                )
                return {
                    "host": existing.get("host", "127.0.0.1"),
                    "port": int(existing["port"]),
                    "is_owner": False,
                }
            stderr = b""
            if proc.stderr is not None:
                with contextlib.suppress(Exception):
                    stderr = await asyncio.wait_for(proc.stderr.read(), timeout=1.0)
            raise CodexBridgeError(
                f"bridge subprocess exited without announcing port: {stderr.decode('utf-8', errors='replace')[:500]}"
            )
        try:
            frame = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(frame, dict) and frame.get("__bridge__") == "listening":
            port = int(frame["port"])
            _retain_bridge_proc(user_id, proc)
            return {"host": "127.0.0.1", "port": port, "is_owner": True}
    # Unreachable
    raise CodexBridgeError("bridge spawn unreachable state")


def _retain_bridge_proc(user_id: uuid.UUID, proc: asyncio.subprocess.Process) -> None:
    """Keep `proc` reachable and drain its pipes so the bridge doesn't see
    stdout-buffer-full / SIGPIPE on stderr."""
    # Drop the previous handle for this user, if any. Don't kill it — the bridge
    # process is detached and the new one (if different) should take over via
    # Redis SETNX semantics anyway.
    _bridge_procs[user_id] = proc

    async def _drain_pipe(stream: asyncio.StreamReader | None, label: str) -> None:
        if stream is None:
            return
        try:
            while True:
                chunk = await stream.read(4096)
                if not chunk:
                    return
                # Forward stderr lines into our logger so misbehaving bridges
                # leave a trace. Stdout post-listening is unused — discard it.
                if label == "stderr":
                    for line in chunk.decode("utf-8", errors="replace").splitlines():
                        if line.strip():
                            log.info("bridge[%s] %s", user_id, line)
        except asyncio.CancelledError:
            pass
        except Exception as exc:  # noqa: BLE001
            log.debug("bridge pipe drain (%s) ended: %s", label, exc)

    async def _monitor() -> None:
        try:
            await asyncio.gather(
                _drain_pipe(proc.stdout, "stdout"),
                _drain_pipe(proc.stderr, "stderr"),
            )
            rc = await proc.wait()
            log.info("bridge process for user=%s exited (rc=%s)", user_id, rc)
        except asyncio.CancelledError:
            pass
        finally:
            if _bridge_procs.get(user_id) is proc:
                _bridge_procs.pop(user_id, None)

    task = asyncio.create_task(_monitor())
    _bridge_monitor_tasks.add(task)
    task.add_done_callback(_bridge_monitor_tasks.discard)


# ---------------------------------------------------------------------------
# TCP connection management
# ---------------------------------------------------------------------------


async def _open_connection(host: str, port: int, user_id: uuid.UUID) -> _Connection:
    try:
        reader, writer = await asyncio.open_connection(host, port)
    except OSError as exc:
        raise CodexBridgeError(f"cannot connect to bridge {host}:{port}: {exc}") from exc
    conn = _Connection(
        user_id=user_id,
        host=host,
        port=port,
        reader=reader,
        writer=writer,
    )
    conn.reader_task = asyncio.create_task(_conn_reader_loop(conn))
    return conn


async def _ensure_connection(user_id: uuid.UUID, host: str, port: int) -> _Connection:
    async with _connections_lock:
        existing = _connections.get(user_id)
        if existing and not existing.closed and existing.host == host and existing.port == port:
            return existing
        if existing:
            await _close_connection(existing)
            _connections.pop(user_id, None)
        conn = await _open_connection(host, port, user_id)
        _connections[user_id] = conn
        return conn


async def _close_connection(conn: _Connection) -> None:
    conn.closed = True
    if conn.reader_task is not None:
        conn.reader_task.cancel()
        with contextlib.suppress(BaseException):
            await conn.reader_task
    with contextlib.suppress(Exception):
        conn.writer.close()
        await conn.writer.wait_closed()
    for fut in conn.pending.values():
        if not fut.done():
            fut.set_exception(CodexBridgeError("bridge connection closed"))
    conn.pending.clear()


async def _send_jsonrpc(conn: _Connection, payload: dict[str, Any]) -> None:
    if conn.closed or conn.writer.is_closing():
        raise CodexBridgeError("bridge connection is closed")
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") + b"\n"
    async with conn.write_lock:
        conn.writer.write(data)
        await conn.writer.drain()


async def _request(
    conn: _Connection,
    method: str,
    params: dict[str, Any] | None = None,
    timeout: float = 30,
) -> dict[str, Any]:
    request_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    future: asyncio.Future[dict[str, Any]] = loop.create_future()
    conn.pending[request_id] = future
    payload: dict[str, Any] = {"id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    await _send_jsonrpc(conn, payload)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    finally:
        conn.pending.pop(request_id, None)


async def _notify(conn: _Connection, method: str, params: dict[str, Any] | None = None) -> None:
    payload: dict[str, Any] = {"method": method}
    if params is not None:
        payload["params"] = params
    await _send_jsonrpc(conn, payload)


async def _broadcast(conn: _Connection, event: dict[str, Any]) -> None:
    conn.event_buffer.append(event)
    dead: list[asyncio.Queue[dict[str, Any]]] = []
    for queue in conn.subscribers:
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(queue)
    for queue in dead:
        conn.subscribers.discard(queue)


async def _conn_reader_loop(conn: _Connection) -> None:
    try:
        while True:
            line = await conn.reader.readline()
            if not line:
                break
            await _handle_inbound_line(conn, line)
    except asyncio.CancelledError:
        pass
    except Exception as exc:  # noqa: BLE001
        log.warning("connection reader loop crashed: %s", exc)
    finally:
        conn.closed = True
        for fut in conn.pending.values():
            if not fut.done():
                fut.set_exception(CodexBridgeError("bridge connection closed"))
        conn.pending.clear()
        await _broadcast(conn, {"type": "closed", "returncode": None})


async def _handle_inbound_line(conn: _Connection, line: bytes) -> None:
    try:
        message = json.loads(line)
    except json.JSONDecodeError:
        await _broadcast(
            conn,
            {"type": "stdout", "text": line.decode("utf-8", errors="replace")},
        )
        return
    if not isinstance(message, dict):
        await _broadcast(conn, {"type": "unknown", "raw": message})
        return
    if "__bridge__" in message:
        await _handle_bridge_frame(conn, message)
        return
    await _handle_codex_message(conn, message)


async def _handle_bridge_frame(conn: _Connection, message: dict[str, Any]) -> None:
    op = message.get("__bridge__")
    if op in {"hello", "pong", "shutdown_ack"}:
        return
    if op == "stderr":
        await _broadcast(conn, {"type": "stderr", "text": str(message.get("text", ""))})
        return
    if op == "closed":
        await _broadcast(
            conn,
            {"type": "closed", "returncode": message.get("returncode")},
        )
        return
    if op == "error":
        await _broadcast(
            conn,
            {"type": "error", "text": str(message.get("message", "bridge error"))},
        )
        return
    if op == "event":
        # Cross-worker service event fan-out (e.g. approval_resolved). The
        # bridge wrapped a payload another worker emitted; surface it to our
        # local subscribers so the WS-holding worker can forward it.
        data = message.get("data")
        if isinstance(data, dict):
            await _broadcast(conn, data)
        return
    log.warning("unknown bridge control frame: %s", message)


async def _emit_cross_worker_event(conn: _Connection, event: dict[str, Any]) -> None:
    """Ask the bridge to fan-out `event` to all currently-connected workers,
    so the worker that owns the user's WebSocket can forward it to the browser.
    Used for service-level events (not codex-originated) that need to reach
    UI no matter which worker generated them. Best-effort — if the bridge link
    is gone, fall back to a local broadcast so this worker's own subscribers
    (if any) still see the event."""
    try:
        await _send_jsonrpc(conn, {"__bridge__": "emit", "payload": event})
    except CodexBridgeError:
        await _broadcast(conn, event)


# ---------------------------------------------------------------------------
# Codex message handling (port of the previous _handle_message)
# ---------------------------------------------------------------------------


def _friendly_event(message: dict[str, Any]) -> dict[str, Any]:
    method = message.get("method")
    params = message.get("params") or {}
    msg = params.get("msg") if isinstance(params, dict) else None
    if not isinstance(msg, dict):
        msg = {}
    event_type = "codex"
    text = ""
    if method == "codex/event/user_message":
        event_type = "user"
        text = str(msg.get("message") or params.get("message") or params.get("text") or "")
    elif method == "codex/event/agent_message_delta":
        event_type = "assistant_delta"
        text = str(msg.get("delta") or params.get("delta") or "")
    elif method == "codex/event/agent_message":
        event_type = "assistant"
        text = str(msg.get("message") or params.get("message") or params.get("text") or "")
    elif method == "codex/event/task_complete":
        event_type = "task_complete"
        text = str(msg.get("last_agent_message") or "")
    elif method == "codex/event/error":
        event_type = "error"
        text = str(msg.get("message") or "Codex turn failed.")
    elif method == "codex/event/stream_error":
        event_type = "error"
        text = str(msg.get("message") or "Codex stream error.")
    elif method == "codex/event/turn_aborted":
        event_type = "error"
        text = f"Turn aborted: {msg.get('reason') or 'unknown'}"
    elif method == "codex/event/background_event":
        event_type = "system"
        text = str(msg.get("message") or "")
    elif method == "codex/event/exec_command_begin":
        event_type = "exec_begin"
    elif method == "codex/event/exec_command_end":
        event_type = "exec_end"
    elif method == "item/agentMessage/delta":
        event_type = "assistant_delta"
        text = str(params.get("delta") or "")
    elif method == "item/completed":
        item = params.get("item") if isinstance(params, dict) else None
        if isinstance(item, dict):
            item_type = item.get("type")
            if item_type == "agentMessage":
                event_type = "assistant"
                text = str(item.get("text") or "")
            elif item_type == "commandExecution":
                event_type = "exec_end"
                text = str(item.get("command") or "")
            elif item_type == "mcpToolCall":
                status = item.get("status")
                tool_name = f"{item.get('server')}.{item.get('tool')}"
                if status == "failed":
                    event_type = "error"
                    text = _mcp_error_message(item) or f"MCP tool failed: {tool_name}"
                else:
                    event_type = "system"
                    text = f"MCP tool completed: {tool_name}"
    elif method == "item/started":
        item = params.get("item") if isinstance(params, dict) else None
        if isinstance(item, dict):
            item_type = item.get("type")
            if item_type == "commandExecution":
                event_type = "exec_begin"
                text = str(item.get("command") or "")
            elif item_type == "mcpToolCall":
                event_type = "system"
                text = f"MCP tool started: {item.get('server')}.{item.get('tool')}"
    elif method in {"item/commandExecution/outputDelta", "command/exec/outputDelta"}:
        event_type = "stdout"
        text = str(params.get("delta") or "")
    elif method == "item/mcpToolCall/progress":
        event_type = "system"
        text = str(params.get("message") or "")
    elif method == "process/outputDelta":
        event_type = "stdout"
        text = str(params.get("delta") or "")
    elif method == "turn/started":
        event_type = "system"
        text = "Turn started."
    elif method == "turn/completed":
        turn = params.get("turn") if isinstance(params, dict) else None
        status = turn.get("status") if isinstance(turn, dict) else None
        error = turn.get("error") if isinstance(turn, dict) else None
        if status == "failed":
            event_type = "error"
            text = _error_message(error) or "Codex turn failed."
        elif status == "interrupted":
            event_type = "error"
            text = "Turn interrupted."
        else:
            event_type = "task_complete"
            text = "Turn completed."
    elif method == "error":
        event_type = "error"
        text = _error_message(params) or "Codex app-server error."
    elif method in {"warning", "configWarning", "guardianWarning", "deprecationNotice"}:
        event_type = "system"
        text = _error_message(params) or json.dumps(params, ensure_ascii=False)
    elif method == "thread/status/changed":
        event_type = "system"
        status = params.get("status") if isinstance(params, dict) else None
        text = f"Thread status changed: {status}" if status else ""
    return {"type": event_type, "method": method, "text": text, "raw": message}


def _error_message(value: Any) -> str:
    if isinstance(value, dict):
        message = value.get("message")
        if message:
            return str(message)
        error = value.get("error")
        if error:
            return _error_message(error)
        details = value.get("additionalDetails")
        if details:
            return str(details)
    elif value:
        return str(value)
    return ""


def _mcp_error_message(item: dict[str, Any]) -> str:
    error = item.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        if message:
            return str(message)
        content = error.get("content")
        if content:
            return str(content)
    if error:
        return str(error)
    return ""


_APPROVAL_METHODS = {
    "execCommandApproval",
    "applyPatchApproval",
    "item/commandExecution/requestApproval",
    "item/fileChange/requestApproval",
}


async def _handle_codex_message(conn: _Connection, message: dict[str, Any]) -> None:
    msg_id = message.get("id")

    # RPC response (matches a pending request).
    if msg_id is not None and ("result" in message or "error" in message):
        msg_key = str(msg_id)
        future = conn.pending.get(msg_key)
        if future and not future.done():
            if "error" in message:
                future.set_exception(CodexBridgeError(str(message["error"])))
            else:
                future.set_result(message.get("result") or {})
        await _broadcast(
            conn,
            {
                "type": "rpc_error" if "error" in message else "rpc_response",
                "raw": message,
            },
        )
        return

    # Server-initiated request (e.g. approval). Must be answered.
    if msg_id is not None and "method" in message:
        method = str(message["method"])
        if method in _APPROVAL_METHODS or method == "mcpServer/elicitation/request":
            approval_id = str(msg_id)
            approval = {
                "type": "approval_request",
                "approval_id": approval_id,
                "method": method,
                "params": message.get("params") or {},
                "raw": message,
            }
            await _persist_approval(conn.user_id, approval_id, approval)
            await _broadcast(conn, approval)
            return
        # Unknown server request — auto-accept so codex doesn't hang.
        log.warning(
            "unrecognized server request: method=%s id=%s params=%s",
            method, msg_id, message.get("params"),
        )
        with contextlib.suppress(CodexBridgeError):
            await _send_jsonrpc(conn, {"id": msg_id, "result": {"action": "accept"}})
        await _broadcast(
            conn,
            {
                "type": "system",
                "method": method,
                "text": f"[auto-approved] {method}",
                "raw": message,
            },
        )
        return

    # Notification.
    if "method" in message:
        method = message.get("method")
        if method == "turn/started":
            params = message.get("params") or {}
            turn = params.get("turn") if isinstance(params, dict) else None
            if isinstance(turn, dict):
                await _update_session_field(conn.user_id, active_turn_id=turn.get("id"))
        elif method == "turn/completed":
            await _update_session_field(conn.user_id, active_turn_id=None)
        event = _friendly_event(message)
        await _broadcast(conn, event)
        return

    await _broadcast(conn, {"type": "unknown", "raw": message})


async def _persist_approval(user_id: uuid.UUID, approval_id: str, approval: dict[str, Any]) -> None:
    blob = await _read_session_blob(user_id)
    if blob is None:
        return
    approvals = dict(blob.get("pending_approvals") or {})
    approvals[approval_id] = approval
    blob["pending_approvals"] = approvals
    await _write_session_blob(user_id, blob)


async def _consume_approval(user_id: uuid.UUID, approval_id: str) -> dict[str, Any] | None:
    blob = await _read_session_blob(user_id)
    if blob is None:
        return None
    approvals = dict(blob.get("pending_approvals") or {})
    approval = approvals.pop(approval_id, None)
    if approval is None:
        return None
    blob["pending_approvals"] = approvals
    await _write_session_blob(user_id, blob)
    return approval


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def serialize_session(session: CodexSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "user_id": str(session.user_id),
        "user_email": session.user_email,
        "conversation_id": session.conversation_id,
        "thread_id": session.conversation_id,
        "active_turn_id": session.active_turn_id,
        "model": session.model,
        "rollout_path": session.rollout_path,
        "cwd": str(session.cwd),
        "agent_provider": "codex",
        "agent_home": str(session.agent_home),
        "running": session.running,
        "pending_approvals": list(session.pending_approvals.values()),
    }


async def get_user_session(user: User) -> CodexSession | None:
    blob = await _read_session_blob(user.id)
    if blob is None:
        return None
    bridge = await _read_bridge_entry(user.id)
    if bridge is None:
        # Bridge dead but stale session blob — clean up.
        await _delete_session_blob(user.id)
        return None
    blob["bridge_host"] = bridge.get("host", "127.0.0.1")
    blob["bridge_port"] = int(bridge["port"])
    return _session_from_blob(blob)


async def get_or_create_session(user: User, admin_token: str) -> CodexSession:
    async with _spawn_lock_for(user.id):
        existing = await get_user_session(user)
        if existing is not None:
            return existing

        base = _harness_base()
        cwd = base / "cwd"
        agent_home = base / "agent_homes" / "codex" / str(user.id)
        _safe_mkdir(cwd)
        _safe_mkdir(agent_home)
        _copy_agent_instructions(cwd)
        _link_uploads_into_cwd(cwd)
        _seed_codex_home(agent_home)
        _write_codex_config(agent_home, admin_token)

        # Bridge alive but no published session blob? Two possibilities:
        #   (a) Another worker is mid-initialization right now — wait for it.
        #   (b) Last initialization crashed and the bridge is orphaned — recycle it.
        # Probe TCP to distinguish: reachable → (a), unreachable → (b).
        stale_bridge = await _read_bridge_entry(user.id)
        if stale_bridge is not None:
            host = stale_bridge.get("host", "127.0.0.1")
            port = int(stale_bridge["port"])
            if await _probe_bridge_reachable(host, port):
                log.info(
                    "bridge for user=%s reachable, waiting for owner's session blob",
                    user.id,
                )
                blob = await _wait_for_ready_session_blob(user.id, timeout=20.0)
                if blob is not None:
                    blob["bridge_host"] = host
                    blob["bridge_port"] = port
                    return _session_from_blob(blob)
                log.warning(
                    "owner did not publish session blob in time for user=%s; recycling bridge",
                    user.id,
                )
            # Recycle: try graceful shutdown first, then force-delete the
            # Redis key. The bridge process clears the key on graceful exit,
            # but if it died abnormally (SIGKILL, OOM, etc.) the key sticks
            # around until TTL and blocks the next SETNX. We can't afford
            # that wait — the next spawn would lose SETNX and the caller
            # would hit `_wait_for_ready_session_blob` timeout instead.
            await _shutdown_bridge_at(host, port)
            for _ in range(20):
                if not await _read_bridge_entry(user.id):
                    break
                await asyncio.sleep(0.1)
            with contextlib.suppress(Exception):
                await get_redis().delete(_bridge_key(user.id))
            await _delete_session_blob(user.id)

        bridge_info = await _spawn_bridge(user.id, agent_home, cwd)
        host = str(bridge_info.get("host", "127.0.0.1"))
        port = int(bridge_info["port"])
        is_owner = bool(bridge_info.get("is_owner", False))

        if not is_owner:
            # Lost the SETNX race — another worker's subprocess is the owner.
            # Wait for them to publish the ready session blob.
            blob = await _wait_for_ready_session_blob(user.id, timeout=20.0)
            if blob is None:
                raise CodexBridgeError(
                    "agent session timed out waiting for the owner to initialize"
                )
            blob["bridge_host"] = host
            blob["bridge_port"] = port
            return _session_from_blob(blob)

        session = CodexSession(
            id=str(uuid.uuid4()),
            user_id=user.id,
            user_email=user.email,
            agent_home=agent_home,
            cwd=cwd,
            bridge_host=host,
            bridge_port=port,
            created_at=asyncio.get_running_loop().time(),
        )

    # We won the spawn race — initialize codex now. Only publish the session
    # blob after initialize succeeds, so concurrent non-owners distinguish
    # "in progress" from "ready".
    try:
        conn = await _ensure_connection(user.id, host, port)
        await _initialize(conn, session)
        await _write_session_blob(user.id, _blob_from_session(session))
        await _broadcast(conn, {"type": "ready", "session": serialize_session(session)})
        return session
    except Exception:
        with contextlib.suppress(Exception):
            await stop_session(session)
        raise


async def _probe_bridge_reachable(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
    except (OSError, asyncio.TimeoutError):
        return False
    with contextlib.suppress(Exception):
        writer.close()
        await writer.wait_closed()
    return True


async def _wait_for_ready_session_blob(
    user_id: uuid.UUID, timeout: float
) -> dict[str, Any] | None:
    """Poll Redis until a session blob with `conversation_id` shows up
    (signal that the SETNX winner has finished `_initialize`)."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        blob = await _read_session_blob(user_id)
        if blob and blob.get("conversation_id"):
            return blob
        await asyncio.sleep(0.25)
    return None


async def _initialize(conn: _Connection, session: CodexSession) -> None:
    await _request(
        conn,
        "initialize",
        {
            "clientInfo": {
                "name": "houseinus-admin-web",
                "title": "House in Us Admin",
                "version": "0.1.0",
            },
            "capabilities": None,
        },
    )
    await _notify(conn, "initialized")
    thread_response = await _request(
        conn,
        "thread/start",
        {
            "cwd": str(session.cwd),
            "approvalPolicy": "on-request",
            "sandbox": "workspace-write",
            "experimentalRawEvents": False,
            "persistExtendedHistory": False,
        },
        timeout=60,
    )
    thread = thread_response.get("thread") or {}
    session.conversation_id = thread.get("id")
    session.model = thread_response.get("model") or thread.get("model")
    rollout = thread.get("path") or thread_response.get("rolloutPath")
    session.rollout_path = str(rollout) if rollout else None


async def _connection_for(session: CodexSession) -> _Connection:
    return await _ensure_connection(session.user_id, session.bridge_host, session.bridge_port)


async def send_user_message(
    session: CodexSession,
    text: str,
    *,
    pathname: str | None = None,
) -> None:
    if not session.conversation_id:
        raise CodexBridgeError("Codex thread is not ready yet")
    input_items: list[dict[str, Any]] = []
    if pathname:
        input_items.append(
            {"type": "text", "text": f"[현재 페이지: {pathname}]", "text_elements": []}
        )
    input_items.append({"type": "text", "text": text, "text_elements": []})
    conn = await _connection_for(session)
    response = await _request(
        conn,
        "turn/start",
        {"threadId": session.conversation_id, "input": input_items},
        timeout=30,
    )
    turn = response.get("turn") or {}
    if turn.get("id"):
        await _update_session_field(session.user_id, active_turn_id=turn.get("id"))


async def interrupt_session(session: CodexSession) -> dict[str, Any]:
    if not session.conversation_id:
        raise CodexBridgeError("Codex thread is not ready yet")
    if not session.active_turn_id:
        raise CodexBridgeError("No active Codex turn to interrupt")
    conn = await _connection_for(session)
    return await _request(
        conn,
        "turn/interrupt",
        {"threadId": session.conversation_id, "turnId": session.active_turn_id},
    )


async def resolve_approval(
    session: CodexSession,
    approval_id: str,
    decision: str,
) -> None:
    if decision not in {"approved", "approved_for_session", "denied", "abort"}:
        raise CodexBridgeError("invalid approval decision")
    approval = await _consume_approval(session.user_id, approval_id)
    if approval is None:
        # Idempotent: another worker already handled this approval (or the
        # user double-clicked). Emit a resolved event anyway so any UI still
        # showing the card dismisses it, and return success.
        conn = await _connection_for(session)
        await _emit_cross_worker_event(
            conn,
            {
                "type": "approval_resolved",
                "approval_id": approval_id,
                "decision": decision,
                "approval": None,
            },
        )
        return
    rpc_decision = _approval_decision_for_method(approval["method"], decision)
    result_key = (
        "action" if approval["method"] == "mcpServer/elicitation/request" else "decision"
    )
    conn = await _connection_for(session)
    # Approval IDs were assigned by codex itself; they may be numeric.
    raw_id = approval.get("raw", {}).get("id", approval_id)
    await _send_jsonrpc(conn, {"id": raw_id, "result": {result_key: rpc_decision}})
    # Fan-out across workers so the WS-holding worker dismisses the card.
    await _emit_cross_worker_event(
        conn,
        {
            "type": "approval_resolved",
            "approval_id": approval_id,
            "decision": decision,
            "approval": approval,
        },
    )


def _approval_decision_for_method(method: str, decision: str) -> str:
    if method in {
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
    }:
        return {
            "approved": "accept",
            "approved_for_session": "acceptForSession",
            "denied": "decline",
            "abort": "cancel",
        }[decision]
    if method == "mcpServer/elicitation/request":
        return {
            "approved": "accept",
            "approved_for_session": "accept",
            "denied": "decline",
            "abort": "cancel",
        }[decision]
    return decision


async def _shutdown_bridge_at(host: str, port: int) -> None:
    try:
        reader, writer = await asyncio.open_connection(host, port)
    except OSError:
        return
    try:
        writer.write(b'{"__bridge__":"shutdown"}\n')
        with contextlib.suppress(Exception):
            await writer.drain()
        # Wait briefly for ack so the bridge has a chance to start teardown.
        with contextlib.suppress(Exception):
            await asyncio.wait_for(reader.readline(), timeout=2.0)
    finally:
        with contextlib.suppress(Exception):
            writer.close()
            await writer.wait_closed()


async def stop_session(session: CodexSession) -> None:
    conn = _connections.get(session.user_id)
    if conn is not None:
        await _broadcast(conn, {"type": "stopping"})

    # Ask the bridge to terminate codex + itself.
    await _shutdown_bridge_at(session.bridge_host, session.bridge_port)

    # Drop our local connection.
    async with _connections_lock:
        conn = _connections.pop(session.user_id, None)
    if conn is not None:
        await _close_connection(conn)

    # Clear both Redis keys explicitly. The bridge's own _deregister runs at
    # graceful shutdown, but if it was killed/crashed, the bridge key would
    # linger up to its TTL and block the next spawn's SETNX. Force the cleanup.
    await _delete_session_blob(session.user_id)
    with contextlib.suppress(Exception):
        await get_redis().delete(_bridge_key(session.user_id))


async def subscribe(session: CodexSession) -> asyncio.Queue[dict[str, Any]]:
    """Return a queue that receives events for `session`. The caller MUST call
    `unsubscribe(session, queue)` when done. Opens (or reuses) a TCP
    connection to the bridge synchronously so the caller can immediately
    await `queue.get()` and not race a half-open connection. Raises
    `CodexBridgeError` if the bridge can't be reached."""
    conn = await _ensure_connection(
        session.user_id, session.bridge_host, session.bridge_port
    )
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=500)
    for event in conn.event_buffer:
        with contextlib.suppress(asyncio.QueueFull):
            queue.put_nowait(event)
    conn.subscribers.add(queue)
    return queue


def unsubscribe(session: CodexSession, queue: asyncio.Queue[dict[str, Any]]) -> None:
    conn = _connections.get(session.user_id)
    if conn is not None:
        conn.subscribers.discard(queue)


async def stop_all_sessions() -> None:
    """Close all worker-local TCP connections. Bridges themselves are detached
    and will idle-shutdown on their own; this only cleans up this worker's
    state during app shutdown."""
    async with _connections_lock:
        conns = list(_connections.values())
        _connections.clear()
    for conn in conns:
        with contextlib.suppress(Exception):
            await _close_connection(conn)
