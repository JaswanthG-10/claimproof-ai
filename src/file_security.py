import re
import os
from typing import Tuple
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".txt"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename against path traversal, null bytes, and malicious characters.
    """
    if not filename:
        return "unnamed_document.pdf"

    # Remove null bytes
    cleaned = filename.replace("\0", "").replace("\x00", "")

    # Strip directory components (Windows and Unix)
    cleaned = os.path.basename(cleaned)
    cleaned = re.sub(r"[\/\\]+", "", cleaned)

    # Normalize special characters, keep alphanumeric, dots, hyphens, underscores
    cleaned = re.sub(r"[^\w\-.]", "_", cleaned)
    # Remove leading dots
    cleaned = re.sub(r"^\.+", "", cleaned)

    if not cleaned:
        return "uploaded_document.pdf"

    return cleaned[:100]  # Limit length


def validate_claim_id(claim_id: str) -> str:
    """Validate claim ID format and prevent path traversal."""
    if not claim_id:
        raise HTTPException(status_code=400, detail="Claim ID cannot be empty.")

    # Only allow alphanumeric, hyphens, and underscores
    if not re.match(r"^[A-Za-z0-9_\-]+$", claim_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid claim ID format. Only alphanumeric characters, hyphens, and underscores are allowed."
        )

    if len(claim_id) > 64:
        raise HTTPException(status_code=400, detail="Claim ID exceeds maximum length of 64 characters.")

    return claim_id


def validate_file_upload(filename: str, content: bytes) -> str:
    """
    Validate uploaded file size and extension.
    Returns sanitized filename or raises HTTPException.
    """
    safe_name = sanitize_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed extensions are: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum allowed size of 15MB (got {len(content) / (1024 * 1024):.1f}MB)."
        )

    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

    return safe_name
