from typing import List, Dict, Any, Optional, Tuple
from src.schemas import EvidenceItem, Contradiction, Severity, ClaimData


class EvidenceStore:
    """Store and normalize evidence items collected from multiple claim documents."""

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
        """Return consensus field value if available."""
        items = self.get_field_values(field_name)
        if not items:
            return None
        # Return value of highest confidence item
        sorted_items = sorted(items, key=lambda x: x.confidence, reverse=True)
        return sorted_items[0].value


def normalize_value(field_name: str, value: str) -> str:
    """Normalize values for deterministic comparison."""
    val = value.strip()

    if field_name == "vehicle_number":
        # Remove spaces and hyphens, uppercase
        return val.replace(" ", "").replace("-", "").upper()
    elif field_name == "policy_number":
        return val.replace(" ", "").upper()
    elif field_name == "incident_date":
        # Standardize YYYY-MM-DD
        return val.replace("/", "-")
    elif field_name == "claimed_amount":
        try:
            amt = float(val.replace(",", "").replace("INR", "").replace("Rs", "").strip())
            return f"{amt:.2f}"
        except Exception:
            return val.lower()
    elif field_name in ["customer_name", "driver_name", "incident_location"]:
        return " ".join(val.lower().split())
    elif field_name == "incident_type":
        if "accident" in val.lower() or "collision" in val.lower():
            return "accident"
        elif "theft" in val.lower() or "stolen" in val.lower():
            return "theft"
        return val.lower()

    return val.lower()


def detect_contradictions(store: EvidenceStore) -> List[Contradiction]:
    """Deterministically check for cross-document value mismatches."""
    contradictions: List[Contradiction] = []

    fields_to_check = [
        "incident_date",
        "vehicle_number",
        "policy_number",
        "driver_name",
        "incident_type",
        "claimed_amount",
        "incident_location"
    ]

    for field in fields_to_check:
        items = store.get_field_values(field)
        if len(items) < 2:
            continue

        # Group items by normalized value
        groups: Dict[str, List[EvidenceItem]] = {}
        for item in items:
            if item.value is None:
                continue
            norm_val = normalize_value(field, item.value)
            if norm_val not in groups:
                groups[norm_val] = []
            groups[norm_val].append(item)

        # If more than 1 distinct value group exists for the same field -> CONTRADICTION!
        if len(groups) > 1:
            keys = list(groups.keys())
            item_a = groups[keys[0]][0]
            item_b = groups[keys[1]][0]

            severity = Severity.CRITICAL if field in ["incident_date", "vehicle_number", "policy_number"] else Severity.WARNING

            desc = f"Material mismatch in {field.replace('_', ' ')} between '{item_a.source_document}' ({item_a.value}) and '{item_b.source_document}' ({item_b.value})."

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
    """Aggregate extracted evidence into a unified ClaimData model."""
    customer_name = store.get_consensus_value("customer_name")
    policy_number = store.get_consensus_value("policy_number")
    vehicle_number = store.get_consensus_value("vehicle_number")
    vehicle_model = store.get_consensus_value("vehicle_model")
    driver_name = store.get_consensus_value("driver_name")
    incident_type = store.get_consensus_value("incident_type") or "accident"
    incident_date = store.get_consensus_value("incident_date")
    incident_location = store.get_consensus_value("incident_location")

    amount_val = store.get_consensus_value("claimed_amount")
    claimed_amount: Optional[float] = None
    if amount_val:
        try:
            claimed_amount = float(amount_val.replace(",", "").replace("INR", "").replace("Rs", "").strip())
        except Exception:
            claimed_amount = None

    comm_val = store.get_consensus_value("commercial_use")
    commercial_use = True if comm_val and comm_val.lower() in ["true", "yes", "1", "commercial"] else False

    return ClaimData(
        claim_id=claim_id,
        customer_name=customer_name,
        policy_number=policy_number,
        vehicle_number=vehicle_number,
        vehicle_model=vehicle_model,
        driver_name=driver_name,
        incident_type=incident_type,
        incident_date=incident_date,
        incident_location=incident_location,
        claimed_amount=claimed_amount,
        commercial_use=commercial_use,
        evidence_store=store.items
    )
