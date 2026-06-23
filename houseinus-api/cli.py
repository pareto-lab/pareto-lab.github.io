"""houseinus-api interactive CLI.

Run with no arguments — pick an action from the menu:

    uv run python cli.py

Currently supports creating Owner and Admin accounts. More commands can be
added by extending the `MENU` and writing new `do_*` coroutines.
"""
from __future__ import annotations

import asyncio
import getpass
import sys
from typing import Awaitable, Callable

from app.core.security import hash_password
from app.database import SessionFactory, engine
from app.models import User, UserRole, UserStatus
from app.services import user_service
from app.utils.time import utcnow

MIN_PASSWORD_LEN = 8

# ---------------------------------------------------------------- ANSI helpers


def _supports_color() -> bool:
    return sys.stdout.isatty()


def color(text: str, code: str) -> str:
    if not _supports_color():
        return text
    return f"\033[{code}m{text}\033[0m"


def bold(t: str) -> str:
    return color(t, "1")


def dim(t: str) -> str:
    return color(t, "2")


def green(t: str) -> str:
    return color(t, "32")


def red(t: str) -> str:
    return color(t, "31")


def cyan(t: str) -> str:
    return color(t, "36")


# -------------------------------------------------------------------- prompts


def line(char: str = "─", n: int = 60) -> None:
    print(dim(char * n))


def header() -> None:
    print()
    line("═")
    print(" " + bold("houseinus-api CLI"))
    line("═")


def prompt_email() -> str:
    while True:
        v = input(cyan("이메일: ")).strip().lower()
        if "@" in v and "." in v.split("@")[-1]:
            return v
        print(red("  ! 올바른 이메일이 아닙니다. 다시 입력해주세요."))


def prompt_password() -> str:
    while True:
        first = getpass.getpass(cyan(f"비밀번호 (최소 {MIN_PASSWORD_LEN}자): "))
        if len(first) < MIN_PASSWORD_LEN:
            print(red(f"  ! 최소 {MIN_PASSWORD_LEN}자 이상이어야 합니다."))
            continue
        second = getpass.getpass(cyan("비밀번호 확인:               "))
        if first != second:
            print(red("  ! 두 비밀번호가 일치하지 않습니다. 다시 입력해주세요."))
            continue
        return first


def prompt_display_name(default: str) -> str:
    v = input(cyan(f"표시 이름 ") + dim(f"[{default}]") + cyan(": ")).strip()
    return v or default


def confirm(prompt: str) -> bool:
    while True:
        v = input(cyan(prompt) + dim(" [y/N]: ")).strip().lower()
        if v in ("y", "yes"):
            return True
        if v in ("n", "no", ""):
            return False
        print(red("  ! y 또는 n 으로 답해주세요."))


# ------------------------------------------------------------------- actions


async def do_create_account(role: UserRole) -> None:
    label = "Owner" if role == UserRole.owner else "Admin"
    print()
    line()
    print(" " + bold(f"{label} 계정 생성"))
    line()

    email = prompt_email()

    # Pre-check before asking for password — saves typing a password the
    # user can't actually use.
    async with SessionFactory() as db:
        existing = await user_service.get_user_by_email(db, email)
    if existing is not None:
        print(
            red(
                f"\n  ✗ 이미 존재하는 계정입니다 "
                f"(id={existing.id}, role={existing.role.value})."
            )
        )
        print(dim("    권한 변경은 관리자 페이지(Owner 전용) 또는 DB로 처리하세요."))
        return

    password = prompt_password()
    default_name = email.split("@")[0]
    display_name = prompt_display_name(default_name)

    print()
    line()
    print(f"  역할:      {bold(role.value)}")
    print(f"  이메일:    {email}")
    print(f"  표시 이름: {display_name}")
    line()
    if not confirm("\n위 정보로 계정을 생성할까요?"):
        print(dim("  취소되었습니다."))
        return

    try:
        async with SessionFactory() as db:
            user = User(
                email=email,
                password_hash=hash_password(password),
                display_name=display_name,
                status=UserStatus.active,
                role=role,
                # CLI 로 만든 계정은 운영자가 만든 계정이므로 메일 인증을 건너뜀.
                email_verified_at=utcnow(),
            )
            db.add(user)
            await db.flush()
            await user_service.ensure_admin_profile(db, user=user)
            await db.commit()
            await db.refresh(user)
    except Exception as exc:  # noqa: BLE001
        print(red(f"\n  ✗ DB 오류로 실패했습니다: {exc}"))
        return

    print()
    print(green(f"  ✓ {label} 계정이 생성되었습니다."))
    print(f"    id:   {dim(str(user.id))}")
    print(f"    name: {user.display_name}")
    print(f"    role: {user.role.value}")


async def do_create_owner() -> None:
    await do_create_account(UserRole.owner)


async def do_create_admin() -> None:
    await do_create_account(UserRole.admin)


# --------------------------------------------------------------------- menu


MENU: list[tuple[str, str, Callable[[], Awaitable[None]]]] = [
    ("1", "Owner 계정 생성  (최고 권한)", do_create_owner),
    ("2", "Admin 계정 생성", do_create_admin),
]


def show_menu() -> str:
    print("\n" + bold("무엇을 하시겠어요?"))
    for key, label, _ in MENU:
        print(f"  {bold(key)}) {label}")
    print(f"  {bold('q')}) 종료")
    print()
    return input(cyan("선택: ")).strip().lower()


async def amain() -> None:
    header()
    handlers = {key: fn for key, _, fn in MENU}
    try:
        while True:
            try:
                choice = show_menu()
            except (EOFError, KeyboardInterrupt):
                print()
                return

            if choice in ("q", "quit", "exit"):
                print(dim("종료합니다."))
                return

            handler = handlers.get(choice)
            if handler is None:
                print(red("  ! 메뉴 번호를 다시 확인해주세요."))
                continue

            try:
                await handler()
            except (EOFError, KeyboardInterrupt):
                print(dim("\n  ↩ 취소되었습니다."))
                continue
    finally:
        await engine.dispose()


def main() -> None:
    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
