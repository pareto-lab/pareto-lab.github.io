"""SMTP-backed email sender. Disabled when SMTP host/credentials are empty."""
from __future__ import annotations

import logging
import ssl
from email.message import EmailMessage

import aiosmtplib
import certifi

from app.config import settings

log = logging.getLogger(__name__)

# Build an SSL context using certifi's CA bundle. The Python.framework build on
# macOS doesn't pick up the system trust store, so an out-of-the-box
# `ssl.create_default_context()` fails with CERTIFICATE_VERIFY_FAILED against
# Gmail's SMTP. Pointing at certifi avoids needing to run the python.org
# "Install Certificates.command" on every dev machine.
_TLS_CONTEXT = ssl.create_default_context(cafile=certifi.where())


class EmailNotConfigured(RuntimeError):
    pass


async def send_email(*, to: str, subject: str, text: str, html: str) -> None:
    cfg = settings.email
    if not cfg.enabled:
        raise EmailNotConfigured(
            "SMTP not configured (set email.smtp_host / smtp_username / smtp_password in config.json)"
        )

    msg = EmailMessage()
    msg["From"] = f"{cfg.from_name} <{cfg.from_email}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    try:
        await aiosmtplib.send(
            msg,
            hostname=cfg.smtp_host,
            port=cfg.smtp_port,
            username=cfg.smtp_username,
            password=cfg.smtp_password,
            start_tls=cfg.smtp_use_starttls,
            use_tls=cfg.smtp_use_ssl,
            tls_context=_TLS_CONTEXT,
        )
    except ssl.SSLError as exc:
        await _notify_admins_smtp_failure(exc, ssl_error=True)
        raise
    except Exception as exc:
        await _notify_admins_smtp_failure(exc, ssl_error=False)
        raise


async def _notify_admins_smtp_failure(exc: BaseException, *, ssl_error: bool) -> None:
    """Best-effort Telegram alert to operators when SMTP delivery breaks.

    Imported lazily so this module stays usable in contexts where the telegram
    service can't be reached (tests, CLI scripts).
    """
    from app.services import telegram_service

    cfg = settings.email
    summary = str(exc)[:300] or exc.__class__.__name__
    lines = [
        "🚨 <b>메일 발송 실패</b>",
        f"호스트: {cfg.smtp_host}:{cfg.smtp_port}",
        f"에러: <code>{telegram_service._e(summary)}</code>",
    ]
    if ssl_error:
        lines.append("")
        lines.append("CA 인증서 검증 실패로 보입니다. 서버에서:")
        lines.append("<code>cd houseinus-api &amp;&amp; uv lock --upgrade-package certifi &amp;&amp; uv sync</code>")
        lines.append("후 서비스를 재시작하세요.")
    try:
        await telegram_service.notify_admins_system("\n".join(lines))
    except Exception as notify_exc:  # noqa: BLE001
        log.warning("failed to send SMTP-failure telegram alert: %s", notify_exc)


async def send_verification_code_email(
    *, to: str, code: str, purpose: str, lifetime_minutes: int
) -> None:
    purpose_label = {
        "signup": "회원가입",
        "reset": "비밀번호 재설정",
    }.get(purpose, "이메일 인증")
    subject = f"[House in Us] {purpose_label} 인증번호: {code}"
    text = (
        f"{purpose_label} 인증번호는 다음과 같습니다.\n\n"
        f"{code}\n\n"
        f"인증번호는 {lifetime_minutes}분간 유효합니다. "
        f"본인이 요청한 것이 아니라면 이 메일을 무시해주세요."
    )
    html = f"""\
<!doctype html>
<html lang="ko">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#222;line-height:1.6;padding:24px;">
    <p>{purpose_label} 인증번호입니다.</p>
    <p style="font-size:28px;font-weight:600;letter-spacing:6px;background:#f6f5f1;padding:16px 24px;border-radius:6px;display:inline-block;">
      {code}
    </p>
    <p style="color:#666;">인증번호는 <strong>{lifetime_minutes}분</strong>간 유효합니다.</p>
    <p style="color:#666;">본인이 요청한 것이 아니라면 이 메일을 무시해주세요.</p>
  </body>
</html>
"""
    await send_email(to=to, subject=subject, text=text, html=html)
