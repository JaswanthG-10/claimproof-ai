import os
import re
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from src.parser import ParsedDocument
from src.schemas import EvidenceItem, ClaimData


class ExtractedField(BaseModel):
    field_name: str
    value: Optional[str] = None
    page_number: int = 1
    confidence: float = 1.0
    raw_text: Optional[str] = None


class DocumentExtractionResult(BaseModel):
    document_type: str
    filename: str
    fields: List[ExtractedField] = Field(default_factory=list)
    raw_json: Optional[Dict[str, Any]] = None


EXTRACTION_PROMPT = """
You are an expert insurance document extractor. Extract factual details from the provided insurance document text.
Follow these strict rules:
1. ONLY extract facts explicitly stated in the document text.
2. Return NULL (or json null) for any field not explicitly present in the text. DO NOT GUESS OR INVENT DATA.
3. Keep field values clean, e.g., dates as YYYY-MM-DD, amounts as raw numbers without currency symbols where possible.
4. For commercial_use, evaluate if the vehicle was being used for commercial purposes (taxi, rideshare, goods delivery) vs private personal use.

Extract the following fields if present:
- customer_name
- policy_number
- vehicle_number
- vehicle_model
- driver_name
- incident_type (accident / theft)
- incident_date (YYYY-MM-DD format)
- incident_location
- claimed_amount (numeric)
- commercial_use (boolean true/false)

Return valid JSON with the structure:
{
  "fields": [
    {
      "field_name": "incident_date",
      "value": "2026-08-21",
      "page_number": 1,
      "confidence": 0.95,
      "raw_text": "Date of Loss: 21-08-2026"
    }
  ]
}
"""


def _get_genai_client():
    """Get Gemini Client if API key is configured."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception:
        return None


def extract_with_gemini(document: ParsedDocument) -> Optional[List[EvidenceItem]]:
    """Attempt extraction using Gemini 3.5 Flash."""
    client = _get_genai_client()
    if not client or not document.raw_full_text:
        return None

    try:
        from google.genai import types

        prompt = f"{EXTRACTION_PROMPT}\n\nDocument Name: {document.filename}\nDocument Content:\n{document.raw_full_text}"

        response = client.models.generate_content(
            model="gemini-2.5-flash",  # Gemini Flash model
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        text = response.text
        if not text:
            return None

        data = json.loads(text)
        evidence_items: List[EvidenceItem] = []

        fields = data.get("fields", [])
        for item in fields:
            val = item.get("value")
            if val is not None and str(val).strip() != "" and str(val).lower() != "null":
                evidence_items.append(
                    EvidenceItem(
                        field_name=item["field_name"],
                        value=str(val).strip(),
                        source_document=document.filename,
                        page_number=int(item.get("page_number", 1)),
                        confidence=float(item.get("confidence", 0.95)),
                        raw_text=item.get("raw_text")
                    )
                )

        return evidence_items

    except Exception:
        # Fallback if API call fails
        return None


def extract_with_regex(document: ParsedDocument) -> List[EvidenceItem]:
    """Deterministic regex extraction fallback for insurance documents."""
    text = document.raw_full_text
    evidence: List[EvidenceItem] = []

    # Regex patterns for common fields
    patterns = {
        "policy_number": [
            r"policy\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z0-9\-/]+)",
            r"pol\s*#?\s*[:\-]?\s*([A-Z0-9\-/]+)"
        ],
        "vehicle_number": [
            r"registration\s*(?:no|number|#)?\s*[:\-]?\s*([A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4})",
            r"vehicle\s*(?:no|number|reg)?\s*[:\-]?\s*([A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4})",
            r"\b([A-Z]{2}\s*\d{2}\s*[A-Z]{1,2}\s*\d{4})\b"
        ],
        "incident_date": [
            r"(?:incident|accident|loss|date of loss|date of occurrence)\s*(?:date)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})",
            r"(?:incident|accident|loss|date of loss|date of occurrence)\s*(?:date)?\s*[:\-]?\s*(\d{2}/\d{2}/\d{4})",
            r"(?:incident|accident|loss|date of loss|date of occurrence)\s*(?:date)?\s*[:\-]?\s*(\d{2}-\d{2}-\d{4})"
        ],
        "customer_name": [
            r"(?:insured|claimant|customer|owner)\s*name\s*[:\-]?\s*([A-Za-z\s\.]+)",
            r"name of insured\s*[:\-]?\s*([A-Za-z\s\.]+)"
        ],
        "driver_name": [
            r"driver\s*(?:name)?\s*[:\-]?\s*([A-Za-z\s\.]+)",
            r"person driving\s*[:\-]?\s*([A-Za-z\s\.]+)"
        ],
        "claimed_amount": [
            r"(?:claimed amount|total estimate|claim amount|repair cost|estimated cost)\s*[:\-]?\s*(?:INR|Rs\.?|\$)?\s*([\d,]+(?:\.\d{2})?)",
            r"amount\s*[:\-]?\s*(?:INR|Rs\.?|\$)?\s*([\d,]+)"
        ],
        "incident_type": [
            r"\b(accident|accidental damage|collision)\b",
            r"\b(theft|stolen|robbery)\b"
        ],
        "commercial_use": [
            r"\b(commercial|taxi|uber|ola|ride-share|rideshare|commercial transport|fare)\b"
        ]
    }

    for page in document.pages:
        p_text = page.text
        for field, rx_list in patterns.items():
            for rx in rx_list:
                match = re.search(rx, p_text, re.IGNORECASE)
                if match:
                    val = match.group(1).strip()
                    # Normalizations
                    if field == "incident_date":
                        val = val.replace("/", "-")
                        # Standardize DD-MM-YYYY to YYYY-MM-DD
                        parts = val.split("-")
                        if len(parts) == 3 and len(parts[0]) == 2 and len(parts[2]) == 4:
                            val = f"{parts[2]}-{parts[1]}-{parts[0]}"
                    elif field == "claimed_amount":
                        val = val.replace(",", "")
                    elif field == "vehicle_number":
                        val = val.replace(" ", "").upper()
                    elif field == "commercial_use":
                        val = "true"

                    evidence.append(
                        EvidenceItem(
                            field_name=field,
                            value=val,
                            source_document=document.filename,
                            page_number=page.page_number,
                            confidence=0.85,
                            raw_text=match.group(0)
                        )
                    )
                    break

    return evidence


def extract_document_evidence(document: ParsedDocument) -> List[EvidenceItem]:
    """Extract evidence items using Gemini first, falling back to deterministic extraction."""
    if document.error:
        return []

    gemini_result = extract_with_gemini(document)
    if gemini_result is not None and len(gemini_result) > 0:
        return gemini_result

    # Fallback to regex extractor
    return extract_with_regex(document)
