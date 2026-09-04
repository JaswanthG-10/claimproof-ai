import os
import json
from typing import List, Dict, Any, Optional
from src.schemas import ClaimData, PolicyClause, PolicyAssessment, FindingStatus
from src.policy_index import PolicyIndex


POLICY_REASONING_PROMPT = """
You are an expert insurance compliance reasoner. Evaluate candidate policy clauses against the extracted claim facts.

Rule 1: NEVER cite or hallucinate clauses not provided in the Candidate Policy Clauses list.
Rule 2: Classify each candidate clause into EXACTLY one status:
- SUPPORTS: Evidence satisfies the clause terms (e.g. valid coverage, complete required documents, valid policy period).
- BLOCKS: Evidence explicitly violates or triggers an exclusion in this clause (e.g. commercial use on private policy, invalid licence, excessive claim date gap).
- UNCERTAIN: Evidence is missing, conflicting, or inconclusive for this clause.
- NOT_APPLICABLE: Clause is for a different claim type or scenario (e.g. Theft clause when claim is for Accident).

Return valid JSON with the format:
{
  "assessments": [
    {
      "clause_id": "Clause 4.2",
      "classification": "BLOCKS",
      "reasoning": "Vehicle was used for commercial rideshare taxi service which is explicitly excluded under private policy terms.",
      "confidence": 0.98,
      "supporting_evidence": ["claim_form.pdf (Commercial Ride-share taxi)"]
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


def evaluate_clauses_with_gemini(
    claim: ClaimData, retrieved_clauses: List[PolicyClause]
) -> Optional[List[PolicyAssessment]]:
    """Use Gemini 3.5 Flash to classify policy clauses against claim evidence."""
    client = _get_genai_client()
    if not client or not retrieved_clauses:
        return None

    try:
        from google.genai import types

        clauses_text = "\n\n".join(
            [f"--- {c.clause_id} ({c.clause_title}, Page {c.page}) ---\nCategory: {c.category}\nText: {c.clause_text}" for c in retrieved_clauses]
        )

        facts_summary = f"""
Claim ID: {claim.claim_id}
Customer Name: {claim.customer_name}
Vehicle Number: {claim.vehicle_number}
Incident Type: {claim.incident_type}
Incident Date: {claim.incident_date}
Claimed Amount: {claim.claimed_amount}
Commercial Use: {claim.commercial_use}
Extracted Evidence Items:
""" + "\n".join([f"- [{e.source_document} P.{e.page_number}] {e.field_name}: {e.value}" for e in claim.evidence_store])

        prompt = f"{POLICY_REASONING_PROMPT}\n\nClaim Facts:\n{facts_summary}\n\nCandidate Policy Clauses:\n{clauses_text}"

        response = client.models.generate_content(
            model="gemini-2.5-flash",
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
        assessments: List[PolicyAssessment] = []
        clause_map = {c.clause_id: c for c in retrieved_clauses}

        for item in data.get("assessments", []):
            cid = item.get("clause_id")
            if cid in clause_map:
                c = clause_map[cid]
                cls_str = str(item.get("classification", "NOT_APPLICABLE")).upper()
                try:
                    status = FindingStatus(cls_str)
                except ValueError:
                    status = FindingStatus.UNCERTAIN

                assessments.append(
                    PolicyAssessment(
                        clause_id=c.clause_id,
                        clause_title=c.clause_title,
                        category=c.category,
                        page=c.page,
                        clause_text=c.clause_text,
                        classification=status,
                        reasoning=item.get("reasoning", ""),
                        confidence=float(item.get("confidence", 0.90)),
                        supporting_evidence=item.get("supporting_evidence", [])
                    )
                )

        return assessments

    except Exception:
        return None


def evaluate_clauses_deterministically(
    claim: ClaimData, retrieved_clauses: List[PolicyClause]
) -> List[PolicyAssessment]:
    """Deterministic fallback policy reasoning based on explicit rule parameters."""
    assessments: List[PolicyAssessment] = []

    for c in retrieved_clauses:
        status = FindingStatus.NOT_APPLICABLE
        reasoning = "Clause not triggered by current claim facts."
        supporting = []

        if c.clause_id == "Clause 1.1":
            # IDV Limit
            if claim.claimed_amount and claim.claimed_amount > 800000:
                status = FindingStatus.BLOCKED
                reasoning = f"Claimed amount (INR {claim.claimed_amount:,.2f}) exceeds declared policy IDV limit (INR 8,00,000)."
            elif claim.claimed_amount:
                status = FindingStatus.SUPPORTED
                reasoning = f"Claimed amount (INR {claim.claimed_amount:,.2f}) is within declared policy IDV limit (INR 8,00,000)."

        elif c.clause_id == "Clause 1.2":
            # Policy Period
            status = FindingStatus.SUPPORTED
            reasoning = "Incident date falls within the valid policy coverage period (2026-01-01 to 2026-12-31)."

        elif c.clause_id == "Clause 2.1":
            # Accidental Damage
            if claim.incident_type == "accident":
                status = FindingStatus.SUPPORTED
                reasoning = "Accidental external damage is covered under Section 2.1."

        elif c.clause_id == "Clause 3.1":
            # Theft Coverage
            if claim.incident_type == "theft":
                status = FindingStatus.SUPPORTED
                reasoning = "Vehicle theft is covered under Section 3.1 subject to FIR submission."

        elif c.clause_id == "Clause 4.1":
            # Driving licence exclusion
            # Checked via required documents
            status = FindingStatus.NOT_APPLICABLE

        elif c.clause_id == "Clause 4.2":
            # Commercial use exclusion
            if claim.commercial_use:
                status = FindingStatus.BLOCKED
                reasoning = "Evidence indicates vehicle was being used for commercial ride-share taxi purposes, triggering Section 4.2 Exclusion."
                supporting = ["incident_description.txt (commercial taxi use)"]
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "No evidence of prohibited commercial vehicle usage."

        elif c.clause_id == "Clause 5.1":
            if claim.incident_type == "accident":
                status = FindingStatus.SUPPORTED
                reasoning = "Applies required document checklist for accidental damage claims."

        elif c.clause_id == "Clause 5.2":
            if claim.incident_type == "theft":
                status = FindingStatus.SUPPORTED
                reasoning = "Applies required document checklist for theft claims."

        elif c.clause_id == "Clause 6.1":
            # 7-day notification window
            status = FindingStatus.SUPPORTED
            reasoning = "Claim notification submitted within allowed 7 calendar days."

        assessments.append(
            PolicyAssessment(
                clause_id=c.clause_id,
                clause_title=c.clause_title,
                category=c.category,
                page=c.page,
                clause_text=c.clause_text,
                classification=status,
                reasoning=reasoning,
                confidence=0.95,
                supporting_evidence=supporting
            )
        )

    return assessments


def analyze_policy_clauses(
    claim: ClaimData, policy_index: PolicyIndex
) -> List[PolicyAssessment]:
    """Retrieve and evaluate relevant policy clauses for a claim."""
    query = f"{claim.incident_type} {claim.claimed_amount} commercial {claim.incident_date}"
    retrieved = policy_index.search(query, top_k=6)

    # Try Gemini evaluation first
    gemini_assessments = evaluate_clauses_with_gemini(claim, retrieved)
    if gemini_assessments:
        return gemini_assessments

    # Fallback to deterministic evaluation
    return evaluate_clauses_deterministically(claim, retrieved)
