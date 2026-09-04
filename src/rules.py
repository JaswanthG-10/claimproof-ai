from datetime import datetime
from typing import List, Dict, Any, Tuple
from src.schemas import (
    ClaimData,
    CompletenessResult,
    Finding,
    FindingStatus,
    Severity,
    Contradiction
)
from src.parser import ParsedDocument


# Mandatory document checklists by incident type
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


def check_document_completeness(
    incident_type: str, submitted_documents: List[ParsedDocument]
) -> CompletenessResult:
    """Deterministically check if all mandatory documents for the claim type are present."""
    inc_type = incident_type.lower() if incident_type else "accident"
    req_docs = REQUIRED_DOCUMENTS_BY_TYPE.get(inc_type, REQUIRED_DOCUMENTS_BY_TYPE["accident"])

    submitted_types = [doc.document_type for doc in submitted_documents if not doc.error]

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
        is_complete=is_complete
    )


def check_policy_validity(claim: ClaimData) -> List[Finding]:
    """Verify policy validity period and notification window deterministically."""
    findings: List[Finding] = []

    if claim.incident_date:
        try:
            inc_date = datetime.strptime(claim.incident_date, "%Y-%m-%d")
            start_date = datetime(2026, 1, 1)
            end_date = datetime(2026, 12, 31)

            if not (start_date <= inc_date <= end_date):
                findings.append(
                    Finding(
                        category="policy_validity",
                        status=FindingStatus.BLOCKED,
                        description=f"Incident date ({claim.incident_date}) falls outside active policy coverage window (2026-01-01 to 2026-12-31).",
                        severity=Severity.CRITICAL,
                        policy_clause="Clause 1.2"
                    )
                )
            else:
                findings.append(
                    Finding(
                        category="policy_validity",
                        status=FindingStatus.SUPPORTED,
                        description="Incident date is within valid policy coverage period.",
                        severity=Severity.INFO,
                        policy_clause="Clause 1.2"
                    )
                )

        except ValueError:
            findings.append(
                Finding(
                    category="policy_validity",
                    status=FindingStatus.UNCERTAIN,
                    description=f"Incident date format ('{claim.incident_date}') could not be parsed deterministically.",
                    severity=Severity.WARNING,
                    policy_clause="Clause 1.2"
                )
            )

    return findings


def check_idv_limits(claim: ClaimData, idv_limit: float = 800000.0) -> List[Finding]:
    """Verify claim amount against Insured Declared Value (IDV) limit."""
    findings: List[Finding] = []

    if claim.claimed_amount is not None:
        if claim.claimed_amount > idv_limit:
            findings.append(
                Finding(
                    category="idv_limit",
                    status=FindingStatus.BLOCKED,
                    description=f"Claimed repair estimate (INR {claim.claimed_amount:,.2f}) exceeds policy IDV limit (INR {idv_limit:,.2f}).",
                    severity=Severity.CRITICAL,
                    policy_clause="Clause 1.1"
                )
            )
        else:
            findings.append(
                Finding(
                    category="idv_limit",
                    status=FindingStatus.SUPPORTED,
                    description=f"Claimed amount (INR {claim.claimed_amount:,.2f}) is within policy IDV limit (INR {idv_limit:,.2f}).",
                    severity=Severity.INFO,
                    policy_clause="Clause 1.1"
                )
            )

    return findings
