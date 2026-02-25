"""CV validation utility for upload endpoints.

Extracts and centralises file-type, size, MIME-magic, corruption
and empty-content checks that were previously inline in routers.
"""

import io
from dataclasses import dataclass, field
from typing import Optional


# ── Constants ─────────────────────────────────────────────────

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {"pdf", "docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# Maps python-magic output → normalised MIME
_MAGIC_MIME_MAP = {
    "application/pdf": "application/pdf",
    "application/zip": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/x-zip-compressed": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


# ── Error ─────────────────────────────────────────────────────

class CVValidationError(Exception):
    """Raised when a CV file fails validation."""

    def __init__(self, message: str, code: str) -> None:
        self.message = message
        self.code = code
        super().__init__(message)


# ── Result ────────────────────────────────────────────────────

@dataclass
class CVValidationResult:
    """Successful validation result."""

    filename: str
    extension: str
    file_size: int
    content_type: str
    text: str = ""
    pages: int = 0
    metadata: dict = field(default_factory=dict)


# ── Helpers ───────────────────────────────────────────────────

def _get_extension(filename: str) -> str:
    """Extract lowercased extension from *filename*."""
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def _detect_mime(content: bytes, extension: str) -> Optional[str]:
    """Return MIME type via python-magic, or *None* if unavailable.

    For DOCX files (which are ZIP archives), magic may return generic
    types like ``application/octet-stream`` or ``application/zip``.
    These are acceptable when the extension is ``.docx``.
    """
    try:
        import magic  # python-magic
        detected = magic.from_buffer(content, mime=True)
        mapped = _MAGIC_MIME_MAP.get(detected)
        if mapped is not None:
            return mapped
        # Allow generic archive types for DOCX
        if extension == "docx" and detected in (
            "application/octet-stream",
            "application/zip",
            "application/x-zip-compressed",
        ):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return detected
    except Exception:
        # libmagic not installed or other error — graceful degradation
        return None


def _validate_pdf_content(content: bytes) -> tuple[str, int]:
    """Open PDF, verify it is not corrupt and not empty.

    Returns (extracted_text, page_count).
    Raises CVValidationError on failure.
    """
    import pdfplumber

    try:
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception:
        raise CVValidationError(
            message="El archivo PDF esta corrupto o danado. Sube un archivo valido.",
            code="corrupt_pdf",
        )

    try:
        pages = pdf.pages
        page_count = len(pages)
        text_parts: list[str] = []
        for page in pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

        extracted = "\n".join(text_parts)
        if not extracted.strip():
            raise CVValidationError(
                message="El PDF no contiene texto legible. Asegurate de que no sea solo imagenes escaneadas.",
                code="empty_pdf",
            )
        return extracted, page_count
    finally:
        pdf.close()


# ── Public API ────────────────────────────────────────────────

def validate_cv(
    content: bytes,
    filename: str,
    content_type: Optional[str] = None,
) -> CVValidationResult:
    """Validate a CV file and return a :class:`CVValidationResult`.

    Checks are executed in order:
    1. Extension
    2. Size
    3. MIME magic (graceful if libmagic is missing)
    4. Corrupt PDF (via pdfplumber)
    5. Empty PDF

    Raises :class:`CVValidationError` on failure.
    """
    ext = _get_extension(filename)

    # 1. Extension
    if ext not in ALLOWED_EXTENSIONS:
        raise CVValidationError(
            message="Formato no soportado. Solo se aceptan archivos PDF o DOCX.",
            code="invalid_extension",
        )

    # 2. Size
    if len(content) > MAX_FILE_SIZE:
        raise CVValidationError(
            message="Archivo muy grande. El tamano maximo es 10MB.",
            code="file_too_large",
        )

    # 3. MIME magic
    detected_mime = _detect_mime(content, ext)
    if detected_mime is not None and detected_mime not in ALLOWED_MIME_TYPES:
        raise CVValidationError(
            message="El contenido del archivo no coincide con su extension. Sube un PDF o DOCX valido.",
            code="invalid_mime",
        )

    # Determine resolved content type
    resolved_ct = detected_mime or content_type or ""

    # 4 & 5. PDF-specific: corrupt + empty
    extracted_text = ""
    page_count = 0
    if ext == "pdf":
        extracted_text, page_count = _validate_pdf_content(content)

    return CVValidationResult(
        filename=filename,
        extension=ext,
        file_size=len(content),
        content_type=resolved_ct or f"application/{ext}",
        text=extracted_text,
        pages=page_count,
    )
