#!/usr/bin/env python3
"""Cron-driven release script for houseinus-api.

Run every few seconds via crontab (or a systemd timer) to pull the latest
release branch and deploy. Mirrors houseinus-web/release.js but targets the
API stack (systemd + uv + alembic) instead of a static build.

Usage:
    python3 release.py            # prod: release branch, service houseinus-api
    python3 release.py --dev      # dev:  dev-release branch, service houseinus-api-dev

Uses only the Python standard library so it runs even before `uv sync`.
Talks to the user-level systemd instance (`systemctl --user`), no sudo.

Flow on new commits:
    1. record current alembic revision
    2. systemctl --user stop <service>
    3. git pull --ff-only
    4. uv sync
    5. uv run alembic upgrade head
    6. systemctl --user start <service>
    7. sleep + systemctl --user status / is-active check
    8. HTTP GET /api/v1/health

On failure, stops the new service, git reset --hard to the previous head,
re-runs uv sync, and restarts the service. DB migrations are NOT auto-
reverted — operator must decide, and the current alembic revision is
included in the Telegram notification.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# `systemctl --user` needs XDG_RUNTIME_DIR. cron jobs don't inherit it by
# default, so set it before any subprocess call. Requires `loginctl
# enable-linger <user>` to be set up once so /run/user/<uid> exists.
os.environ.setdefault("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")

# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent
REMOTE_NAME = "origin"

TELEGRAM_BOT_TOKEN = "8705331578:AAFvjGr8nU8k4DU4pG3MUzeqcdfh4iLVBug"
TELEGRAM_RECIPIENTS: list[tuple[str, str]] = [
    ("Jeongmin", "8549321834"),
    ("Yeibeen", "8692181457"),
]

KST = timezone(timedelta(hours=9))

LOCK_FILE = PROJECT_ROOT / ".release.lock"
LOCK_STALE_SECONDS = 15 * 60

LOG_FILE_MAX_BYTES = 10 * 1024 * 1024
LOG_FILE_BACKUP_COUNT = 5

HEALTHCHECK_TIMEOUT = 10
HEALTHCHECK_RETRIES = 10
HEALTHCHECK_INTERVAL = 3

STATUS_WAIT_SECONDS = 3

TELEGRAM_TIMEOUT = 10
TELEGRAM_RETRY_COUNT = 3
TELEGRAM_RETRY_DELAY = 2


def env_config(is_dev: bool) -> dict[str, object]:
    if is_dev:
        return {
            "deploy_env": "dev",
            "release_branch": "dev-release",
            "log_file_name": "houseinus-release-dev.log",
            "service_name": "houseinus-api-dev",
            "health_port": 39080,
        }
    return {
        "deploy_env": "prod",
        "release_branch": "release",
        "log_file_name": "houseinus-release.log",
        "service_name": "houseinus-api",
        "health_port": 38080,
    }


# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------
def now_kst_str() -> str:
    return datetime.now(tz=KST).strftime("%Y-%m-%d %H:%M:%S +09:00")


def backup_path(log_path: Path, idx: int) -> Path:
    return log_path.with_name(f"{log_path.name}.{idx}")


def rotate_log_if_needed(log_path: Path, next_line: str) -> None:
    try:
        if not log_path.exists():
            return
        size = log_path.stat().st_size
        next_bytes = len((next_line + "\n").encode("utf-8"))
        if size + next_bytes < LOG_FILE_MAX_BYTES:
            return

        oldest = backup_path(log_path, LOG_FILE_BACKUP_COUNT)
        if oldest.exists():
            oldest.unlink()
        for i in range(LOG_FILE_BACKUP_COUNT - 1, 0, -1):
            src = backup_path(log_path, i)
            dst = backup_path(log_path, i + 1)
            if src.exists():
                src.rename(dst)
        log_path.rename(backup_path(log_path, 1))
    except Exception as exc:
        sys.stderr.write(
            f"[release] {now_kst_str()} failed to rotate {log_path.name}: {exc}\n"
        )


_log_lock = threading.Lock()


class Logger:
    def __init__(self, log_path: Path) -> None:
        self.log_path = log_path

    def __call__(self, message: str, *, is_error: bool = False) -> None:
        line = f"[release] {now_kst_str()} {message}"
        with _log_lock:
            try:
                rotate_log_if_needed(self.log_path, line)
                with open(self.log_path, "a", encoding="utf-8") as fp:
                    fp.write(line + "\n")
            except Exception as exc:
                sys.stderr.write(
                    f"[release] {now_kst_str()} failed to write log: {exc}\n"
                )
        stream = sys.stderr if is_error else sys.stdout
        if stream.isatty():
            stream.write(line + "\n")


# ------------------------------------------------------------------
# Lock
# ------------------------------------------------------------------
def is_process_alive(pid: int) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def acquire_lock(logger: Logger, branch: str) -> bool:
    while True:
        try:
            fd = os.open(
                LOCK_FILE,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                0o644,
            )
        except FileExistsError:
            try:
                raw = LOCK_FILE.read_text(encoding="utf-8")
                data = json.loads(raw) if raw else None
            except Exception:
                data = None

            if isinstance(data, dict) and isinstance(data.get("pid"), int):
                if is_process_alive(data["pid"]):
                    logger(f"another deploy is already running (pid: {data['pid']}), skipping")
                    return False

            try:
                stat = LOCK_FILE.stat()
                age = time.time() - stat.st_mtime
            except FileNotFoundError:
                continue

            if data is None and age < LOCK_STALE_SECONDS:
                logger("found a fresh but unreadable deploy lock, skipping")
                return False

            logger("found a stale deploy lock, removing it")
            try:
                LOCK_FILE.unlink()
            except FileNotFoundError:
                pass
            continue

        try:
            payload = json.dumps(
                {
                    "pid": os.getpid(),
                    "startedAt": datetime.now(tz=KST).isoformat(),
                    "branch": branch,
                },
                indent=2,
            )
            os.write(fd, payload.encode("utf-8"))
        finally:
            os.close(fd)
        return True


def release_lock(logger: Logger) -> None:
    try:
        LOCK_FILE.unlink()
    except FileNotFoundError:
        pass
    except Exception as exc:
        logger(f"lock cleanup warning: {exc}")


# ------------------------------------------------------------------
# Subprocess
# ------------------------------------------------------------------
def run_cmd(
    logger: Logger,
    cmd: list[str],
    *,
    cwd: Path = PROJECT_ROOT,
    env: dict[str, str] | None = None,
    capture: bool = False,
    allow_failure: bool = False,
) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)

    display = " ".join(cmd)

    try:
        if capture:
            proc = subprocess.run(
                cmd,
                cwd=str(cwd),
                env=merged,
                text=True,
                capture_output=True,
                check=False,
            )
        else:
            popen = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                env=merged,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )

            def pump(stream, is_err: bool) -> None:
                for raw in iter(stream.readline, ""):
                    trimmed = raw.rstrip("\r\n")
                    if trimmed:
                        logger(trimmed, is_error=is_err)
                stream.close()

            threads = [
                threading.Thread(target=pump, args=(popen.stdout, False)),
                threading.Thread(target=pump, args=(popen.stderr, True)),
            ]
            for t in threads:
                t.start()
            rc = popen.wait()
            for t in threads:
                t.join()
            proc = subprocess.CompletedProcess(cmd, rc, "", "")
    except FileNotFoundError as exc:
        raise RuntimeError(f"command not found: {cmd[0]} ({exc})") from exc

    if proc.returncode != 0 and not allow_failure:
        detail = ""
        if capture:
            detail = (proc.stderr or proc.stdout or "").strip()
        msg = f"{display} failed with exit code {proc.returncode}"
        if detail:
            msg = f"{msg}: {detail}"
        raise RuntimeError(msg)

    return proc


# ------------------------------------------------------------------
# Git helpers
# ------------------------------------------------------------------
def ensure_clean_worktree(logger: Logger) -> None:
    proc = run_cmd(logger, ["git", "status", "--porcelain"], capture=True)
    if proc.stdout.strip():
        for line in proc.stdout.strip().splitlines():
            logger(f"dirty worktree entry: {line}")
        raise RuntimeError(
            "working tree is dirty; aborting automated release to avoid overwriting local changes"
        )


def ensure_remote_ref(logger: Logger, branch: str) -> None:
    remote_ref = f"refs/remotes/{REMOTE_NAME}/{branch}"
    check = run_cmd(
        logger,
        ["git", "show-ref", "--verify", "--quiet", remote_ref],
        capture=True,
        allow_failure=True,
    )
    if check.returncode == 0:
        return

    logger(f"remote ref {REMOTE_NAME}/{branch} is missing locally, fetching it first")
    run_cmd(logger, ["git", "fetch", REMOTE_NAME, branch], capture=False)

    verify = run_cmd(
        logger,
        ["git", "show-ref", "--verify", "--quiet", remote_ref],
        capture=True,
        allow_failure=True,
    )
    if verify.returncode != 0:
        raise RuntimeError(f"remote branch {REMOTE_NAME}/{branch} does not exist")


def ensure_release_branch_tracking(logger: Logger, branch: str) -> None:
    ensure_remote_ref(logger, branch)
    remote_ref = f"{REMOTE_NAME}/{branch}"

    local = run_cmd(
        logger,
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        capture=True,
        allow_failure=True,
    )
    if local.returncode != 0:
        logger(f"creating local {branch} branch tracking {remote_ref}")
        run_cmd(
            logger,
            ["git", "checkout", "-b", branch, "--track", remote_ref],
            capture=False,
        )
    else:
        current = run_cmd(
            logger, ["git", "rev-parse", "--abbrev-ref", "HEAD"], capture=True
        ).stdout.strip()
        if current != branch:
            logger(f"switching branch from {current} to {branch}")
            run_cmd(logger, ["git", "checkout", branch], capture=False)

    upstream = run_cmd(
        logger,
        ["git", "for-each-ref", f"refs/heads/{branch}", "--format=%(upstream:short)"],
        capture=True,
    ).stdout.strip()
    if upstream != remote_ref:
        logger(f"setting {branch} to track {remote_ref}")
        run_cmd(
            logger,
            ["git", "branch", "--set-upstream-to", remote_ref, branch],
            capture=False,
        )


def fetch_latest(logger: Logger, branch: str) -> None:
    logger(f"fetching latest commits from {REMOTE_NAME}/{branch}")
    run_cmd(logger, ["git", "fetch", REMOTE_NAME, branch], capture=False)


def revision_state(logger: Logger, branch: str) -> tuple[int, int]:
    remote_ref = f"{REMOTE_NAME}/{branch}"
    proc = run_cmd(
        logger,
        ["git", "rev-list", "--left-right", "--count", f"{branch}...{remote_ref}"],
        capture=True,
    )
    parts = proc.stdout.split()
    ahead = int(parts[0]) if len(parts) >= 1 else 0
    behind = int(parts[1]) if len(parts) >= 2 else 0
    return ahead, behind


def head_sha(logger: Logger) -> str:
    return run_cmd(logger, ["git", "rev-parse", "HEAD"], capture=True).stdout.strip()


# ------------------------------------------------------------------
# systemctl / alembic
# ------------------------------------------------------------------
def systemctl(
    logger: Logger,
    action: str,
    service: str,
    *,
    allow_failure: bool = False,
) -> subprocess.CompletedProcess[str]:
    return run_cmd(
        logger,
        ["systemctl", "--user", action, service],
        capture=False,
        allow_failure=allow_failure,
    )


def systemctl_is_active(logger: Logger, service: str) -> str:
    proc = run_cmd(
        logger,
        ["systemctl", "--user", "is-active", service],
        capture=True,
        allow_failure=True,
    )
    return proc.stdout.strip() or "unknown"


def systemctl_status_dump(logger: Logger, service: str) -> None:
    """Run `systemctl --user status` and stream it to the log for debugging."""
    run_cmd(
        logger,
        ["systemctl", "--user", "status", "--no-pager", "--full", service],
        capture=False,
        allow_failure=True,
    )


def alembic_current(logger: Logger) -> str:
    proc = run_cmd(
        logger,
        ["uv", "run", "alembic", "current"],
        capture=True,
        allow_failure=True,
    )
    first_line = (proc.stdout or "").strip().splitlines()
    return first_line[0] if first_line else "unknown"


# ------------------------------------------------------------------
# Health check
# ------------------------------------------------------------------
def http_get_status(url: str, timeout: float) -> int:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code


def wait_for_health(logger: Logger, url: str) -> None:
    for attempt in range(1, HEALTHCHECK_RETRIES + 1):
        try:
            status = http_get_status(url, HEALTHCHECK_TIMEOUT)
            if 200 <= status < 500:
                logger(f"health check passed with status {status}")
                return
            logger(f"health check attempt {attempt}/{HEALTHCHECK_RETRIES} returned {status}")
        except Exception as exc:
            logger(f"health check attempt {attempt}/{HEALTHCHECK_RETRIES} failed: {exc}")
        if attempt < HEALTHCHECK_RETRIES:
            time.sleep(HEALTHCHECK_INTERVAL)
    raise RuntimeError(f"service health check failed for {url}")


# ------------------------------------------------------------------
# Telegram
# ------------------------------------------------------------------
def shorten(text: str, max_len: int = 400) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= max_len:
        return normalized
    return normalized[: max_len - 3] + "..."


def short_sha(sha: str | None) -> str:
    return sha[:7] if sha else "unknown"


def telegram_post(chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    body = json.dumps(
        {"chat_id": chat_id, "text": text, "disable_web_page_preview": True}
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=TELEGRAM_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        parsed = None
        try:
            parsed = json.loads(raw) if raw else None
        except Exception:
            parsed = None
        if not (200 <= resp.status < 300):
            raise RuntimeError(
                f"telegram returned {resp.status}: {shorten(raw, 200)}"
            )
        if not isinstance(parsed, dict) or not parsed.get("ok"):
            desc = (parsed or {}).get("description", raw)
            raise RuntimeError(
                f"telegram ok=false ({resp.status}): {shorten(desc, 200)}"
            )


def notify_telegram(logger: Logger, text: str) -> None:
    for name, chat_id in TELEGRAM_RECIPIENTS:
        last_error: Exception | None = None
        for attempt in range(1, TELEGRAM_RETRY_COUNT + 1):
            try:
                telegram_post(chat_id, text)
                logger(f"telegram notification sent to {name}")
                break
            except Exception as exc:
                last_error = exc
                if attempt < TELEGRAM_RETRY_COUNT:
                    logger(
                        f"telegram attempt {attempt}/{TELEGRAM_RETRY_COUNT} to {name} failed, retrying: {exc}"
                    )
                    time.sleep(TELEGRAM_RETRY_DELAY)
        else:
            logger(f"telegram notification failed for {name}: {last_error}")


def build_notification(
    *,
    success: bool,
    deploy_env: str,
    branch: str,
    commits: int,
    previous_head: str | None,
    current_head: str | None,
    health_url: str,
    alembic_before: str | None,
    alembic_after: str | None,
    error_message: str | None = None,
    rollback_status: str | None = None,
) -> str:
    lines = [
        f"[houseinus-api] release {'success' if success else 'failed'}",
        f"env: {deploy_env}",
        f"branch: {branch}",
        f"commits: {commits}",
        f"time: {now_kst_str()}",
        f"health: {health_url}",
    ]
    if previous_head:
        lines.append(f"from: {short_sha(previous_head)}")
    if current_head:
        lines.append(f"to: {short_sha(current_head)}")
    if alembic_before:
        lines.append(f"alembic before: {shorten(alembic_before, 120)}")
    if alembic_after:
        lines.append(f"alembic after: {shorten(alembic_after, 120)}")
    if not success and rollback_status:
        lines.append(f"rollback: {rollback_status}")
    if not success and error_message:
        lines.append(f"error: {shorten(error_message)}")
    return "\n".join(lines)


# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="houseinus-api release orchestrator")
    parser.add_argument("--dev", action="store_true", help="deploy dev-release branch")
    parser.add_argument(
        "--service-name",
        default=None,
        help="systemd service name override (default: houseinus-api or houseinus-api-dev)",
    )
    parser.add_argument(
        "--health-port",
        type=int,
        default=None,
        help="override health check port (default: 38080 prod / 39080 dev)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cfg = env_config(args.dev)

    service = args.service_name or cfg["service_name"]
    health_port = args.health_port or cfg["health_port"]
    branch = cfg["release_branch"]
    deploy_env = cfg["deploy_env"]
    log_path = PROJECT_ROOT / cfg["log_file_name"]
    health_url = f"http://127.0.0.1:{health_port}/api/v1/health"

    logger = Logger(log_path)

    if not acquire_lock(logger, branch):
        return 0

    previous_head: str | None = None
    current_head: str | None = None
    commit_count = 0
    service_was_stopped = False
    pulled = False
    migrated = False
    started_new = False
    rollback_status = "not needed"
    alembic_before: str | None = None
    alembic_after: str | None = None

    try:
        logger(f"starting deploy for {branch}")
        ensure_clean_worktree(logger)
        ensure_release_branch_tracking(logger, branch)
        fetch_latest(logger, branch)

        ahead, behind = revision_state(logger, branch)
        commit_count = behind

        if ahead > 0 and behind > 0:
            raise RuntimeError(
                f"{branch} has diverged from {REMOTE_NAME}/{branch}; manual intervention required"
            )
        if ahead > 0:
            raise RuntimeError(
                f"{branch} is ahead of {REMOTE_NAME}/{branch}; automated deploy aborted"
            )
        if behind == 0:
            logger(f"no new commits on {REMOTE_NAME}/{branch}, skipping deploy")
            return 0

        previous_head = head_sha(logger)
        logger(f"{behind} new commit(s) detected, starting deploy")

        alembic_before = alembic_current(logger)
        logger(f"current alembic revision: {alembic_before}")

        logger(f"stopping {service}")
        systemctl(logger, "stop", service, allow_failure=True)
        service_was_stopped = True

        logger("pulling latest")
        run_cmd(
            logger,
            ["git", "pull", "--ff-only", REMOTE_NAME, branch],
            capture=False,
        )
        pulled = True

        logger("syncing python dependencies")
        run_cmd(logger, ["uv", "sync"], capture=False)

        logger("running alembic upgrade head")
        run_cmd(
            logger, ["uv", "run", "alembic", "upgrade", "head"], capture=False
        )
        migrated = True
        alembic_after = alembic_current(logger)
        logger(f"alembic revision after migration: {alembic_after}")

        logger(f"starting {service}")
        systemctl(logger, "start", service)
        started_new = True

        logger(f"waiting {STATUS_WAIT_SECONDS}s before status check")
        time.sleep(STATUS_WAIT_SECONDS)

        systemctl_status_dump(logger, service)
        state = systemctl_is_active(logger, service)
        if state != "active":
            raise RuntimeError(f"systemctl is-active returned '{state}' (expected 'active')")
        logger(f"service is active")

        wait_for_health(logger, health_url)

        current_head = head_sha(logger)
        logger("release deploy completed successfully")

        notify_telegram(
            logger,
            build_notification(
                success=True,
                deploy_env=deploy_env,
                branch=branch,
                commits=commit_count,
                previous_head=previous_head,
                current_head=current_head,
                health_url=health_url,
                alembic_before=alembic_before,
                alembic_after=alembic_after,
            ),
        )
        return 0

    except Exception as error:
        logger(f"deploy failed: {error}", is_error=True)

        if pulled and previous_head:
            try:
                rollback_status = "started"

                if started_new:
                    logger(f"stopping failed {service}")
                    systemctl(logger, "stop", service, allow_failure=True)

                logger(f"rolling back git to {previous_head}")
                run_cmd(
                    logger,
                    ["git", "reset", "--hard", previous_head],
                    capture=False,
                )

                logger("reinstalling python dependencies for rolled back revision")
                run_cmd(logger, ["uv", "sync"], capture=False, allow_failure=True)

                logger(f"restarting {service} with rolled back code")
                systemctl(logger, "start", service, allow_failure=True)

                if migrated:
                    rollback_status = (
                        "code reverted; DB migration NOT rolled back — manual check required"
                    )
                else:
                    rollback_status = "completed"
            except Exception as rollback_error:
                rollback_status = f"failed: {shorten(str(rollback_error), 120)}"
                logger(f"rollback failed: {rollback_error}", is_error=True)
        elif service_was_stopped:
            try:
                logger(f"restarting {service} (nothing was pulled)")
                systemctl(logger, "start", service, allow_failure=True)
                rollback_status = "service restarted (no code change)"
            except Exception as restart_error:
                rollback_status = f"service restart failed: {shorten(str(restart_error), 120)}"
                logger(f"service restart failed: {restart_error}", is_error=True)

        if commit_count > 0:
            notify_telegram(
                logger,
                build_notification(
                    success=False,
                    deploy_env=deploy_env,
                    branch=branch,
                    commits=commit_count,
                    previous_head=previous_head,
                    current_head=current_head,
                    health_url=health_url,
                    alembic_before=alembic_before,
                    alembic_after=alembic_after,
                    error_message=str(error),
                    rollback_status=rollback_status,
                ),
            )
        return 1
    finally:
        release_lock(logger)


if __name__ == "__main__":
    sys.exit(main())
