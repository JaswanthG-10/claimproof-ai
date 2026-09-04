import os
import logging
from typing import List, Optional
from src.schemas import (
    ClaimReview,
    ClaimData,
    RecommendationType,
    CompletenessResult,
    Finding,
    FindingStatus,
    Severity,
    EvidenceItem
)
from src.parser import parse_document, ParsedDocument
from src.extraction import extract_document_evidence
from src.evidence import EvidenceStore, detect_contradictions, build_claim_data
from src.policy_index import PolicyIndex
from src.policy_reasoner import analyze_policy_clauses
from src.rules import (
    check_document_completeness,
    check_policy_validity,
    check_driving_licence_validity,
    check_notification_window,
    check_idv_limits
)
from src.decision import evaluate_recommendation, generate_gemini_explanation

logger = logging.getLogger(__name__)

# Module-level singleton policy index
_shared_policy_index: Optional[PolicyIndex] = None


def get_shared_policy_index() -> PolicyIndex:
    global _shared_policy_index
    if _shared_policy_index is None:
        _shared_policy_index = PolicyIndex()
        _shared_policy_index.load_or_build()
    return _shared_policy_index


def analyze_claim_package(
    claim_id: str,
    folder_path: str,
    policy_index: Optional[PolicyIndex] = None
) -> ClaimReview:
    """
    Central, end-to-end analysis pipeline for an insurance claim package.
    Used consistently by demo cases, initial uploads, subsequent document uploads, and automated tests.
    """
    if not os.path.exists(folder_path):
        raise FileNotFoundError(f"Claim folder not found: {folder_path}")

    p_index = policy_index or get_shared_policy_index()

    files = [
        os.path.join(folder_path, f)
        for f in sorted(os.listdir(folder_path))
        if os.path.isfile(os.path.join(folder_path, f))
    ]

    parsed_docs: List[ParsedDocument] = []
    store = EvidenceStore()
    has_parse_errors = False
    parse_warnings: List[str] = []

    for fpath in files:
        doc = parse_document(fpath)
        parsed_docs.append(doc)
        if doc.error:
            has_parse_errors = True
            parse_warnings.append(f"{doc.filename}: {doc.error}")
        if doc.warnings:
            parse_warnings.extend(doc.warnings)

        evidence_items = extract_document_evidence(doc)
        store.add_items(evidence_items)

    # 1. Build aggregated ClaimData
    claim_data = build_claim_data(claim_id, store)

    # 2. Detect Cross-Document Contradictions
    contradictions = detect_contradictions(store)

    # 3. Check Document Completeness
    completeness = check_document_completeness(claim_data.incident_type or "accident", parsed_docs)

    # 4. Perform Policy Retrieval & Reasoning
    policy_assessments = analyze_policy_clauses(claim_data, p_index)

    # 5. Execute Deterministic Rule Checks with full provenance
    validity_findings = check_policy_validity(claim_data)
    dl_findings = check_driving_licence_validity(claim_data)
    notification_findings = check_notification_window(claim_data)
    idv_findings = check_idv_limits(claim_data)

    all_findings: List[Finding] = validity_findings + dl_findings + notification_findings + idv_findings

    # Map policy assessments into findings for transparent UI citation
    for pa in policy_assessments:
        if pa.classification in [FindingStatus.SUPPORTED, FindingStatus.BLOCKED, FindingStatus.UNCERTAIN]:
            sev = Severity.CRITICAL if pa.classification == FindingStatus.BLOCKED else Severity.INFO
            all_findings.append(
                Finding(
                    category=pa.category,
                    status=pa.classification,
                    description=pa.reasoning,
                    severity=sev,
                    policy_clause=pa.clause_id,
                    policy_page=pa.page,
                    raw_evidence_text="; ".join(pa.supporting_evidence) if pa.supporting_evidence else None
                )
            )

    # 6. Evaluate Strict Hierarchical Recommendation
    rec_result = evaluate_recommendation(
        completeness=completeness,
        contradictions=contradictions,
        policy_assessments=policy_assessments,
        findings=all_findings,
        has_parse_errors=has_parse_errors
    )

    # Incorporate parse warnings if any
    if parse_warnings:
        rec_result.analysis_warnings.extend(parse_warnings)

    # 7. Generate narrative explanation
    explanation = generate_gemini_explanation(claim_data, rec_result)

    review = ClaimReview(
        claim_id=claim_id,
        customer_name=claim_data.customer_name or "Claimant",
        vehicle_number=claim_data.vehicle_number or "Vehicle Not Stated",
        incident_type=claim_data.incident_type or "accident",
        incident_date=claim_data.incident_date or "Not specified",
        claimed_amount=claim_data.claimed_amount or 0.0,
        recommendation=rec_result.recommendation,
        recommendation_label=rec_result.recommendation_label,
        completeness=completeness,
        evidence_items=store.items,
        contradictions=contradictions,
        findings=all_findings,
        policy_assessments=policy_assessments,
        explanation=explanation,
        next_actions=rec_result.next_actions,
        analysis_warnings=rec_result.analysis_warnings,
        submission_date=claim_data.submission_date,
        policy_number=claim_data.policy_number,
        driver_name=claim_data.driver_name
    )

    return review
