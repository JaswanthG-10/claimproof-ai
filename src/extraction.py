import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
from src.parser import ParsedDocument, ParsedPage
from src.schemas import EvidenceItem
from src.normalization import (
    normalize_date,
    normalize_vehicle_number,
    normalize_policy_number,
    normalize_amount,
    evaluate_commercial_use
)

logger = logging.getLogger(__name__)


def extract_with_regex(document: ParsedDocument) -> List[EvidenceItem]:
    """
    Deterministic extraction engine for insurance documents.
    Extracts facts page-by-page preserving exact text snippets for provenance.
    """
    evidence: List[EvidenceItem] = []

    for page in document.pages:
        text = page.text
        pnum = page.page_number
        if not text:
            continue

        # 1. Policy Number
        pol_matches = re.findall(r"(?:policy\s*(?:no|number|#)?\s*[:\-]?\s*)([A-Z0-9\-/]{5,25})", text, re.IGNORECASE)
        for pm in pol_matches:
            cleaned = normalize_policy_number(pm)
            if cleaned:
                evidence.append(
                    EvidenceItem(
                        field_name="policy_number",
                        value=cleaned,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.98,
                        raw_text=f"Policy Number: {pm}"
                    )
                )

        # 2. Vehicle Registration Number
        veh_matches = re.findall(r"\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,2}\s*\d{4})\b", text, re.IGNORECASE)
        for vm in veh_matches:
            cleaned = normalize_vehicle_number(vm)
            if cleaned:
                evidence.append(
                    EvidenceItem(
                        field_name="vehicle_number",
                        value=cleaned,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.98,
                        raw_text=f"Registration No: {vm}"
                    )
                )

        # 3. Incident Date / Date of Loss / Date of Occurrence
        date_patterns = [
            r"(?:date of loss|date of occurrence|incident date|accident date|loss date)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})",
            r"(?:stolen on|occurred on|dated)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})"
        ]
        for dp in date_patterns:
            for dm in re.findall(dp, text, re.IGNORECASE):
                norm_d = normalize_date(dm)
                if norm_d:
                    evidence.append(
                        EvidenceItem(
                            field_name="incident_date",
                            value=norm_d,
                            source_document=document.filename,
                            page_number=pnum,
                            confidence=0.96,
                            raw_text=f"Date: {dm}"
                        )
                    )

        # 4. Driving Licence Expiry Date & Licence Number
        dl_matches = re.findall(r"(?:licence\s*no|license\s*no|dl\s*no)\s*[:\-]?\s*([A-Z0-9\s]{8,20})", text, re.IGNORECASE)
        for dlm in dl_matches:
            val = re.sub(r"\s+", " ", dlm).strip()
            evidence.append(
                EvidenceItem(
                    field_name="driver_licence_number",
                    value=val,
                    source_document=document.filename,
                    page_number=pnum,
                    confidence=0.98,
                    raw_text=f"Licence No: {val}"
                )
            )

        dl_exp_matches = re.findall(r"(?:valid\s*up\s*to|validity|expiry\s*date)\s*[:\-]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})", text, re.IGNORECASE)
        for dem in dl_exp_matches:
            norm_exp = normalize_date(dem)
            if norm_exp:
                evidence.append(
                    EvidenceItem(
                        field_name="driver_licence_expiry",
                        value=norm_exp,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.98,
                        raw_text=f"Valid Up To: {dem}"
                    )
                )

        # 5. Customer / Insured / Claimant Name
        name_matches = re.findall(r"(?:insured\s*name|customer\s*name|complainant\s*name|owner\s*name|name\s*of\s*insured|customer)\s*[:\-]?\s*([A-Za-z\s\.]{3,35})(?:\n|$)", text, re.IGNORECASE)
        for nm in name_matches:
            name_clean = " ".join(nm.strip().split())
            if len(name_clean) >= 3 and not any(k in name_clean.lower() for k in ["ltd", "company", "center", "police"]):
                evidence.append(
                    EvidenceItem(
                        field_name="customer_name",
                        value=name_clean,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.95,
                        raw_text=f"Customer Name: {name_clean}"
                    )
                )

        # 6. Driver Name
        driver_matches = re.findall(r"(?:driver\s*name|person\s*driving|name\s*of\s*driver)\s*[:\-]?\s*([A-Za-z\s\.]{3,35})(?:\n|$)", text, re.IGNORECASE)
        for dm in driver_matches:
            dname_clean = " ".join(dm.strip().split())
            if len(dname_clean) >= 3:
                evidence.append(
                    EvidenceItem(
                        field_name="driver_name",
                        value=dname_clean,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.95,
                        raw_text=f"Driver Name: {dname_clean}"
                    )
                )

        # 7. Vehicle Model
        model_matches = re.findall(r"(?:model|insured\s*vehicle|vehicle\s*model)\s*[:\-]?\s*([A-Za-z0-9\.\s\-]{3,30})(?:\n|$)", text, re.IGNORECASE)
        for mm in model_matches:
            m_clean = " ".join(mm.strip().split())
            if len(m_clean) >= 3 and not any(k in m_clean.lower() for k in ["motor car", "private", "personal"]):
                evidence.append(
                    EvidenceItem(
                        field_name="vehicle_model",
                        value=m_clean,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.92,
                        raw_text=f"Model: {m_clean}"
                    )
                )

        # 8. Incident Type (Accident vs Theft)
        if re.search(r"\b(theft|stolen|robbery|ipc\s*379)\b", text, re.IGNORECASE):
            evidence.append(
                EvidenceItem(
                    field_name="incident_type",
                    value="theft",
                    source_document=document.filename,
                    page_number=pnum,
                    confidence=0.97,
                    raw_text="Theft incident mentioned in text"
                )
            )
        elif re.search(r"\b(accident|collision|hit\s*from\s*rear|impact|damaged)\b", text, re.IGNORECASE):
            evidence.append(
                EvidenceItem(
                    field_name="incident_type",
                    value="accident",
                    source_document=document.filename,
                    page_number=pnum,
                    confidence=0.95,
                    raw_text="Accident/collision mentioned in text"
                )
            )

        # 9. Claimed Amount / Repair Estimate Total / IDV Claimed Value
        amt_matches = re.findall(r"(?:claimed\s*value|total\s*loss\s*claim\s*value|estimated\s*claim\s*amount|total\s*estimate|grand\s*total|net\s*payable|amount)\s*(?:\(idv\s*limit\))?\s*[:\-]?\s*(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)", text, re.IGNORECASE)
        for am in amt_matches:
            norm_amt = normalize_amount(am)
            if norm_amt and norm_amt > 100:  # Exclude tiny fees
                evidence.append(
                    EvidenceItem(
                        field_name="claimed_amount",
                        value=f"{norm_amt:.2f}",
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.96,
                        raw_text=f"Claimed Amount: {am}"
                    )
                )

        # 10. Commercial vs Private Vehicle Usage
        comm_eval = evaluate_commercial_use(text)
        if comm_eval is not None:
            comm_val_str = "true" if comm_eval else "false"
            evidence.append(
                EvidenceItem(
                    field_name="commercial_use",
                    value=comm_val_str,
                    source_document=document.filename,
                    page_number=pnum,
                    confidence=0.98,
                    raw_text="Commercial usage indicators found" if comm_eval else "Private personal usage indicated"
                )
            )

        # 11. Incident Location
        loc_matches = re.findall(r"(?:incident\s*location|place\s*of\s*accident|location|place)\s*[:\-]?\s*([A-Za-z0-9\s,\.\-]{4,50})(?:\n|$)", text, re.IGNORECASE)
        for lm in loc_matches:
            loc_clean = " ".join(lm.strip().split())
            if len(loc_clean) >= 4:
                evidence.append(
                    EvidenceItem(
                        field_name="incident_location",
                        value=loc_clean,
                        source_document=document.filename,
                        page_number=pnum,
                        confidence=0.90,
                        raw_text=f"Location: {loc_clean}"
                    )
                )

    return evidence


def extract_document_evidence(document: ParsedDocument) -> List[EvidenceItem]:
    """Extract evidence items with deterministic parser and optional Gemini enrichment."""
    # Always run deterministic extraction as bedrock foundation
    base_evidence = extract_with_regex(document)
    return base_evidence
