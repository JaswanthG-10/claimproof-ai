import os
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    PYTESSERACT_AVAILABLE = False


class ParsedPage(BaseModel):
    page_number: int
    text: str
    is_scanned: bool = False
    warning: Optional[str] = None


class ParsedDocument(BaseModel):
    filename: str
    filepath: str
    document_type: str
    confidence: float = 1.0
    total_pages: int
    pages: List[ParsedPage] = Field(default_factory=list)
    raw_full_text: str = ""
    error: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


def detect_document_type(filename: str, text_sample: str = "") -> Tuple[str, float]:
    """
    Infer document type with confidence scoring using filename and text indicators.
    Returns (document_type, confidence).
    """
    fn_lower = filename.lower().replace("-", "_").replace(" ", "_")
    text_lower = text_sample.lower()

    # 1. Driving Licence
    if any(k in fn_lower for k in ["driving_licence", "driving_license", "licence", "license", "dl_"]) or \
       any(k in text_lower for k in ["driving licence", "driving license", "licence no", "license no", "authorised to drive", "valid up to"]):
        conf = 0.98 if "driving licence" in text_lower or "licence no" in text_lower else 0.85
        return "driving_licence", conf

    # 2. Registration Certificate
    if any(k in fn_lower for k in ["registration_certificate", "registration", "rc_book", "rc_"]) or \
       any(k in text_lower for k in ["certificate of registration", "form 23", "chassis no", "engine no", "registration no"]):
        conf = 0.98 if "certificate of registration" in text_lower or "registration no" in text_lower else 0.85
        return "registration_certificate", conf

    # 3. First Information Report (FIR)
    if any(k in fn_lower for k in ["fir", "police_report", "police_fir"]) or \
       any(k in text_lower for k in ["first information report", "police station", "fir no", "under section 379"]):
        conf = 0.98 if "first information report" in text_lower or "fir no" in text_lower else 0.85
        return "fir", conf

    # 4. Repair Estimate / Quotation
    if any(k in fn_lower for k in ["repair_estimate", "estimate", "quotation", "invoice", "loss_estimate"]) or \
       any(k in text_lower for k in ["repair estimate", "service center", "authorized service", "estimate no", "spare parts", "total loss claim value"]):
        conf = 0.98 if "repair estimate" in text_lower or "service center" in text_lower else 0.85
        return "repair_estimate", conf

    # 5. Claim Form
    if any(k in fn_lower for k in ["claim_form", "claimform", "claim_application"]) or \
       any(k in text_lower for k in ["claim form", "motor claim form", "claim id:", "details of accident"]):
        conf = 0.98 if "claim form" in text_lower or "motor claim form" in text_lower else 0.85
        return "claim_form", conf

    # 6. Incident Description / Statement
    if any(k in fn_lower for k in ["incident_description", "statement", "narrative", "loss_description"]) or \
       any(k in text_lower for k in ["incident description", "incident statement", "how the accident occurred"]):
        conf = 0.95 if "incident description" in text_lower or "incident statement" in text_lower else 0.80
        return "incident_description", conf

    # 7. Policy Schedule / Document
    if any(k in fn_lower for k in ["policy", "insurance_policy", "policy_schedule"]) or \
       any(k in text_lower for k in ["policy schedule", "comprehensive policy", "insured declared value"]):
        return "policy", 0.95

    # 8. No Trace Report
    if any(k in fn_lower for k in ["no_trace", "notrace", "untraced"]) or \
       any(k in text_lower for k in ["non-traceable report", "untraced report", "final untraced"]):
        return "no_trace_report", 0.95

    # 9. Irrelevant / Non-insurance document detection
    irrelevant_keywords = ["curriculum vitae", "resume", "grocery", "supermarket bill", "restaurant receipt", "programming code", "source code", "homework"]
    if any(ik in text_lower for ik in irrelevant_keywords):
        return "irrelevant_document", 0.90

    return "supporting_document", 0.50


DOC_TYPE_NORMALIZATION = {
    "driving_licence": "driving_licence",
    "driving_license": "driving_licence",
    "driving license": "driving_licence",
    "dl": "driving_licence",
    "registration_certificate": "registration_certificate",
    "registration": "registration_certificate",
    "rc": "registration_certificate",
    "repair_estimate": "repair_estimate",
    "estimate": "repair_estimate",
    "quotation": "repair_estimate",
    "invoice": "repair_estimate",
    "police_fir": "fir",
    "fir": "fir",
    "claim_form": "claim_form",
    "incident_description": "incident_description",
    "policy": "policy"
}

HUMAN_READABLE_DOC_NAMES = {
    "driving_licence": "Driving Licence",
    "registration_certificate": "Registration Certificate (RC)",
    "repair_estimate": "Repair Estimate / Invoice",
    "fir": "Police FIR",
    "claim_form": "Signed Claim Form",
    "incident_description": "Incident Description",
    "policy": "Policy Document",
    "supporting_document": "General Supporting Document",
    "irrelevant_document": "Non-Insurance Document"
}

CONTENT_KEYWORDS = {
    "driving_licence": [
        "driving licence", "driving license", "licence no", "license no", "authorised to drive",
        "dl no", "valid up to", "motor vehicles department", "rto", "transport department",
        "class of vehicle", "date of birth", "badge no"
    ],
    "registration_certificate": [
        "certificate of registration", "form 23", "registration no", "chassis no",
        "engine no", "rc book", "vehicle class", "maker's classification"
    ],
    "repair_estimate": [
        "repair estimate", "service center", "authorized service", "estimate no",
        "spare parts", "labour charges", "parts total", "loss estimate"
    ],
    "fir": [
        "first information report", "police station", "fir no", "under section",
        "ipc section", "station house officer"
    ],
    "claim_form": [
        "claim form", "motor claim form", "claim id:", "details of accident",
        "policyholder statement"
    ]
}


def validate_uploaded_document_type(
    filename: str,
    raw_text: str,
    expected_type: Optional[str]
) -> Tuple[bool, str, str]:
    """
    Validate whether the uploaded document matches the required/expected document type.
    Returns: (is_valid, detected_type, error_reason)
    """
    detected_type, conf = detect_document_type(filename, raw_text)

    if not expected_type or expected_type.strip().lower() in ["other", "supporting_document", "all", ""]:
        return True, detected_type, ""

    expected_norm = DOC_TYPE_NORMALIZATION.get(expected_type.strip().lower(), expected_type.strip().lower())

    # If detected type directly matches expected
    if detected_type == expected_norm:
        return True, detected_type, ""

    # Check fallback keywords in text if detected_type wasn't confident or was generic
    text_lower = raw_text.lower()
    expected_keywords = CONTENT_KEYWORDS.get(expected_norm, [])
    if any(kw in text_lower for kw in expected_keywords):
        return True, expected_norm, ""

    # Mismatch detected
    expected_label = HUMAN_READABLE_DOC_NAMES.get(expected_norm, expected_norm.replace("_", " ").title())
    detected_label = HUMAN_READABLE_DOC_NAMES.get(detected_type, detected_type.replace("_", " ").title())

    if detected_type in HUMAN_READABLE_DOC_NAMES and detected_type not in ["supporting_document", "irrelevant_document"]:
        err_msg = (
            f"Upload rejected: You are uploading for '{expected_label}', but the uploaded document "
            f"was detected as a '{detected_label}'. Please upload the correct document."
        )
    else:
        err_msg = (
            f"Upload rejected: The uploaded file '{filename}' does not appear to be a valid {expected_label}. "
            f"Please upload the correct document."
        )

    return False, detected_type, err_msg


def parse_pdf_file(filepath: str) -> ParsedDocument:
    """Extract page-by-page text from a PDF file using PyMuPDF with scanned page detection."""
    filename = os.path.basename(filepath)
    pages: List[ParsedPage] = []
    full_text_chunks: List[str] = []
    warnings: List[str] = []

    if fitz is None:
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type="unsupported",
            total_pages=0,
            pages=[],
            error="PyMuPDF library is not installed."
        )

    try:
        doc = fitz.open(filepath)
        total_pages = len(doc)

        if total_pages == 0:
            return ParsedDocument(
                filename=filename,
                filepath=filepath,
                document_type="empty_document",
                confidence=0.0,
                total_pages=0,
                pages=[],
                raw_full_text="",
                error="Empty PDF document (0 pages)."
            )

        for i, page in enumerate(doc):
            page_num = i + 1
            text = page.get_text("text").strip()
            is_scanned = False
            page_warning = None

            # Check if page has insufficient selectable text (scanned page or image)
            if len(text) < 30:
                image_list = page.get_images()
                if image_list:
                    is_scanned = True
                    if PYTESSERACT_AVAILABLE:
                        try:
                            # Render page pixmap and run OCR
                            pix = page.get_pixmap(dpi=200)
                            import io
                            from PIL import Image
                            img = Image.open(io.BytesIO(pix.tobytes("png")))
                            ocr_text = pytesseract.image_to_string(img).strip()
                            if len(ocr_text) > len(text):
                                text = ocr_text
                                page_warning = f"Page {page_num} extracted via OCR."
                        except Exception as e:
                            page_warning = f"Page {page_num} appears to be scanned; OCR attempt failed: {e}"
                    else:
                        page_warning = f"Page {page_num} appears to be a scanned image without embedded text."
                        warnings.append(page_warning)

            pages.append(ParsedPage(page_number=page_num, text=text, is_scanned=is_scanned, warning=page_warning))
            full_text_chunks.append(f"--- Page {page_num} ---\n{text}")

        doc.close()
        full_text = "\n\n".join(full_text_chunks)
        doc_type, conf = detect_document_type(filename, full_text[:1000])

        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=doc_type,
            confidence=conf,
            total_pages=total_pages,
            pages=pages,
            raw_full_text=full_text,
            warnings=warnings
        )

    except Exception as e:
        logger.error(f"Error parsing PDF {filepath}: {e}")
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type="corrupted_file",
            confidence=0.0,
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"Corrupted or invalid PDF file: {str(e)}"
        )


def parse_txt_file(filepath: str) -> ParsedDocument:
    """Extract text from a plain TXT file."""
    filename = os.path.basename(filepath)
    try:
        with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
            text = f.read().strip()

        doc_type, conf = detect_document_type(filename, text[:1000])
        pages = [ParsedPage(page_number=1, text=text)]

        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=doc_type,
            confidence=conf,
            total_pages=1,
            pages=pages,
            raw_full_text=text
        )
    except Exception as e:
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type="error_file",
            confidence=0.0,
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"Error reading TXT file: {str(e)}"
        )


def parse_document(filepath: str) -> ParsedDocument:
    """Universal parser for PDF, TXT, and image files."""
    if not os.path.exists(filepath):
        filename = os.path.basename(filepath)
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type="not_found",
            confidence=0.0,
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"File not found: {filepath}"
        )

    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".pdf":
        return parse_pdf_file(filepath)
    elif ext in [".txt", ".log", ".csv"]:
        return parse_txt_file(filepath)
    elif ext in [".png", ".jpg", ".jpeg"]:
        filename = os.path.basename(filepath)
        text = ""
        warnings = []
        if PYTESSERACT_AVAILABLE:
            try:
                from PIL import Image
                img = Image.open(filepath)
                text = pytesseract.image_to_string(img).strip()
            except Exception as e:
                warnings.append(f"OCR extraction failed on image: {e}")
        else:
            warnings.append("Image file uploaded, but OCR engine is not configured.")

        doc_type, conf = detect_document_type(filename, text[:1000])
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=doc_type,
            confidence=conf,
            total_pages=1,
            pages=[ParsedPage(page_number=1, text=text, is_scanned=True)],
            raw_full_text=text,
            warnings=warnings
        )
    else:
        filename = os.path.basename(filepath)
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type="unsupported_format",
            confidence=0.0,
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"Unsupported file format: {ext}"
        )
