"""Tests for CV validation utility."""

import io
import pytest

from app.utils.cv_validator import validate_cv, CVValidationError, CVValidationResult


# ── Helpers ───────────────────────────────────────────────────

def _make_minimal_pdf(text: str = "Hello World") -> bytes:
    """Create a minimal valid PDF with extractable *text*.

    Uses a hand-crafted PDF structure that pdfplumber can parse.
    """
    # Build a minimal but spec-compliant PDF with a Type1 font
    # so pdfplumber can extract the text via Tj operators.
    safe = text.encode("latin-1", errors="replace")
    stream_content = b"BT /F1 12 Tf 72 720 Td (" + safe + b") Tj ET"
    stream_len = len(stream_content)

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]"
        b"/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        b"4 0 obj<</Length " + str(stream_len).encode() + b">>\n"
        b"stream\n" + stream_content + b"\nendstream\nendobj\n"
        b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000266 00000 n \n"
        b"0000000000 00000 n \n"  # placeholder
        b"trailer<</Size 6/Root 1 0 R>>\n"
        b"startxref\n9\n%%EOF"
    )
    return pdf


def _make_empty_pdf() -> bytes:
    """Create a PDF with a blank page (no text)."""
    from PyPDF2 import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _make_docx() -> bytes:
    """Create a minimal valid DOCX."""
    from docx import Document

    doc = Document()
    doc.add_paragraph("Curriculum Vitae")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# ── Tests ─────────────────────────────────────────────────────


class TestRejectsInvalidExtension:
    def test_txt_extension(self):
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(b"some content", "resume.txt", "text/plain")
        assert exc_info.value.code == "invalid_extension"

    def test_no_extension(self):
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(b"some content", "resume", None)
        assert exc_info.value.code == "invalid_extension"

    def test_jpg_extension(self):
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(b"\xff\xd8\xff", "photo.jpg", "image/jpeg")
        assert exc_info.value.code == "invalid_extension"


class TestRejectsOversizedFile:
    def test_over_10mb(self):
        big_content = b"x" * (10 * 1024 * 1024 + 1)
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(big_content, "big.pdf", "application/pdf")
        assert exc_info.value.code == "file_too_large"


class TestRejectsWrongMime:
    def test_text_file_renamed_to_pdf(self):
        """A plain text file renamed to .pdf should be rejected if magic is available."""
        content = b"This is just plain text, not a PDF"
        try:
            import magic
            # magic is available — should detect mismatch
            with pytest.raises(CVValidationError) as exc_info:
                validate_cv(content, "fake.pdf", "application/pdf")
            assert exc_info.value.code in ("invalid_mime", "corrupt_pdf")
        except ImportError:
            # magic not available — falls through to PDF content check
            # which will raise corrupt_pdf
            with pytest.raises(CVValidationError) as exc_info:
                validate_cv(content, "fake.pdf", "application/pdf")
            assert exc_info.value.code == "corrupt_pdf"


class TestRejectsCorruptPdf:
    def test_corrupt_bytes(self):
        corrupt = b"%PDF-1.4 this is not a valid pdf body"
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(corrupt, "corrupt.pdf", "application/pdf")
        assert exc_info.value.code in ("corrupt_pdf", "invalid_mime")


class TestRejectsEmptyPdf:
    def test_blank_page_pdf(self):
        empty_pdf = _make_empty_pdf()
        with pytest.raises(CVValidationError) as exc_info:
            validate_cv(empty_pdf, "empty.pdf", "application/pdf")
        assert exc_info.value.code == "empty_pdf"


class TestValidPdfPasses:
    def test_valid_pdf(self):
        pdf_bytes = _make_minimal_pdf("Mi experiencia profesional")
        result = validate_cv(pdf_bytes, "cv.pdf", "application/pdf")
        assert isinstance(result, CVValidationResult)
        assert result.extension == "pdf"
        assert result.file_size > 0
        assert result.filename == "cv.pdf"


class TestValidDocxPasses:
    def test_valid_docx(self):
        docx_bytes = _make_docx()
        result = validate_cv(docx_bytes, "cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        assert isinstance(result, CVValidationResult)
        assert result.extension == "docx"
        assert result.file_size > 0
