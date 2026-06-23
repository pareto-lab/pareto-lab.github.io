#!/usr/bin/env python3
"""Publish master → release (prod) or master → dev-release (dev).

Usage:
    python3 publish.py --dev     # master → dev-release (and push)
    python3 publish.py --prod    # master → release (and push)

For safety, running without a flag is rejected — it would be ambiguous whether
you meant to deploy to dev or prod. You must pick one explicitly.

Mirrors houseinus-web/publish.js but in Python and stdlib-only.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
SOURCE_BRANCH = "master"
REMOTE_NAME = "origin"
KST = timezone(timedelta(hours=9))


# ------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------
def now_kst_str() -> str:
    return datetime.now(tz=KST).strftime("%Y-%m-%d %H:%M:%S +09:00")


def log(message: str, *, is_error: bool = False) -> None:
    stream = sys.stderr if is_error else sys.stdout
    stream.write(f"[publish] {now_kst_str()} {message}\n")
    stream.flush()


# ------------------------------------------------------------------
# Subprocess
# ------------------------------------------------------------------
def run_cmd(
    cmd: list[str],
    *,
    capture: bool = False,
    allow_failure: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command. When capture=False, stdio is inherited (shown live)."""
    try:
        if capture:
            proc = subprocess.run(
                cmd,
                cwd=str(PROJECT_ROOT),
                text=True,
                capture_output=True,
                check=False,
            )
        else:
            proc = subprocess.run(
                cmd,
                cwd=str(PROJECT_ROOT),
                check=False,
            )
            # Build a CompletedProcess with empty strings so callers
            # using `.stdout.strip()` don't crash.
            proc = subprocess.CompletedProcess(cmd, proc.returncode, "", "")
    except FileNotFoundError as exc:
        raise RuntimeError(f"command not found: {cmd[0]} ({exc})") from exc

    if proc.returncode != 0 and not allow_failure:
        detail = ""
        if capture:
            detail = (proc.stderr or proc.stdout or "").strip()
        msg = f"{' '.join(cmd)} failed with exit code {proc.returncode}"
        if detail:
            msg = f"{msg}: {detail}"
        raise RuntimeError(msg)

    return proc


# ------------------------------------------------------------------
# Git helpers
# ------------------------------------------------------------------
def current_branch() -> str:
    return run_cmd(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"], capture=True
    ).stdout.strip()


def ensure_started_on_master() -> None:
    branch = current_branch()
    if branch != SOURCE_BRANCH:
        raise RuntimeError(
            f"publish.py must be started on {SOURCE_BRANCH}; current branch is {branch}"
        )


def ensure_clean_worktree() -> None:
    proc = run_cmd(["git", "status", "--porcelain"], capture=True)
    if not proc.stdout.strip():
        return
    for line in proc.stdout.strip().splitlines():
        log(f"dirty worktree entry: {line}", is_error=True)
    raise RuntimeError("working tree is dirty; aborting publish")


def ensure_remote_ref(remote_ref: str, branch: str) -> None:
    check = run_cmd(
        ["git", "show-ref", "--verify", "--quiet", f"refs/remotes/{remote_ref}"],
        capture=True,
        allow_failure=True,
    )
    if check.returncode == 0:
        return

    log(f"remote ref {remote_ref} is missing locally, fetching it first")
    run_cmd(["git", "fetch", REMOTE_NAME, branch])

    verify = run_cmd(
        ["git", "show-ref", "--verify", "--quiet", f"refs/remotes/{remote_ref}"],
        capture=True,
        allow_failure=True,
    )
    if verify.returncode != 0:
        raise RuntimeError(f"remote branch {remote_ref} does not exist")


def ensure_tracking_branch(branch: str, remote_ref: str) -> None:
    ensure_remote_ref(remote_ref, branch)

    local = run_cmd(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        capture=True,
        allow_failure=True,
    )
    if local.returncode != 0:
        log(f"creating local {branch} branch and tracking {remote_ref}")
        run_cmd(["git", "checkout", "-b", branch, "--track", remote_ref])
    else:
        if current_branch() != branch:
            log(f"switching branch to {branch}")
            run_cmd(["git", "checkout", branch])

    upstream = run_cmd(
        [
            "git",
            "for-each-ref",
            f"refs/heads/{branch}",
            "--format=%(upstream:short)",
        ],
        capture=True,
    ).stdout.strip()
    if upstream != remote_ref:
        log(f"setting {branch} to track {remote_ref}")
        run_cmd(["git", "branch", "--set-upstream-to", remote_ref, branch])


def fast_forward_current(branch: str) -> None:
    log(f"updating {branch} from origin")
    run_cmd(["git", "pull", "--ff-only", REMOTE_NAME, branch])


def merge_in_progress() -> bool:
    proc = run_cmd(
        ["git", "rev-parse", "-q", "--verify", "MERGE_HEAD"],
        capture=True,
        allow_failure=True,
    )
    return proc.returncode == 0


# ------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Merge master into release/dev-release and push.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="master를 dev-release 브랜치로 배포",
    )
    parser.add_argument(
        "--prod",
        action="store_true",
        help="master를 release 브랜치로 배포",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.dev and args.prod:
        print(
            "ERROR: --dev 와 --prod 는 동시에 쓸 수 없다. 하나만 지정하세요.",
            file=sys.stderr,
        )
        return 2

    if not args.dev and not args.prod:
        print(
            "ERROR: 안전상 이유로 --dev 또는 --prod 옵션이 반드시 필요하다.\n"
            "  python3 publish.py --dev     # master → dev-release\n"
            "  python3 publish.py --prod    # master → release",
            file=sys.stderr,
        )
        return 2

    target_branch = "dev-release" if args.dev else "release"
    remote_source = f"{REMOTE_NAME}/{SOURCE_BRANCH}"
    remote_target = f"{REMOTE_NAME}/{target_branch}"

    should_return_to_master = False

    try:
        log(f"starting publish from {SOURCE_BRANCH} to {target_branch}")
        ensure_started_on_master()
        ensure_clean_worktree()

        log("fetching latest refs from origin")
        run_cmd(["git", "fetch", REMOTE_NAME, SOURCE_BRANCH, target_branch])

        ensure_tracking_branch(SOURCE_BRANCH, remote_source)
        fast_forward_current(SOURCE_BRANCH)

        ensure_tracking_branch(target_branch, remote_target)
        should_return_to_master = True
        fast_forward_current(target_branch)

        log(f"merging {SOURCE_BRANCH} into {target_branch}")
        run_cmd(["git", "merge", "--no-ff", "--no-edit", SOURCE_BRANCH])

        log(f"pushing {target_branch} to {remote_target}")
        run_cmd(["git", "push", REMOTE_NAME, target_branch])

        run_cmd(["git", "checkout", SOURCE_BRANCH])
        should_return_to_master = False
        log(f"publish completed successfully for {target_branch}")
        return 0

    except Exception as error:
        log(f"publish failed: {error}", is_error=True)

        try:
            if merge_in_progress():
                log("merge conflict detected, aborting merge", is_error=True)
                try:
                    run_cmd(["git", "merge", "--abort"])
                except Exception as abort_error:
                    log(f"merge abort failed: {abort_error}", is_error=True)
        except Exception:
            pass

        if should_return_to_master:
            try:
                if current_branch() != SOURCE_BRANCH:
                    log(f"returning to {SOURCE_BRANCH}", is_error=True)
                    run_cmd(["git", "checkout", SOURCE_BRANCH])
            except Exception as checkout_error:
                log(
                    f"failed to switch back to {SOURCE_BRANCH}: {checkout_error}",
                    is_error=True,
                )

        return 1


if __name__ == "__main__":
    sys.exit(main())
