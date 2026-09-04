import os
import json
import logging
from typing import List, Optional
from src.schemas import (
    RecommendationType,
    RecommendationResult,
    CompletenessResult,
    Contradiction,
    PolicyAssessment,
    Finding,
    FindingStatus,
    Severity,
    ClaimData
)

logger = logging.getLogger(__name__)

RECOMMENDATION_LABELS = {
    RecommendationType.APPROVE: "Evidence Appears Ready for Submission",
    RecommendationType.REQUEST_INFORMATION: "More Information Needed Before Submission",
    RecommendationType.ESCALATE: "Manual Review Needed by Claims Officer",
    RecommendationType.REJECT: "Potential Policy Exclusion or Ineligibility Detected"
}


def evaluate_recommendation(
    completeness: CompletenessResult,
    contradictions: List[Contradiction],
    policy_assessments: List[PolicyAssessment],
    findings: List[Finding],
    has_parse_errors: bool = False
) -> RecommendationResult:
    """
    Strict Deterministic Decision Engine.
    Executes decision gates in an immutable hierarchy:

    Gate 0: Corrupted files or parsing failure -> ESCALATE
    Gate 1: Missing mandatory required documents -> REQUEST_INFORMATION
    Gate 2: Material factual contradictions across evidence -> ESCALATE
    Gate 3: Policy uncertainty or ambiguous incident circumstances -> ESCALATE
    Gate 4: Explicit policy exclusion or coverage limit violation -> REJECT
    Gate 5: Verified coverage, complete documentation, consistent evidence -> APPROVE
    Gate 6: Default safety fallback -> ESCALATE
    """

    next_actions: List[str] = []
    analysis_warnings: List[str] = []

    # Gate 0: Parsing failure or corrupted file
    if has_parse_errors:
        rec = RecommendationType.ESCALATE
        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="One or more uploaded claim documents could not be parsed or read.",
            detailed_explanation="The system encountered unreadable or corrupted files in the claim package. A claims officer must inspect the original documents manually.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[],
            next_actions=["Re-upload clear, uncorrupted PDF or image copies of the affected documents."],
            analysis_warnings=["Document parsing warning: File format or contents unreadable."]
        )

    # Gate 1: Missing critical required documents
    if not completeness.is_complete:
        missing_names = [doc.replace("_", " ").title() for doc in completeness.missing_documents]
        missing_str = ", ".join(missing_names)
        rec = RecommendationType.REQUEST_INFORMATION

        for mdoc in completeness.missing_documents:
            next_actions.append(f"Upload your {mdoc.replace('_', ' ').title()} to complete your claim checklist.")

        if completeness.settlement_documents:
            settle_str = ", ".join([sd.replace("_", " ").title() for sd in completeness.settlement_documents])
            analysis_warnings.append(f"Note: Settlement documentation ({settle_str}) will be required prior to final settlement.")

        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason=f"Mandatory documentation missing: {missing_str}.",
            detailed_explanation=f"Your claim cannot proceed to evaluation yet because mandatory documents for an {completeness.incident_type} claim are missing: {missing_str}. Please upload these documents.",
            missing_critical_documents=completeness.missing_documents,
            critical_contradictions=[],
            blocking_clauses=[],
            next_actions=next_actions,
            analysis_warnings=analysis_warnings
        )

    # Gate 2: Material factual contradictions across evidence
    critical_contradictions = [c for c in contradictions if c.severity == Severity.CRITICAL]
    warning_contradictions = [c for c in contradictions if c.severity == Severity.WARNING]

    if warning_contradictions:
        for wc in warning_contradictions:
            analysis_warnings.append(wc.description)

    if critical_contradictions:
        c_desc = "; ".join([c.description for c in critical_contradictions])
        rec = RecommendationType.ESCALATE

        for cc in critical_contradictions:
            next_actions.append(f"Clarify mismatch in {cc.field_name.replace('_', ' ')} between {cc.source_a} and {cc.source_b}.")

        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="Material factual contradiction detected across claim documents.",
            detailed_explanation=f"The claim evidence contains unresolved material discrepancies: {c_desc}. This requires human verification by a claims officer.",
            missing_critical_documents=[],
            critical_contradictions=critical_contradictions,
            blocking_clauses=[],
            next_actions=next_actions,
            analysis_warnings=analysis_warnings
        )

    # Gate 3: Policy assessment uncertainty
    uncertain_assessments = [pa for pa in policy_assessments if pa.classification == FindingStatus.UNCERTAIN]
    uncertain_findings = [f for f in findings if f.status == FindingStatus.UNCERTAIN and f.severity == Severity.CRITICAL]

    if uncertain_assessments or uncertain_findings:
        rec = RecommendationType.ESCALATE
        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="Policy coverage applicability or incident circumstances are inconclusive.",
            detailed_explanation="The system identified ambiguous or inconclusive policy terms or evidence facts that require manual verification by an insurance officer.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[],
            next_actions=["Provide additional evidence or contact customer support for policy clarification."],
            analysis_warnings=analysis_warnings
        )

    # Gate 4: Clear applicable exclusion or blocking clause
    blocking_clauses = [pa for pa in policy_assessments if pa.classification == FindingStatus.BLOCKED]
    blocking_findings = [f for f in findings if f.status == FindingStatus.BLOCKED]

    if blocking_clauses or blocking_findings:
        reasons = []
        for bc in blocking_clauses:
            reasons.append(f"{bc.clause_id} ({bc.clause_title}): {bc.reasoning}")
        for bf in blocking_findings:
            desc = f"{bf.policy_clause or 'Policy Rule'}: {bf.description}"
            if desc not in reasons:
                reasons.append(desc)

        joined_reasons = " ".join(reasons)
        rec = RecommendationType.REJECT

        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="Claim triggers explicit policy exclusion or limit violation.",
            detailed_explanation=f"Preliminary review indicates ineligibility due to policy provisions: {joined_reasons}",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=blocking_clauses,
            next_actions=["Review the cited policy exclusions or contact your insurance representative if you believe this is in error."],
            analysis_warnings=analysis_warnings
        )

    # Gate 5: Coverage verification check (SAFE APPROVAL REQUIREMENT)
    # Never approve on empty policy_assessments or when no coverage clause supports the claim!
    if not policy_assessments:
        rec = RecommendationType.ESCALATE
        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="Policy coverage could not be established from available evidence.",
            detailed_explanation="Policy coverage could not be confirmed from the submitted documentation. A claims specialist will review the policy schedule manually.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[],
            next_actions=["Wait for claims officer policy review."],
            analysis_warnings=analysis_warnings
        )

    has_supported_coverage = any(
        pa.classification == FindingStatus.SUPPORTED and
        pa.category in ["accidental damage", "theft", "coverage", "required documents", "policy period"]
        for pa in policy_assessments
    )

    if has_supported_coverage:
        rec = RecommendationType.APPROVE
        next_actions.append("All preliminary document and policy checks passed. You may proceed to submit your claim.")
        if completeness.settlement_documents:
            sd_str = ", ".join([sd.replace("_", " ").title() for sd in completeness.settlement_documents])
            analysis_warnings.append(f"Reminder: Keep your {sd_str} ready for final settlement.")

        return RecommendationResult(
            recommendation=rec,
            recommendation_label=RECOMMENDATION_LABELS[rec],
            summary_reason="All mandatory documents present, evidence consistent, policy coverage verified.",
            detailed_explanation="Your claim package satisfies all preliminary policy coverage terms, documentation checklists, and consistency checks. Recommended ready for submission.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[],
            next_actions=next_actions,
            analysis_warnings=analysis_warnings
        )

    # Gate 6: Default fallback -> ESCALATE
    rec = RecommendationType.ESCALATE
    return RecommendationResult(
        recommendation=rec,
        recommendation_label=RECOMMENDATION_LABELS[rec],
        summary_reason="Claim requires manual officer review.",
        detailed_explanation="The claim requires manual verification by an insurance claims officer.",
        missing_critical_documents=[],
        critical_contradictions=[],
        blocking_clauses=[],
        next_actions=["Wait for claims officer assessment."],
        analysis_warnings=analysis_warnings
    )


def generate_gemini_explanation(
    claim: ClaimData,
    result: RecommendationResult
) -> str:
    """Generate professional narrative explanation using Gemini with immutable decision guardrail."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return result.detailed_explanation

    try:
        from google import genai
        client = genai.Client(api_key=api_key)

        prompt = f"""
You are a senior insurance claims officer writing a helpful, transparent, customer-facing summary of a preliminary claim check.
IMMUTABLE RULE: DO NOT change or alter the decision. The decision is strictly fixed as: {result.recommendation.value} ({result.recommendation_label}).

Claim Context:
- Claim ID: {claim.claim_id}
- Customer Name: {claim.customer_name}
- Vehicle Number: {claim.vehicle_number}
- Incident Type: {claim.incident_type}
- Incident Date: {claim.incident_date}
- Claimed Amount: {claim.claimed_amount}
- Decision: {result.recommendation.value}
- Decision Label: {result.recommendation_label}
- Summary Reason: {result.summary_reason}
- Detailed Reason: {result.detailed_explanation}
- Next Actions: {"; ".join(result.next_actions)}
- Warnings: {"; ".join(result.analysis_warnings)}

Write a concise 2-3 paragraph explanation in polite, customer-friendly professional language.
Explain clearly:
1. The preliminary status of the claim.
2. The specific reasons behind the assessment grounded in policy clauses and evidence.
3. What the claimant should do next.
State clearly that this is a preliminary AI readiness check and final formal settlement depends on insurer verification.
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        text = response.text
        return text.strip() if text else result.detailed_explanation

    except Exception as e:
        logger.warning(f"Gemini explanation generation failed: {e}")
        return result.detailed_explanation
