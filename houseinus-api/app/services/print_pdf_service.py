"""Async Playwright-based PDF generation for property print pages.

Job lifecycle:
  pending → ready (PDF saved to storage)
         → failed (Playwright error)

Staleness: a job is current only if property.updated_at hasn't moved past
property_snapshot_at.  Admin updates call deprecate_jobs() to wipe stale jobs
immediately, so the snapshot check is a safety net.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionFactory
from app.models.property_print_job import PropertyPrintJob
from app.services import storage_service

log = logging.getLogger(__name__)


async def get_current_job(
    db: AsyncSession,
    property_id: uuid.UUID,
    prop_updated_at: datetime,
) -> PropertyPrintJob | None:
    """Return the latest non-stale job for this property, or None."""
    stmt = (
        select(PropertyPrintJob)
        .where(
            PropertyPrintJob.property_id == property_id,
            PropertyPrintJob.property_snapshot_at >= prop_updated_at,
        )
        .order_by(PropertyPrintJob.created_at.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def deprecate_jobs(db: AsyncSession, property_id: uuid.UUID) -> None:
    """Delete all print jobs (and their storage files) for a property."""
    stmt = select(PropertyPrintJob).where(PropertyPrintJob.property_id == property_id)
    jobs = (await db.execute(stmt)).scalars().all()
    for job in jobs:
        if job.storage_key:
            storage_service.delete(job.storage_key)
        await db.delete(job)


async def create_job(
    db: AsyncSession,
    property_id: uuid.UUID,
    prop_updated_at: datetime,
) -> PropertyPrintJob:
    job_id = uuid.uuid4()
    job = PropertyPrintJob(
        id=job_id,
        property_id=property_id,
        status="pending",
        storage_key=f"properties/{property_id}/print_pdf/{job_id}.pdf",
        property_snapshot_at=prop_updated_at,
    )
    db.add(job)
    return job


def _file_exists(storage_key: str) -> bool:
    return (storage_service.base_dir() / storage_key).exists()


async def _compress_pdf(pdf_bytes: bytes) -> bytes:
    """Ghostscript /printer (~300 dpi) 재압축. gs가 없으면 원본 반환."""
    src_fd, src_path = tempfile.mkstemp(suffix=".pdf")
    dst_path = src_path + "_out.pdf"
    try:
        os.write(src_fd, pdf_bytes)
        os.close(src_fd)
        proc = await asyncio.create_subprocess_exec(
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dPDFSETTINGS=/printer",
            "-dNOPAUSE", "-dBATCH", "-dQUIET",
            f"-sOutputFile={dst_path}",
            src_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            log.warning("print-pdf: gs failed (code %d): %s", proc.returncode, stderr.decode().strip())
            return pdf_bytes
        with open(dst_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        log.warning("print-pdf: ghostscript not found, skipping compression")
        return pdf_bytes
    finally:
        os.unlink(src_path)
        if os.path.exists(dst_path):
            os.unlink(dst_path)


async def generate_pdf_background(
    job_id: uuid.UUID,
    print_url: str,
    storage_key: str,
) -> None:
    """Render the print page with Playwright and save the resulting PDF."""
    log.info("print-pdf: starting job %s → %s", job_id, print_url)
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            await page.goto(print_url, wait_until="networkidle", timeout=60_000)
            # Wait until React finishes rendering the print page content.
            await page.wait_for_selector("[data-print-ready]", timeout=30_000)
            # Wait for all web fonts (Noto Serif KR, Inter) to finish loading.
            await page.evaluate("() => document.fonts.ready")
            # Extra settle time for lazy images.
            await asyncio.sleep(2)
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            await browser.close()

        original_size = len(pdf_bytes)
        pdf_bytes = await _compress_pdf(pdf_bytes)
        log.info("print-pdf: job %s size %d → %d bytes", job_id, original_size, len(pdf_bytes))
        storage_service.save_bytes(storage_key, pdf_bytes)

        async with SessionFactory() as db:
            job = await db.get(PropertyPrintJob, job_id)
            if job:
                job.status = "ready"
                await db.commit()

    except Exception:
        log.exception("print-pdf: job %s failed", job_id)
        async with SessionFactory() as db:
            job = await db.get(PropertyPrintJob, job_id)
            if job:
                job.status = "failed"
                await db.commit()
