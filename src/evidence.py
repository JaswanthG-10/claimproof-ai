from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from src.schemas import EvidenceItem, Contradiction, Severity, ClaimData
from src.normalization import (
    normalize_date,
    normalize_vehicle_number,
    normalize_policy_number,
    normalize_amount,
    amounts_are_compatible
)


class EvidenceStore:
    """Store, group, and normalize evidence items collected across claim documents."""

    def __init__(self):
        self.items: List[EvidenceItem] = []
        self.by_field: Dict[str, List[EvidenceItem]] = {}

    def add_items(self, items: List[EvidenceItem]):
        for item in items:
            self.items.append(item)
            if item.field_name not in self.by_field:
                self.by_field[item.field_name] = []
            self.by_field[item.field_name].append(item)

    def get_field_values(self, field_name: str) -> List[EvidenceItem]:
        return self.by_field.get(field_name, [])

    def get_consensus_value(self, field_name: str) -> Optional[str]:
        """Return consensus field value based on confidence and frequency."""
        items = self.get_field_values(field_name)
        if not items:
            return None

        # Filter out empty or None values
        valid_items = [it for it in items if it.value and it.value.strip()]
        if not valid_items:
            return None

        # Sort by confidence descending
        sorted_items = sorted(valid_items, key=lambda x: x.confidence, reverse=True)
        return sorted_items[0].value


def normalize_field_for_comparison(field_name: str, value: str) -> str:
    """Normalize values for robust contradiction detection."""
    val = value.strip()

    if field_name == "vehicle_number":
        norm = normalize_vehicle_number(val)
        return norm if norm else val.upper()
    elif field_name == "policy_number":
        norm = normalize_policy_number(val)
        return norm if norm else val.upper()
    elif field_name in ["incident_date", "driver_licence_expiry", "submission_date"]:
        norm = normalize_date(val)
        return norm if norm else val
    elif field_name == "incident_type":
        low = val.lower()
        if "theft" in low or "stolen" in low:
            return "theft"
        elif "accident" in low or "collision" in low:
            return "accident"
        return low
    elif field_name in ["customer_name", "driver_name"]:
        # Collapse whitespace and lowercase
        return " ".join(val.lower().split())

    return val.lower()


def detect_contradictions(store: EvidenceStore) -> List[Contradiction]:
    """
    Deterministically detect cross-document factual contradictions.
    Distinguishes CRITICAL material contradictions from WARNING discrepancies.
    Applies numerical tolerance on claimed amounts.
    """
    contradictions: List[Contradiction] = []

    fields_to_check = [
        "incident_date",
        "vehicle_number",
        "policy_number",
        "incident_type",
        "claimed_amount",
        "driver_name"
    ]

    for field in fields_to_check:
        items = store.get_field_values(field)
        if len(items) < 2:
            continue

        # For amounts, check tolerance
        if field == "claimed_amount":
            amt_items = []
            for it in items:
                amt = normalize_amount(it.value)
                if amt is not None:
                    amt_items.append((amt, it))

            for i in range(len(amt_items)):
                for j in range(i + 1, len(amt_items)):
                    a1, it1 = amt_items[i]
                    a2, it2 = amt_items[j]
                    if not amounts_are_compatible(a1, a2):
                        # Mismatch exceeds tolerance
                        contradictions.append(
                            Contradiction(
                                field_name="claimed_amount",
                                source_a=it1.source_document,
                                value_a=f"INR {a1:,.2f}",
                                page_a=it1.page_number,
                                source_b=it2.source_document,
                                value_b=f"INR {a2:,.2f}",
                                page_b=it2.page_number,
                                severity=Severity.WARNING,
                                description=f"Amount difference between '{it1.source_document}' (INR {a1:,.2f}) and '{it2.source_document}' (INR {a2:,.2f}) exceeds allowable tolerance."
                            )
                        )
            continue

        # Group by normalized value
        groups: Dict[str, List[EvidenceItem]] = {}
        for item in items:
            if not item.value:
                continue
            norm_val = normalize_field_for_comparison(field, item.value)
            if norm_val not in groups:
                groups[norm_val] = []
            groups[norm_val].append(item)

        # If distinct value groups exist for the same field across different documents
        if len(groups) > 1:
            group_keys = list(groups.keys())
            item_a = groups[group_keys[0]][0]
            item_b = groups[group_keys[1]][0]

            # Only flag if sources are actually different or pages differ
            if item_a.source_document != item_b.source_document or item_a.page_number != item_b.page_number:
                severity = Severity.CRITICAL if field in ["incident_date", "vehicle_number", "policy_number"] else Severity.WARNING

                desc = f"Material contradiction in {field.replace('_', ' ')}: '{item_a.source_document}' (Page {item_a.page_number}) reports '{item_a.value}' whereas '{item_b.source_document}' (Page {item_b.page_number}) reports '{item_b.value}'."

                contradictions.append(
                    Contradiction(
                        field_name=field,
                        source_a=item_a.source_document,
                        value_a=item_a.value or "",
                        page_a=item_a.page_number,
                        source_b=item_b.source_document,
                        value_b=item_b.value or "",
                        page_b=item_b.page_number,
                        severity=severity,
                        description=desc
                    )
                )

    return contradictions


def build_claim_data(claim_id: str, store: EvidenceStore) -> ClaimData:
    """Aggregate extracted evidence into an evidence-grounded ClaimData model."""
    customer_name = store.get_consensus_value("customer_name")
    policy_number = store.get_consensus_value("policy_number")
    vehicle_number = store.get_consensus_value("vehicle_number")
    vehicle_model = store.get_consensus_value("vehicle_model")
    driver_name = store.get_consensus_value("driver_name")
    driver_licence_number = store.get_consensus_value("driver_licence_number")
    driver_licence_expiry = store.get_consensus_value("driver_licence_expiry")
    incident_type = store.get_consensus_value("incident_type") or "accident"
    incident_date = store.get_consensus_value("incident_date")
    incident_location = store.get_consensus_value("incident_location")
    submission_date = store.get_consensus_value("submission_date")

    # Claimed amount
    amt_str = store.get_consensus_value("claimed_amount")
    claimed_amount: Optional[float] = normalize_amount(amt_str) if amt_str else None

    # Commercial use evaluation: None = Unknown, True = Commercial, False = Private
    comm_items = store.get_field_values("commercial_use")
    commercial_use: Optional[bool] = None
    if comm_items:
        has_commercial = any(it.value and it.value.lower() == "true" for it in comm_items)
        has_private = any(it.value and it.value.lower() == "false" for it in comm_items)
        if has_commercial:
            commercial_use = True
        elif has_private:
            commercial_use = False

    return ClaimData(
        claim_id=claim_id,
        customer_name=customer_name,
        policy_number=policy_number,
        vehicle_number=vehicle_number,
        vehicle_model=vehicle_model,
        driver_name=driver_name,
        driver_licence_number=driver_licence_number,
        driver_licence_expiry=driver_licence_expiry,
        incident_type=incident_type,
        incident_date=incident_date,
        incident_location=incident_location,
        submission_date=submission_date,
        claimed_amount=claimed_amount,
        commercial_use=commercial_use,
        evidence_store=store.items
    )
