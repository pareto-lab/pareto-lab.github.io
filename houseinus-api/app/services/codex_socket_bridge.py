"""TCP fan-out wrapper around a codex (or any stdio JSON-RPC) child process.

Why this exists
---------------
FastAPI runs under multiple uvicorn workers. A codex `app-server` child spawned
inside one worker is reachable only from that worker's memory — its stdin/stdout
pipes don't exist in sibling processes. That's why a session started by worker
A is invisible to worker B (`agent-session-not-running`).

This script wraps `codex app-server` (or anything else stdio-JSON-RPC) in a
small daemon that:

1. Binds a loopback TCP port from a configurable range.
2. Registers `<host>:<port>` in Redis under a per-user key with TTL (heartbeat
   refresh from a background task).
3. Spawns the actual codex child with the existing pipe setup.
4. Accepts any number of TCP clients. Each line received on a TCP connection
   is forwarded to codex stdin verbatim (except control frames). Each line
   from codex stdout is broadcast to every connected client. A small ring
   buffer is replayed to new clients so a reconnect doesn't miss recent events.
5. Self-terminates when it has been idle (no client connected) for the
   configured timeout — keeps the box clean of orphaned codex processes.

Control frames (single-line JSON sent by a client):
  {"__bridge__": "shutdown"}              → graceful shutdown (TERM codex, exit)
  {"__bridge__": "ping"}                  → no-op, server replies with `{"__bridge__":"pong"}`
  {"__bridge__": "emit", "payload": ...}  → fan-out a service-level event to every
                                            connected client. Used by FastAPI workers
                                            to broadcast cross-worker UI events that
                                            don't originate from codex (e.g. approval
                                            resolutions). The bridge wraps it in an
                                            `{"__bridge__":"event","data":<payload>}`
                                            frame on the wire.

Bridge-originated frames (preserves the same single-line JSON convention):
  {"__bridge__": "hello", "session_id": "...", "started_at": ..., "replayed": N}
  {"__bridge__": "closed", "returncode": ...}        (codex exited)
  {"__bridge__": "event",  "data": ...}              (broadcast from an `emit`)
  {"__bridge__": "pong"}

Run with:
  uv run python -m app.services.codex_socket_bridge \
      --user-id <uuid> \
      --redis-url redis://... \
      --redis-key "houseinus:agent:bridge:user:<uuid>" \
      --port-min 50000 --port-max 59999 \
      --idle-seconds 60 --startup-grace 30 --redis-ttl 30 \
      -- codex app-server
"""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import os
import random
import signal
import socket
import sys
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any

import redis.asyncio as aioredis

log = logging.getLogger("codex_socket_bridge")

RING_BUFFER_SIZE = 300
HEARTBEAT_DIVISOR = 3   # heartbeat interval = ttl / HEARTBEAT_DIVISOR
WRITE_QUEUE_LIMIT = 1000
ACCEPT_BACKLOG = 16


@dataclass
class ClientConn:
    id: str
    writer: asyncio.StreamWriter
    queue: asyncio.Queue[bytes] = field(default_factory=lambda: asyncio.Queue(maxsize=WRITE_QUEUE_LIMIT))
    sender_task: asyncio.Task[None] | None = None
    reader_task: asyncio.Task[None] | None = None


@dataclass
class BridgeState:
    bridge_id: str
    started_at: float
    args: argparse.Namespace
    redis: aioredis.Redis
    process: asyncio.subprocess.Process
    server: asyncio.base_events.Server
    port: int
    ring: deque[bytes] = field(default_factory=lambda: deque(maxlen=RING_BUFFER_SIZE))
    clients: dict[str, ClientConn] = field(default_factory=dict)
    last_disconnect: float | None = None  # set when client count goes to 0
    shutdown_event: asyncio.Event = field(default_factory=asyncio.Event)
    codex_dead: bool = False
    background_tasks: set[asyncio.Task[Any]] = field(default_factory=set)


# ---------------------------------------------------------------------------
# Port binding
# ---------------------------------------------------------------------------


def _bind_loopback_in_range(port_min: int, port_max: int) -> tuple[socket.socket, int]:
    """Try random ports in [port_min, port_max] until one binds. Returns (sock, port)."""
    if port_min < 1 or port_max < port_min or port_max > 65535:
        raise ValueError(f"Invalid port range: {port_min}-{port_max}")
    candidates = list(range(port_min, port_max + 1))
    random.shuffle(candidates)
    last_err: OSError | None = None
    for port in candidates:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            sock.listen(ACCEPT_BACKLOG)
            sock.setblocking(False)
            return sock, port
        except OSError as exc:
            last_err = exc
            sock.close()
            continue
    raise RuntimeError(
        f"No free port in {port_min}-{port_max} ({last_err})"
    )


# ---------------------------------------------------------------------------
# Redis registration / heartbeat
# ---------------------------------------------------------------------------


def _redis_entry(state: BridgeState) -> str:
    return json.dumps(
        {
            "bridge_id": state.bridge_id,
            "host": "127.0.0.1",
            "port": state.port,
            "pid": os.getpid(),
            "started_at": state.started_at,
        }
    )


async def _try_register(state: BridgeState) -> bool:
    """SETNX the Redis key. Returns True if we won the race."""
    won = await state.redis.set(
        state.args.redis_key,
        _redis_entry(state),
        ex=state.args.redis_ttl,
        nx=True,
    )
    return bool(won)


async def _try_claim_key(
    redis_client: aioredis.Redis,
    key: str,
    entry: str,
    ttl: int,
) -> bool:
    won = await redis_client.set(key, entry, ex=ttl, nx=True)
    return bool(won)


async def _heartbeat_loop(state: BridgeState) -> None:
    interval = max(1.0, state.args.redis_ttl / HEARTBEAT_DIVISOR)
    try:
        while not state.shutdown_event.is_set():
            try:
                await state.redis.set(
                    state.args.redis_key,
                    _redis_entry(state),
                    ex=state.args.redis_ttl,
                )
            except Exception as exc:  # pragma: no cover - best-effort
                log.warning("redis heartbeat failed: %s", exc)
            try:
                await asyncio.wait_for(state.shutdown_event.wait(), timeout=interval)
            except asyncio.TimeoutError:
                pass
    except asyncio.CancelledError:
        pass


async def _deregister(state: BridgeState) -> None:
    # Only delete if the entry still belongs to us (no stomp on a successor).
    try:
        current = await state.redis.get(state.args.redis_key)
        if current:
            try:
                payload = json.loads(current)
                if payload.get("bridge_id") == state.bridge_id:
                    await state.redis.delete(state.args.redis_key)
            except (json.JSONDecodeError, AttributeError):
                pass
    except Exception as exc:  # pragma: no cover - best-effort
        log.warning("redis deregister failed: %s", exc)


# ---------------------------------------------------------------------------
# Codex child wiring
# ---------------------------------------------------------------------------


async def _spawn_codex(cmd: list[str], child_cwd: str | None) -> asyncio.subprocess.Process:
    return await asyncio.create_subprocess_exec(
        cmd[0],
        *cmd[1:],
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        start_new_session=True,
        cwd=child_cwd,
    )


async def _read_codex_stdout(state: BridgeState) -> None:
    assert state.process.stdout is not None
    try:
        while True:
            line = await state.process.stdout.readline()
            if not line:
                break
            # Ensure each forwarded message is exactly one line on the wire.
            if not line.endswith(b"\n"):
                line = line + b"\n"
            state.ring.append(line)
            _fanout(state, line)
    except asyncio.CancelledError:
        pass
    finally:
        state.codex_dead = True
        rc = state.process.returncode
        notice = (
            json.dumps({"__bridge__": "closed", "returncode": rc}).encode()
            + b"\n"
        )
        state.ring.append(notice)
        _fanout(state, notice)
        state.shutdown_event.set()


async def _read_codex_stderr(state: BridgeState) -> None:
    assert state.process.stderr is not None
    try:
        while True:
            line = await state.process.stderr.readline()
            if not line:
                break
            # Forward stderr as a bridge frame so clients can surface it.
            frame = (
                json.dumps(
                    {
                        "__bridge__": "stderr",
                        "text": line.decode("utf-8", errors="replace").rstrip("\n"),
                    },
                    ensure_ascii=False,
                ).encode()
                + b"\n"
            )
            state.ring.append(frame)
            _fanout(state, frame)
    except asyncio.CancelledError:
        pass


def _fanout(state: BridgeState, line: bytes) -> None:
    dead: list[str] = []
    for client_id, client in state.clients.items():
        try:
            client.queue.put_nowait(line)
        except asyncio.QueueFull:
            log.warning("client %s queue full — dropping", client_id)
            dead.append(client_id)
    for client_id in dead:
        state.clients.pop(client_id, None)


# ---------------------------------------------------------------------------
# TCP server / clients
# ---------------------------------------------------------------------------


async def _client_sender(state: BridgeState, client: ClientConn) -> None:
    try:
        while True:
            chunk = await client.queue.get()
            client.writer.write(chunk)
            await client.writer.drain()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError):
        pass
    except Exception as exc:
        log.warning("client %s send failed: %s", client.id, exc)


async def _client_reader(state: BridgeState, client: ClientConn, reader: asyncio.StreamReader) -> None:
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            stripped = line.strip()
            if not stripped:
                continue
            # Control frame? Try to parse only minimally — don't break codex
            # traffic if the JSON is just a normal RPC.
            handled = await _maybe_handle_control(state, client, stripped)
            if handled:
                continue
            if state.codex_dead or state.process.stdin is None:
                # Codex is gone — tell the client and stop accepting input.
                error_frame = (
                    json.dumps(
                        {"__bridge__": "error", "message": "codex stdin closed"}
                    ).encode()
                    + b"\n"
                )
                client.queue.put_nowait(error_frame)
                break
            try:
                state.process.stdin.write(line if line.endswith(b"\n") else line + b"\n")
                await state.process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError):
                break
    except asyncio.CancelledError:
        pass


async def _maybe_handle_control(state: BridgeState, client: ClientConn, raw: bytes) -> bool:
    if not raw.startswith(b"{"):
        return False
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return False
    if not isinstance(msg, dict) or "__bridge__" not in msg:
        return False
    op = msg.get("__bridge__")
    if op == "ping":
        client.queue.put_nowait(b'{"__bridge__":"pong"}\n')
        return True
    if op == "shutdown":
        log.info("shutdown control received from client %s", client.id)
        ack = (
            json.dumps({"__bridge__": "shutdown_ack"}).encode() + b"\n"
        )
        client.queue.put_nowait(ack)
        # Allow ack to drain.
        await asyncio.sleep(0.05)
        state.shutdown_event.set()
        return True
    if op == "emit":
        # Fan-out a service-level event to every currently-connected client
        # (including the sender — keeps both sides symmetric).
        payload = msg.get("payload")
        frame = (
            json.dumps(
                {"__bridge__": "event", "data": payload},
                ensure_ascii=False,
            ).encode()
            + b"\n"
        )
        state.ring.append(frame)
        _fanout(state, frame)
        return True
    # Unknown control op — ignore (do not leak to codex either).
    log.warning("unknown control op from client %s: %r", client.id, op)
    return True


async def _handle_client(state: BridgeState, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    client_id = uuid.uuid4().hex[:8]
    client = ClientConn(id=client_id, writer=writer)
    state.clients[client_id] = client
    state.last_disconnect = None
    peer = writer.get_extra_info("peername")
    log.info("client %s connected from %s (total=%d)", client_id, peer, len(state.clients))

    # Greet + replay.
    hello = json.dumps(
        {
            "__bridge__": "hello",
            "bridge_id": state.bridge_id,
            "session_started_at": state.started_at,
            "replayed": len(state.ring),
        }
    ).encode() + b"\n"
    try:
        writer.write(hello)
        for line in list(state.ring):
            writer.write(line)
        await writer.drain()
    except (ConnectionResetError, BrokenPipeError):
        state.clients.pop(client_id, None)
        if not state.clients:
            state.last_disconnect = time.monotonic()
        return

    client.sender_task = asyncio.create_task(_client_sender(state, client))
    client.reader_task = asyncio.create_task(_client_reader(state, client, reader))

    try:
        await client.reader_task
    finally:
        if client.sender_task is not None:
            client.sender_task.cancel()
            with contextlib.suppress(BaseException):
                await client.sender_task
        with contextlib.suppress(Exception):
            writer.close()
            await writer.wait_closed()
        state.clients.pop(client_id, None)
        if not state.clients:
            state.last_disconnect = time.monotonic()
        log.info("client %s disconnected (remaining=%d)", client_id, len(state.clients))


# ---------------------------------------------------------------------------
# Idle watchdog
# ---------------------------------------------------------------------------


async def _idle_watchdog(state: BridgeState) -> None:
    idle = state.args.idle_seconds
    grace = state.args.startup_grace
    if idle <= 0 and grace <= 0:
        return
    try:
        while not state.shutdown_event.is_set():
            await asyncio.sleep(1)
            now = time.monotonic()
            if state.clients:
                continue
            # No clients right now.
            if state.last_disconnect is None:
                # Never had a client. Use startup grace.
                if grace > 0 and (now - state.started_at) >= grace:
                    log.info("startup grace expired without any client — shutting down")
                    state.shutdown_event.set()
                    return
            else:
                if idle > 0 and (now - state.last_disconnect) >= idle:
                    log.info("idle timeout (%ss) exceeded — shutting down", idle)
                    state.shutdown_event.set()
                    return
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


def _started_at_monotonic() -> float:
    return time.monotonic()


async def _await_shutdown(state: BridgeState) -> None:
    await state.shutdown_event.wait()


async def _terminate_codex(state: BridgeState) -> None:
    proc = state.process
    if proc.returncode is not None:
        return
    try:
        proc.terminate()
    except ProcessLookupError:
        return
    try:
        await asyncio.wait_for(proc.wait(), timeout=5)
    except asyncio.TimeoutError:
        with contextlib.suppress(ProcessLookupError):
            proc.kill()
        with contextlib.suppress(Exception):
            await proc.wait()


async def _close_clients(state: BridgeState) -> None:
    for client in list(state.clients.values()):
        with contextlib.suppress(Exception):
            client.writer.close()
        if client.sender_task is not None:
            client.sender_task.cancel()
        if client.reader_task is not None:
            client.reader_task.cancel()
    state.clients.clear()


def _install_signal_handlers(state: BridgeState) -> None:
    loop = asyncio.get_running_loop()

    def _request_shutdown() -> None:
        log.info("signal received — shutting down")
        state.shutdown_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, _request_shutdown)


def _spawn_tracked(state: BridgeState, coro: Any) -> asyncio.Task[Any]:
    task = asyncio.create_task(coro)
    state.background_tasks.add(task)
    task.add_done_callback(state.background_tasks.discard)
    return task


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="TCP fan-out bridge wrapping a stdio JSON-RPC child."
    )
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--redis-url", required=True)
    parser.add_argument("--redis-key", required=True, help="Full key including prefix")
    parser.add_argument("--port-min", type=int, required=True)
    parser.add_argument("--port-max", type=int, required=True)
    parser.add_argument("--idle-seconds", type=int, default=60)
    parser.add_argument("--startup-grace", type=int, default=30)
    parser.add_argument("--redis-ttl", type=int, default=30)
    parser.add_argument(
        "--child-cwd",
        default=None,
        help="cwd for the spawned child process (e.g. codex). Bridge itself "
             "stays in its parent cwd so module imports keep working.",
    )
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument(
        "command",
        nargs=argparse.REMAINDER,
        help="Command to spawn (after a `--`). Example: `-- codex app-server`",
    )
    args = parser.parse_args(argv)
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not args.command:
        parser.error("Missing child command after `--`")
    return args


def _write_port_to_stdout(port: int) -> None:
    """Print the bound port as the first stdout line so the parent FastAPI
    process can read it synchronously if it wants to (in addition to Redis)."""
    print(json.dumps({"__bridge__": "listening", "port": port}), flush=True)


async def _main_async(args: argparse.Namespace) -> int:
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s codex_socket_bridge: %(message)s",
        stream=sys.stderr,
    )

    sock, port = _bind_loopback_in_range(args.port_min, args.port_max)
    bridge_id = uuid.uuid4().hex

    redis_client = aioredis.from_url(
        args.redis_url, encoding="utf-8", decode_responses=True
    )

    # Try to claim the user's Redis key before spawning anything heavy.
    started_at_wall = time.time()
    entry = json.dumps(
        {
            "bridge_id": bridge_id,
            "host": "127.0.0.1",
            "port": port,
            "pid": os.getpid(),
            "started_at": started_at_wall,
        }
    )
    won = await _try_claim_key(
        redis_client, args.redis_key, entry, args.redis_ttl
    )
    if not won:
        log.info("redis key %s already held — exiting without spawning", args.redis_key)
        sock.close()
        await redis_client.aclose()
        return 2

    # Hand the listening socket to asyncio.
    process = await _spawn_codex(args.command, args.child_cwd)
    state_ref: dict[str, BridgeState] = {}
    server = await asyncio.start_server(
        lambda r, w: _handle_client(state_ref["state"], r, w),
        sock=sock,
    )
    state = BridgeState(
        bridge_id=bridge_id,
        started_at=time.monotonic(),  # idle math uses monotonic
        args=args,
        redis=redis_client,
        process=process,
        server=server,
        port=port,
    )
    state_ref["state"] = state

    _install_signal_handlers(state)
    _write_port_to_stdout(port)
    log.info(
        "bridge %s listening on 127.0.0.1:%d, codex pid=%d, redis key=%s",
        bridge_id,
        port,
        process.pid,
        args.redis_key,
    )

    _spawn_tracked(state, _heartbeat_loop(state))
    _spawn_tracked(state, _read_codex_stdout(state))
    _spawn_tracked(state, _read_codex_stderr(state))
    _spawn_tracked(state, _idle_watchdog(state))

    try:
        await _await_shutdown(state)
    finally:
        log.info("shutting down — closing %d client(s) and terminating codex", len(state.clients))
        server.close()
        with contextlib.suppress(Exception):
            await server.wait_closed()
        await _close_clients(state)
        await _terminate_codex(state)
        for task in list(state.background_tasks):
            task.cancel()
        for task in list(state.background_tasks):
            with contextlib.suppress(BaseException):
                await task
        await _deregister(state)
        with contextlib.suppress(Exception):
            await redis_client.aclose()

    return 0


def main() -> None:
    args = _parse_args(sys.argv[1:])
    try:
        rc = asyncio.run(_main_async(args))
    except KeyboardInterrupt:
        rc = 130
    sys.exit(rc)


if __name__ == "__main__":
    main()
