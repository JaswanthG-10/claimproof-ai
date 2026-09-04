from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from src.schemas import (
    ClaimData,
    CompletenessResult,
    Finding,
    FindingStatus,
    Severity
)
from src.parser import ParsedDocument
from src.normalization import (
    normalize_date,
    calculate_notification_days,
    is_licence_valid
)

# Mandatory document checklists by incident type matching synthetic policy Clauses 5.1 & 5.2
REQUIRED_DOCUMENTS_BY_TYPE = {
    "accident": [
        "claim_form",
        "repair_estimate",
        "driving_licence",
        "registration_certificate"
    ],
    "theft": [
        "claim_form",
        "fir",
        "registration_certificate"
    ]
}

# Documents required prior to final settlement (not blocking initial submission)
SETTLEMENT_DOCUMENTS_BY_TYPE = {
    "theft": [
        "no_trace_report",
        "original_keys",
        "ownership_transfer_forms"
    ],
    "accident": []
}


def check_document_completeness(
    incident_type: str, submitted_documents: List[ParsedDocument]
) -> CompletenessResult:
    """Deterministically check if all mandatory preliminary documents for the claim type are present."""
    inc_type = incident_type.lower() if incident_type else "accident"
    req_docs = REQUIRED_DOCUMENTS_BY_TYPE.get(inc_type, REQUIRED_DOCUMENTS_BY_TYPE["accident"])
    settlement_docs = SETTLEMENT_DOCUMENTS_BY_TYPE.get(inc_type, [])

    submitted_types = [doc.document_type for doc in submitted_documents if not doc.error and doc.document_type != "irrelevant_document"]

    missing_docs = []
    for req in req_docs:
        if req not in submitted_types:
            missing_docs.append(req)

    is_complete = len(missing_docs) == 0

    return CompletenessResult(
        incident_type=inc_type,
        required_documents=req_docs,
        submitted_documents=list(set(submitted_types)),
        missing_documents=missing_docs,
        is_complete=is_complete,
        settlement_documents=settlement_docs
    )


def check_policy_validity(claim: ClaimData) -> List[Finding]:
    """Verify policy validity period (Clause 1.2: 2026-01-01 to 2026-12-31)."""
    findings: List[Finding] = []

    if claim.incident_date:
        norm_date = normalize_date(claim.incident_date)
        if norm_date:
            try:
                inc_date = datetime.strptime(norm_date, "%Y-%m-%d")
                start_date = datetime(2026, 1, 1)
                end_date = datetime(2026, 12, 31, 23, 59, 59)

                if not (start_date <= inc_date <= end_date):
                    findings.append(
                        Finding(
                            category="policy_validity",
                            status=FindingStatus.BLOCKED,
                            description=f"Incident date ({norm_date}) falls outside active policy coverage window (2026-01-01 to 2026-12-31).",
                            severity=Severity.CRITICAL,
                            policy_clause="Clause 1.2",
                            policy_page=1,
                            source_field="incident_date",
                            raw_evidence_text=f"Incident Date: {norm_date}"
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            category="policy_validity",
                            status=FindingStatus.SUPPORTED,
                            description=f"Incident date ({norm_date}) falls within valid policy coverage period (2026-01-01 to 2026-12-31).",
                            severity=Severity.INFO,
                            policy_clause="Clause 1.2",
                            policy_page=1,
                            source_field="incident_date",
                            raw_evidence_text=f"Incident Date: {norm_date}"
                        )
                    )
            except ValueError:
                findings.append(
                    Finding(
                        category="policy_validity",
                        status=FindingStatus.UNCERTAIN,
                        description=f"Incident date format ('{claim.incident_date}') could not be verified against policy period.",
                        severity=Severity.WARNING,
                        policy_clause="Clause 1.2",
                        policy_page=1
                    )
                )
        else:
            findings.append(
                Finding(
                    category="policy_validity",
                    status=FindingStatus.UNCERTAIN,
                    description=f"Unrecognized incident date format ('{claim.incident_date}').",
                    severity=Severity.WARNING,
                    policy_clause="Clause 1.2",
                    policy_page=1
                )
            )

    return findings


def check_notification_window(claim: ClaimData) -> List[Finding]:
    """Verify claim notification within 7 calendar days (Clause 6.1)."""
    findings: List[Finding] = []

    if claim.incident_date and claim.submission_date:
        days = calculate_notification_days(claim.incident_date, claim.submission_date)
        if days is not None:
            if days <= 7:
                findings.append(
                    Finding(
                        category="notification_window",
                        status=FindingStatus.SUPPORTED,
                        description=f"Claim submitted within {days} day(s) of incident (allowed window is 7 calendar days).",
                        severity=Severity.INFO,
                        policy_clause="Clause 6.1",
                        policy_page=7,
                        source_field="submission_date",
                        raw_evidence_text=f"Incident: {claim.incident_date}, Submission: {claim.submission_date}"
                    )
                )
            else:
                findings.append(
                    Finding(
                        category="notification_window",
                        status=FindingStatus.BLOCKED,
                        description=f"Notice of claim submitted {days} days after incident occurrence, exceeding the 7-day limit in Clause 6.1.",
                        severity=Severity.CRITICAL,
                        policy_clause="Clause 6.1",
                        policy_page=7,
                        source_field="submission_date",
                        raw_evidence_text=f"Incident: {claim.incident_date}, Submission: {claim.submission_date}"
                    )
                )

    return findings


def check_driving_licence_validity(claim: ClaimData) -> List[Finding]:
    """Verify driving licence validity on date of incident (Clause 4.1)."""
    findings: List[Finding] = []

    if claim.incident_type == "accident" and claim.driver_licence_expiry and claim.incident_date:
        valid = is_licence_valid(claim.driver_licence_expiry, claim.incident_date)
        if valid is True:
            findings.append(
                Finding(
                    category="driving_licence",
                    status=FindingStatus.SUPPORTED,
                    description=f"Driver's licence was valid on incident date (Licence expiry: {claim.driver_licence_expiry}, Incident: {claim.incident_date}).",
                    severity=Severity.INFO,
                    policy_clause="Clause 4.1",
                    policy_page=4,
                    source_field="driver_licence_expiry",
                    raw_evidence_text=f"Licence Valid Up To: {claim.driver_licence_expiry}"
                )
            )
        elif valid is False:
            findings.append(
                Finding(
                    category="driving_licence",
                    status=FindingStatus.BLOCKED,
                    description=f"Driver's licence expired on {claim.driver_licence_expiry}, prior to incident date {claim.incident_date}. Triggers exclusion Clause 4.1.",
                    severity=Severity.CRITICAL,
                    policy_clause="Clause 4.1",
                    policy_page=4,
                    source_field="driver_licence_expiry",
                    raw_evidence_text=f"Licence Valid Up To: {claim.driver_licence_expiry}"
                )
            )

    return findings


def check_idv_limits(claim: ClaimData, idv_limit: float = 800000.0) -> List[Finding]:
    """Verify claimed amount against Insured Declared Value (IDV) limit (Clause 1.1 / 7.1)."""
    findings: List[Finding] = []

    if claim.claimed_amount is not None:
        if claim.claimed_amount > idv_limit:
            findings.append(
                Finding(
                    category="idv_limit",
                    status=FindingStatus.BLOCKED,
                    description=f"Claimed estimate (INR {claim.claimed_amount:,.2f}) exceeds declared policy IDV limit (INR {idv_limit:,.2f}).",
                    severity=Severity.CRITICAL,
                    policy_clause="Clause 1.1",
                    policy_page=1,
                    source_field="claimed_amount",
                    raw_evidence_text=f"Claimed Amount: INR {claim.claimed_amount:,.2f}"
                )
            )
        else:
            findings.append(
                Finding(
                    category="idv_limit",
                    status=FindingStatus.SUPPORTED,
                    description=f"Claimed amount (INR {claim.claimed_amount:,.2f}) is within policy IDV limit (INR {idv_limit:,.2f}).",
                    severity=Severity.INFO,
                    policy_clause="Clause 1.1",
                    policy_page=1,
                    source_field="claimed_amount",
                    raw_evidence_text=f"Claimed Amount: INR {claim.claimed_amount:,.2f}"
                )
            )

    return findings
