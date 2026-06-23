#!/usr/bin/env python3
"""Install houseinus-api as a *user* systemd service (no sudo).

Usage:
    python3 install_service.py
    python3 install_service.py --name houseinus-api-dev
    python3 install_service.py --dev    # shortcut for --name houseinus-api-dev

What it does:
    1. Reads ./houseinus-api.service (template in this repo).
    2. Substitutes {houseinus-api-root} with this directory's absolute path.
    3. Writes ~/.config/systemd/user/<name>.service.
    4. Runs `systemctl --user daemon-reload` and `systemctl --user enable <name>`.
    5. If the service was already running, restarts it; otherwise prints
       instructions to start it.

Stdlib only — no external dependencies.

IMPORTANT: for the service to keep running after logout or start at boot,
run ONCE as root:

    sudo loginctl enable-linger $USER
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_NAME = "houseinus-api"
DEV_NAME = "houseinus-api-dev"
DEFAULT_PORT = 38080
DEV_PORT = 39080
TEMPLATE_FILE = f"{DEFAULT_NAME}.service"
USER_UNIT_DIR = Path.home() / ".config" / "systemd" / "user"
ROOT_PLACEHOLDER = "{houseinus-api-root}"
PORT_PLACEHOLDER = "{port}"


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def systemctl_user_is_active(service: str) -> bool:
    result = subprocess.run(
        ["systemctl", "--user", "is-active", "--quiet", service],
        check=False,
    )
    return result.returncode == 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Install houseinus-api as a user systemd service.",
    )
    parser.add_argument(
        "--name",
        default=None,
        help=f"systemd service name (default: {DEFAULT_NAME}; or {DEV_NAME} with --dev)",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help=(
            f"shortcut: sets --name to {DEV_NAME} and --port to {DEV_PORT} "
            f"if those are not given"
        ),
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"API port (default: {DEFAULT_PORT}; or {DEV_PORT} with --dev)",
    )
    return parser.parse_args()


def resolve_service_name(args: argparse.Namespace) -> str:
    if args.name:
        return args.name
    if args.dev:
        return DEV_NAME
    return DEFAULT_NAME


def resolve_port(args: argparse.Namespace) -> int:
    if args.port is not None:
        return args.port
    if args.dev:
        return DEV_PORT
    return DEFAULT_PORT


def ensure_xdg_runtime_dir() -> None:
    """systemctl --user needs XDG_RUNTIME_DIR. Set it if unset."""
    os.environ.setdefault("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}")


def main() -> None:
    args = parse_args()

    if os.geteuid() == 0:
        die(
            "do NOT run this as root. Run as your normal user — this installs a "
            "user-level systemd unit under ~/.config/systemd/user/."
        )

    ensure_xdg_runtime_dir()

    if shutil.which("systemctl") is None:
        die("systemctl not found — this script requires systemd")

    service_name = resolve_service_name(args)
    port = resolve_port(args)
    installed_file_name = f"{service_name}.service"

    here = Path(__file__).resolve().parent
    template_path = here / TEMPLATE_FILE
    if not template_path.exists():
        die(f"template {template_path} not found")

    venv_python = here / ".venv" / "bin" / "python"
    if not venv_python.exists():
        print(
            f"WARNING: {venv_python} does not exist. "
            f"Run `uv sync` in {here} before starting the service.",
            file=sys.stderr,
        )

    template = template_path.read_text(encoding="utf-8")
    for placeholder in (ROOT_PLACEHOLDER, PORT_PLACEHOLDER):
        if placeholder not in template:
            die(f"template {template_path} does not contain {placeholder!r}")

    substituted = (
        template
        .replace(ROOT_PLACEHOLDER, str(here))
        .replace(PORT_PLACEHOLDER, str(port))
    )

    USER_UNIT_DIR.mkdir(parents=True, exist_ok=True)
    target = USER_UNIT_DIR / installed_file_name
    print(f"Installing user service '{service_name}' on port {port}")
    print(f"Writing {target}")
    target.write_text(substituted, encoding="utf-8")
    target.chmod(0o644)

    run(["systemctl", "--user", "daemon-reload"])
    run(["systemctl", "--user", "enable", service_name])

    if systemctl_user_is_active(service_name):
        print(f"Service was running; restarting…")
        run(["systemctl", "--user", "restart", service_name])
    else:
        print()
        print(f"Installed and enabled. To start now:")
        print(f"  systemctl --user start {service_name}")

    print()
    print("One-time setup (if not already done) — allows the service to run")
    print("at boot and survive logout. Requires root ONCE:")
    print(f"  sudo loginctl enable-linger {os.environ.get('USER', '')}")
    print()
    print("Useful commands (no sudo):")
    print(f"  systemctl --user status {service_name}")
    print(f"  systemctl --user restart {service_name}")
    print(f"  systemctl --user stop {service_name}")
    print(f"  journalctl --user -u {service_name} -f")


if __name__ == "__main__":
    main()
