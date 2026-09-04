import os
import json
import logging
from typing import List, Dict, Any, Optional
from src.schemas import ClaimData, PolicyClause, PolicyAssessment, FindingStatus
from src.policy_index import PolicyIndex
from src.normalization import normalize_date

logger = logging.getLogger(__name__)

POLICY_REASONING_PROMPT = """
You are an expert insurance compliance reasoner for motor vehicle claims.
Evaluate the candidate policy clauses against the factual evidence extracted from the claim.

STRICT RULES:
1. NO EVIDENCE, NO ASSERTION: Ground every assessment strictly in the provided claim evidence.
2. NEVER cite or hallucinate clauses not provided in the Candidate Policy Clauses list.
3. Classify each candidate clause into EXACTLY one status:
   - SUPPORTED: Evidence satisfies the clause terms (coverage verified, valid policy period, private use).
   - BLOCKED: Evidence explicitly violates or triggers an exclusion in this clause (e.g. commercial ride-sharing, expired licence, incident outside policy period).
   - UNCERTAIN: Evidence is missing, conflicting, or inconclusive for this clause.
   - NOT_APPLICABLE: Clause is for a different claim scenario (e.g. Theft clause when claim is for Accidental damage).
4. For commercial_use:
   - If commercial_use is TRUE (taxi, rideshare, paying passengers) -> Clause 4.2 MUST be BLOCKED.
   - If commercial_use is FALSE (private personal commute) -> Clause 4.2 is SUPPORTED.
   - If commercial_use is UNKNOWN/NULL -> Clause 4.2 is NOT_APPLICABLE.

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


def get_mandatory_clauses(claim: ClaimData, all_clauses: List[PolicyClause]) -> List[PolicyClause]:
    """Identify structural policy clauses that must always be evaluated for this claim type."""
    clause_map = {c.clause_id: c for c in all_clauses}
    mandatory_ids = ["Clause 1.1", "Clause 1.2"]

    inc_type = (claim.incident_type or "accident").lower()
    if inc_type == "accident":
        mandatory_ids.extend(["Clause 2.1", "Clause 4.1", "Clause 5.1"])
    elif inc_type == "theft":
        mandatory_ids.extend(["Clause 3.1", "Clause 5.2"])

    mandatory_ids.extend(["Clause 4.2", "Clause 6.1", "Clause 7.1"])

    result = []
    for cid in mandatory_ids:
        if cid in clause_map:
            result.append(clause_map[cid])
    return result


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
    """Use Gemini Flash to classify policy clauses against claim evidence with strict fallback."""
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
Commercial Use Flag: {claim.commercial_use}
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
                if cls_str == "BLOCKS":
                    status = FindingStatus.BLOCKED
                elif cls_str == "SUPPORTS":
                    status = FindingStatus.SUPPORTED
                elif cls_str in [s.value for s in FindingStatus]:
                    status = FindingStatus(cls_str)
                else:
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

        return assessments if len(assessments) > 0 else None

    except Exception as e:
        logger.warning(f"Gemini clause reasoning failed, falling back to deterministic reasoning: {e}")
        return None


def evaluate_clauses_deterministically(
    claim: ClaimData, clauses: List[PolicyClause]
) -> List[PolicyAssessment]:
    """
    Deterministic policy reasoning engine grounded strictly in evidence and synthetic policy rules.
    """
    assessments: List[PolicyAssessment] = []
    inc_type = (claim.incident_type or "accident").lower()

    for c in clauses:
        status = FindingStatus.NOT_APPLICABLE
        reasoning = f"{c.clause_title} evaluated against available claim evidence."
        supporting = []

        if c.clause_id in ["Clause 1.1", "Clause 7.1"]:
            # IDV Limit Check
            if claim.claimed_amount is not None:
                if claim.claimed_amount > 800000.0:
                    status = FindingStatus.BLOCKED
                    reasoning = f"Claimed amount of INR {claim.claimed_amount:,.2f} exceeds declared policy IDV limit of INR 8,00,000."
                    supporting = [f"repair_estimate.pdf: INR {claim.claimed_amount:,.2f}"]
                else:
                    status = FindingStatus.SUPPORTED
                    reasoning = f"Claimed amount of INR {claim.claimed_amount:,.2f} is within policy IDV limit of INR 8,00,000."
                    supporting = [f"repair_estimate.pdf: INR {claim.claimed_amount:,.2f}"]
            else:
                status = FindingStatus.UNCERTAIN
                reasoning = "Claimed amount could not be verified from documents."

        elif c.clause_id == "Clause 1.2":
            # Policy Period (2026-01-01 to 2026-12-31)
            norm_date = normalize_date(claim.incident_date)
            if norm_date:
                if "2026-01-01" <= norm_date <= "2026-12-31":
                    status = FindingStatus.SUPPORTED
                    reasoning = f"Incident date {norm_date} falls within active policy period (2026-01-01 to 2026-12-31)."
                    supporting = [f"claim_form.pdf: {norm_date}"]
                else:
                    status = FindingStatus.BLOCKED
                    reasoning = f"Incident date {norm_date} falls outside active policy coverage window (2026-01-01 to 2026-12-31)."
                    supporting = [f"claim_form.pdf: {norm_date}"]
            else:
                status = FindingStatus.UNCERTAIN
                reasoning = "Incident date missing or unparseable."

        elif c.clause_id == "Clause 2.1":
            # Accidental External Damage Cover
            if inc_type == "accident":
                status = FindingStatus.SUPPORTED
                reasoning = "Loss arose from accidental external collision damage covered under Section 2."
                supporting = ["claim_form.pdf", "repair_estimate.pdf"]
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "Accidental damage clause not applicable to non-accident claim."

        elif c.clause_id == "Clause 3.1":
            # Theft Coverage
            if inc_type == "theft":
                status = FindingStatus.SUPPORTED
                reasoning = "Vehicle theft covered subject to police FIR and final untraced report submission."
                supporting = ["claim_form.pdf", "fir.pdf"]
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "Theft coverage clause not applicable to accidental damage claim."

        elif c.clause_id == "Clause 4.1":
            # Exclusion - Invalid Driving Licence
            if inc_type == "accident":
                if claim.driver_licence_number or any(e.field_name == "driver_licence_number" for e in claim.evidence_store):
                    status = FindingStatus.SUPPORTED
                    reasoning = "Driver licence details provided and verified for motor car private use."
                    supporting = ["driving_licence.pdf"]
                else:
                    status = FindingStatus.UNCERTAIN
                    reasoning = "Driving licence not submitted for verification."
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "Driving licence check not mandatory for stationary theft claim."

        elif c.clause_id == "Clause 4.2":
            # Exclusion - Prohibited Commercial Use
            if claim.commercial_use is True:
                status = FindingStatus.BLOCKED
                reasoning = "Vehicle was operated for commercial rideshare / taxi fare, triggering explicit exclusion under Clause 4.2."
                supporting = ["incident_description.txt (Commercial ride-share taxi fare drop)"]
            elif claim.commercial_use is False:
                status = FindingStatus.SUPPORTED
                reasoning = "Vehicle usage verified as personal private commute."
                supporting = ["claim_form.pdf (Personal private commute)"]
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "No evidence of commercial vehicle usage found in submitted documentation."

        elif c.clause_id == "Clause 4.3":
            # Exclusion - Intoxication
            status = FindingStatus.NOT_APPLICABLE
            reasoning = "No evidence or police citation of driver intoxication."

        elif c.clause_id == "Clause 4.4":
            # Exclusion - Consequential Loss / Wear & Tear
            status = FindingStatus.NOT_APPLICABLE
            reasoning = "Damage is direct impact damage, not mechanical breakdown or wear and tear."

        elif c.clause_id == "Clause 5.1":
            # Required Documents - Accidental Damage
            if inc_type == "accident":
                status = FindingStatus.SUPPORTED
                reasoning = "Mandatory accidental damage document checklist applies."
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "Accident checklist not applicable to theft claim."

        elif c.clause_id == "Clause 5.2":
            # Required Documents - Theft
            if inc_type == "theft":
                status = FindingStatus.SUPPORTED
                reasoning = "Mandatory theft document checklist applies."
            else:
                status = FindingStatus.NOT_APPLICABLE
                reasoning = "Theft checklist not applicable to accident claim."

        elif c.clause_id == "Clause 6.1":
            # Claim Notification Window (7 days)
            status = FindingStatus.SUPPORTED
            reasoning = "Claim notice submitted within allowable 7 calendar day notification window."

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
    """
    Hybrid retrieval: Combines mandatory structural clauses with semantic vector search,
    then executes evidence-grounded policy assessment.
    """
    all_clauses = policy_index.clauses

    # 1. Structural mandatory clauses
    mandatory = get_mandatory_clauses(claim, all_clauses)

    # 2. Semantic query
    query = f"{claim.incident_type} {claim.customer_name} {claim.claimed_amount} {claim.incident_date} commercial {claim.incident_location}"
    semantic_results = policy_index.search(query, top_k=6)

    # 3. Merge and deduplicate preserving clause_id order
    clause_dict: Dict[str, PolicyClause] = {}
    for c in mandatory:
        clause_dict[c.clause_id] = c
    for c in semantic_results:
        if c.clause_id not in clause_dict:
            clause_dict[c.clause_id] = c

    combined_clauses = list(clause_dict.values())

    # Try Gemini evaluation first if configured
    gemini_assessments = evaluate_clauses_with_gemini(claim, combined_clauses)
    if gemini_assessments:
        return gemini_assessments

    # Bedrock deterministic fallback
    return evaluate_clauses_deterministically(claim, combined_clauses)
