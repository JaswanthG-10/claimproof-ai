import os
import fitz  # PyMuPDF
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ParsedPage(BaseModel):
    page_number: int
    text: str


class ParsedDocument(BaseModel):
    filename: str
    filepath: str
    document_type: str
    total_pages: int
    pages: List[ParsedPage]
    raw_full_text: str
    error: Optional[str] = None


def detect_document_type(filename: str, text_sample: str = "") -> str:
    """Infer document type based on filename and header keywords."""
    fn_lower = filename.lower()
    text_lower = text_sample.lower()

    if "claim_form" in fn_lower or "claim form" in text_lower or "claimant" in text_lower:
        return "claim_form"
    elif "fir" in fn_lower or "first information report" in text_lower or "police" in text_lower:
        return "fir"
    elif "repair_estimate" in fn_lower or "estimate" in fn_lower or "repair" in text_lower or "estimate" in text_lower:
        return "repair_estimate"
    elif "driving_licence" in fn_lower or "licence" in fn_lower or "dl" in fn_lower or "driving licence" in text_lower:
        return "driving_licence"
    elif "registration_certificate" in fn_lower or "rc" in fn_lower or "registration" in text_lower:
        return "registration_certificate"
    elif "incident_description" in fn_lower or "statement" in text_lower:
        return "incident_description"
    elif "policy" in fn_lower or "schedule" in text_lower:
        return "policy"
    
    return "supporting_document"


def parse_pdf_file(filepath: str) -> ParsedDocument:
    """Extract page-by-page text from a PDF file using PyMuPDF (fitz)."""
    filename = os.path.basename(filepath)
    pages: List[ParsedPage] = []
    full_text_chunks: List[str] = []

    try:
        doc = fitz.open(filepath)
        total_pages = len(doc)
        
        if total_pages == 0:
            return ParsedDocument(
                filename=filename,
                filepath=filepath,
                document_type=detect_document_type(filename),
                total_pages=0,
                pages=[],
                raw_full_text="",
                error="Empty PDF document"
            )

        for i, page in enumerate(doc):
            page_num = i + 1
            text = page.get_text("text").strip()
            pages.append(ParsedPage(page_number=page_num, text=text))
            full_text_chunks.append(f"--- Page {page_num} ---\n{text}")
        
        doc.close()
        full_text = "\n\n".join(full_text_chunks)
        doc_type = detect_document_type(filename, full_text[:500])

        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=doc_type,
            total_pages=total_pages,
            pages=pages,
            raw_full_text=full_text
        )

    except Exception as e:
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=detect_document_type(filename),
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"Corrupted or invalid PDF file: {str(e)}"
        )


def parse_txt_file(filepath: str) -> ParsedDocument:
    """Extract text from a plain TXT file."""
    filename = os.path.basename(filepath)
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            text = f.read().strip()
        
        doc_type = detect_document_type(filename, text[:500])
        pages = [ParsedPage(page_number=1, text=text)]
        
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=doc_type,
            total_pages=1,
            pages=pages,
            raw_full_text=text
        )
    except Exception as e:
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=detect_document_type(filename),
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"Error reading TXT file: {str(e)}"
        )


def parse_document(filepath: str) -> ParsedDocument:
    """Universal parser for PDF and TXT files."""
    if not os.path.exists(filepath):
        filename = os.path.basename(filepath)
        return ParsedDocument(
            filename=filename,
            filepath=filepath,
            document_type=detect_document_type(filename),
            total_pages=0,
            pages=[],
            raw_full_text="",
            error=f"File not found: {filepath}"
        )
    
    if filepath.lower().endswith(".pdf"):
        return parse_pdf_file(filepath)
    elif filepath.lower().endswith(".txt"):
        return parse_txt_file(filepath)
    else:
        # Fallback text reading
        return parse_txt_file(filepath)
