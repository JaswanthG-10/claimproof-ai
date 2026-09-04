from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class FindingStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    BLOCKED = "BLOCKED"
    MISSING = "MISSING"
    CONTRADICTED = "CONTRADICTED"
    UNCERTAIN = "UNCERTAIN"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class RecommendationType(str, Enum):
    APPROVE = "APPROVE"
    REQUEST_INFORMATION = "REQUEST_INFORMATION"
    ESCALATE = "ESCALATE"
    REJECT = "REJECT"


class DocumentMetadata(BaseModel):
    id: str
    claim_id: str
    filename: str
    document_type: str
    total_pages: int = 1
    confidence: float = 1.0


class EvidenceItem(BaseModel):
    field_name: str
    value: Optional[str] = None
    source_document: str
    page_number: int = 1
    confidence: float = 1.0
    raw_text: Optional[str] = None


class Contradiction(BaseModel):
    field_name: str
    source_a: str
    value_a: str
    page_a: int = 1
    source_b: str
    value_b: str
    page_b: int = 1
    severity: Severity = Severity.CRITICAL
    description: str


class CompletenessResult(BaseModel):
    incident_type: str
    required_documents: List[str]
    submitted_documents: List[str]
    missing_documents: List[str]
    is_complete: bool
    settlement_documents: List[str] = Field(default_factory=list)


class PolicyClause(BaseModel):
    clause_id: str
    clause_title: str
    category: str
    page: int
    clause_text: str


class PolicyAssessment(BaseModel):
    clause_id: str
    clause_title: str
    category: str
    page: int
    clause_text: str
    classification: FindingStatus  # SUPPORTED, BLOCKED, UNCERTAIN, NOT_APPLICABLE
    reasoning: str
    confidence: float = 1.0
    supporting_evidence: List[str] = Field(default_factory=list)


class Finding(BaseModel):
    category: str
    status: FindingStatus
    description: str
    severity: Severity
    source_document: Optional[str] = None
    source_page: Optional[int] = None
    source_field: Optional[str] = None
    raw_evidence_text: Optional[str] = None
    policy_clause: Optional[str] = None
    policy_page: Optional[int] = None
    evidence_ids: List[str] = Field(default_factory=list)


class RecommendationResult(BaseModel):
    recommendation: RecommendationType
    recommendation_label: str = ""
    summary_reason: str
    detailed_explanation: str
    missing_critical_documents: List[str] = Field(default_factory=list)
    critical_contradictions: List[Contradiction] = Field(default_factory=list)
    blocking_clauses: List[PolicyAssessment] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)
    analysis_warnings: List[str] = Field(default_factory=list)


class ClaimData(BaseModel):
    claim_id: str
    customer_name: Optional[str] = None
    policy_number: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_model: Optional[str] = None
    driver_name: Optional[str] = None
    driver_licence_number: Optional[str] = None
    driver_licence_expiry: Optional[str] = None
    incident_type: Optional[str] = None  # accident / theft
    incident_date: Optional[str] = None  # YYYY-MM-DD
    incident_location: Optional[str] = None
    submission_date: Optional[str] = None  # YYYY-MM-DD
    claimed_amount: Optional[float] = None
    commercial_use: Optional[bool] = None  # None = Unknown/Not Mentioned, True = Commercial, False = Private
    evidence_store: List[EvidenceItem] = Field(default_factory=list)


class PolicyData(BaseModel):
    policy_number: str
    policyholder_name: str
    vehicle_number: str
    vehicle_model: str
    policy_start_date: str
    policy_end_date: str
    insured_declared_value: float
    permitted_use: str  # e.g., Private personal use only
    clauses: List[PolicyClause] = Field(default_factory=list)


class ClaimReview(BaseModel):
    claim_id: str
    customer_name: str
    vehicle_number: str
    incident_type: str
    incident_date: str
    claimed_amount: float
    recommendation: RecommendationType
    recommendation_label: Optional[str] = None
    completeness: CompletenessResult
    evidence_items: List[EvidenceItem]
    contradictions: List[Contradiction]
    findings: List[Finding]
    policy_assessments: List[PolicyAssessment]
    explanation: str
    next_actions: List[str] = Field(default_factory=list)
    analysis_warnings: List[str] = Field(default_factory=list)
    submission_date: Optional[str] = None
    policy_number: Optional[str] = None
    driver_name: Optional[str] = None
