"""Standard error envelope for the houseinus API.

All endpoints should raise ``ApiException(code=...)`` (or let the global
``HTTPException`` handler fall back to ``code="http-<status>"``). The wire
format is always ``{"code": "<kebab-or-snake>", "detail": "<dev message>"}``;
the frontend keys off ``code`` to render a localized user-facing message.
See ``houseinus-web/AGENTS.md`` for the full convention.
"""
from __future__ import annotations

import re
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Codes are machine-readable identifiers, not user-facing copy.
_CODE_PATTERN = re.compile(r"^[a-z][a-z0-9_-]*$")


class ApiException(HTTPException):
    """HTTPException that carries a stable error ``code`` for the frontend.

    Usage::

        raise ApiException(404, "self-publish-not-found")
        raise ApiException(409, "slug-taken", "slug already in use by #abc123")

    ``detail`` is optional and is meant for developers (logs, tooling). The
    frontend should render messages off ``code``, never ``detail``.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        detail: str | None = None,
    ) -> None:
        if not _CODE_PATTERN.match(code):
            raise ValueError(
                f"ApiException code must match {_CODE_PATTERN.pattern!r}, got {code!r}"
            )
        super().__init__(status_code=status_code, detail=detail or code)
        self.code = code


def _envelope(code: str, detail: Any) -> dict[str, Any]:
    return {"code": code, "detail": detail}


async def _api_exception_handler(_: Request, exc: ApiException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(exc.code, exc.detail),
    )


async def _http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    # Plain FastAPI HTTPException — synthesize a code from the status so the
    # frontend can still branch deterministically (e.g. "http-401").
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(f"http-{exc.status_code}", exc.detail),
    )


async def _validation_exception_handler(
    _: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_envelope("validation-error", exc.errors()),
    )


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiException, _api_exception_handler)
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)


__all__ = ["ApiException", "install_error_handlers"]
