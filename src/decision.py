import os
import json
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


def evaluate_recommendation(
    completeness: CompletenessResult,
    contradictions: List[Contradiction],
    policy_assessments: List[PolicyAssessment],
    findings: List[Finding]
) -> RecommendationResult:
    """
    Deterministic Decision Engine.
    Executes decision rules in strict hierarchical order:

    1. If critical required documents are missing -> REQUEST_INFORMATION
    2. If material contradiction exists -> ESCALATE
    3. If policy interpretation is uncertain -> ESCALATE
    4. If a clear applicable exclusion blocks the claim -> REJECT
    5. If coverage supported, docs complete, no critical contradictions, no blocking exclusions -> APPROVE
    6. Otherwise -> ESCALATE
    """

    # Gate 1: Missing critical required documents
    if not completeness.is_complete:
        missing_str = ", ".join([doc.replace("_", " ").title() for doc in completeness.missing_documents])
        return RecommendationResult(
            recommendation=RecommendationType.REQUEST_INFORMATION,
            summary_reason=f"Mandatory documentation missing: {missing_str}.",
            detailed_explanation=f"The claim cannot be processed because mandatory required documents for an {completeness.incident_type} claim are missing: {missing_str}. Please request these documents from the claimant.",
            missing_critical_documents=completeness.missing_documents,
            critical_contradictions=[],
            blocking_clauses=[]
        )

    # Gate 2: Material contradictions across evidence
    critical_contradictions = [c for c in contradictions if c.severity == Severity.CRITICAL]
    if critical_contradictions:
        c_desc = "; ".join([c.description for c in critical_contradictions])
        return RecommendationResult(
            recommendation=RecommendationType.ESCALATE,
            summary_reason="Material factual contradiction detected across claim documents.",
            detailed_explanation=f"The claim contains unresolved material evidence contradictions: {c_desc}. This requires human investigator review.",
            missing_critical_documents=[],
            critical_contradictions=critical_contradictions,
            blocking_clauses=[]
        )

    # Gate 3: Policy assessment uncertainty
    uncertain_assessments = [pa for pa in policy_assessments if pa.classification == FindingStatus.UNCERTAIN]
    uncertain_findings = [f for f in findings if f.status == FindingStatus.UNCERTAIN and f.severity == Severity.CRITICAL]
    if uncertain_assessments or uncertain_findings:
        return RecommendationResult(
            recommendation=RecommendationType.ESCALATE,
            summary_reason="Policy coverage applicability or incident circumstances are uncertain.",
            detailed_explanation="The system identified ambiguous or inconclusive policy clauses or evidence facts that require senior claims manager evaluation.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[]
        )

    # Gate 4: Clear applicable exclusion or blocking clause
    blocking_clauses = [pa for pa in policy_assessments if pa.classification == FindingStatus.BLOCKED]
    blocking_findings = [f for f in findings if f.status == FindingStatus.BLOCKED]

    if blocking_clauses or blocking_findings:
        reasons = []
        for bc in blocking_clauses:
            reasons.append(f"{bc.clause_id} ({bc.clause_title}): {bc.reasoning}")
        for bf in blocking_findings:
            if bf.description not in reasons:
                reasons.append(f"{bf.policy_clause or 'Policy Rule'}: {bf.description}")

        joined_reasons = " ".join(reasons)
        return RecommendationResult(
            recommendation=RecommendationType.REJECT,
            summary_reason="Claim triggers explicit policy exclusion or limit violation.",
            detailed_explanation=f"The claim is recommended for rejection due to policy violations: {joined_reasons}",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=blocking_clauses
        )

    # Gate 5: Complete, consistent, supported claim -> APPROVE
    supported_coverage = any(pa.classification == FindingStatus.SUPPORTED for pa in policy_assessments) or len(policy_assessments) == 0

    if supported_coverage:
        return RecommendationResult(
            recommendation=RecommendationType.APPROVE,
            summary_reason="All mandatory documents present, evidence consistent, coverage verified.",
            detailed_explanation="The claim meets all policy coverage criteria, document requirements, and evidence consistency checks. Recommended for approval.",
            missing_critical_documents=[],
            critical_contradictions=[],
            blocking_clauses=[]
        )

    # Gate 6: Default Fallback -> ESCALATE
    return RecommendationResult(
        recommendation=RecommendationType.ESCALATE,
        summary_reason="Claim requires manual investigator review.",
        detailed_explanation="The claim details require manual verification by an insurance officer.",
        missing_critical_documents=[],
        critical_contradictions=[],
        blocking_clauses=[]
    )


def generate_gemini_explanation(
    claim: ClaimData,
    result: RecommendationResult
) -> str:
    """Generate professional narrative explanation for the recommendation using Gemini 3.5 Flash."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return result.detailed_explanation

    try:
        from google import genai
        client = genai.Client(api_key=api_key)

        prompt = f"""
You are a senior insurance claims officer. Write a concise, professional investigator summary for a claim review.
DO NOT change or alter the decision. The decision is fixed as: {result.recommendation.value}.

Claim ID: {claim.claim_id}
Customer: {claim.customer_name}
Vehicle: {claim.vehicle_number}
Decision: {result.recommendation.value}
Summary Reason: {result.summary_reason}
Technical Explanation: {result.detailed_explanation}

Write 2-3 clean paragraphs summarizing the findings, citations, and next steps for the insurance claims officer.
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        if response.text:
            return response.text.strip()
    except Exception:
        pass

    return result.detailed_explanation
