"""Local filesystem storage for property images and files.

Files are stored under ``<base_path>/properties/<property_id>/<asset_id>.<ext>``.
Returned ``storage_key`` is the path relative to ``base_path`` — combined with
``StorageConfig.public_url_prefix`` to form the public URL.

Switching to S3 later means swapping the body of these functions; the
``storage_key`` field stays as the canonical pointer.
"""
from __future__ import annotations

import logging
import mimetypes
import uuid
from pathlib import Path

from app.config import PROJECT_ROOT, settings

log = logging.getLogger(__name__)

EXTENSION_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


def base_dir() -> Path:
    return settings.storage.resolve_base_path(PROJECT_ROOT)


def _ext_for(filename: str, mime_type: str) -> str:
    if mime_type in EXTENSION_BY_MIME:
        return EXTENSION_BY_MIME[mime_type]
    guessed = mimetypes.guess_extension(mime_type or "")
    if guessed:
        return guessed
    suffix = Path(filename).suffix
    return suffix.lower() if suffix else ".bin"


def storage_key_for_asset(
    property_id: uuid.UUID,
    asset_id: uuid.UUID,
    *,
    filename: str,
    mime_type: str,
) -> str:
    ext = _ext_for(filename, mime_type)
    return f"properties/{property_id}/{asset_id}{ext}"


def save_bytes(storage_key: str, content: bytes) -> Path:
    """Write ``content`` to disk at ``storage_key``. Returns absolute path."""
    target = base_dir() / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target


def copy_local_file(src: Path, storage_key: str) -> Path:
    """Copy an existing file (e.g. from the seed script) into storage."""
    target = base_dir() / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(src.read_bytes())
    return target


def delete(storage_key: str) -> None:
    target = base_dir() / storage_key
    try:
        target.unlink()
    except FileNotFoundError:
        log.warning("storage key not found on delete: %s", storage_key)


def public_url(storage_key: str) -> str:
    prefix = settings.storage.public_url_prefix.rstrip("/")
    return f"{prefix}/{storage_key}"


def validate_image_upload(filename: str, mime_type: str, byte_size: int) -> None:
    cfg = settings.storage
    if byte_size > cfg.max_upload_bytes:
        raise ValueError(
            f"file too large: {byte_size} bytes > limit {cfg.max_upload_bytes}"
        )
    if mime_type not in cfg.allowed_image_types:
        raise ValueError(
            f"unsupported image type: {mime_type!r}; "
            f"allowed: {cfg.allowed_image_types}"
        )
    if not filename:
        raise ValueError("filename is required")


def validate_file_upload(filename: str, mime_type: str, byte_size: int) -> None:
    cfg = settings.storage
    if byte_size > cfg.max_upload_bytes:
        raise ValueError(
            f"file too large: {byte_size} bytes > limit {cfg.max_upload_bytes}"
        )
    if mime_type not in cfg.allowed_file_types:
        raise ValueError(
            f"unsupported file type: {mime_type!r}; "
            f"allowed: {cfg.allowed_file_types}"
        )
    if not filename:
        raise ValueError("filename is required")
