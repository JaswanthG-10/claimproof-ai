import os
import shutil
import pytest
from fastapi.testclient import TestClient

from app import app
from src.schemas import (
    RecommendationType,
    FindingStatus,
    Severity,
    CompletenessResult,
    ClaimData,
    PolicyAssessment
)
from src.claim_analysis import analyze_claim_package
from src.decision import evaluate_recommendation
from src.normalization import (
    normalize_date,
    normalize_vehicle_number,
    amounts_are_compatible,
    calculate_notification_days
)
from src.file_security import validate_file_upload, validate_claim_id, sanitize_filename
from src.rules import check_policy_validity, check_idv_limits, check_notification_window

client = TestClient(app)
BASE_CLAIMS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims")


def test_demo_claim_001_approve():
    """Test Demo Case 1: All documents present, consistent dates, approved."""
    folder = os.path.join(BASE_CLAIMS_DIR, "claim_001_approve")
    review = analyze_claim_package("claim_001_approve", folder)

    assert review.recommendation == RecommendationType.APPROVE
    assert review.completeness.is_complete is True
    assert len(review.completeness.missing_documents) == 0
    assert len(review.contradictions) == 0
    assert review.recommendation_label == "Evidence Appears Ready for Submission"
    assert "claim_form" in review.completeness.submitted_documents
    assert "driving_licence" in review.completeness.submitted_documents
    assert "repair_estimate" in review.completeness.submitted_documents
    assert "registration_certificate" in review.completeness.submitted_documents


def test_demo_claim_002_request_information():
    """Test Demo Case 2: Missing Driving Licence yields REQUEST_INFORMATION."""
    folder = os.path.join(BASE_CLAIMS_DIR, "claim_002_request_information")
    review = analyze_claim_package("claim_002_request_information", folder)

    assert review.recommendation == RecommendationType.REQUEST_INFORMATION
    assert review.completeness.is_complete is False
    assert "driving_licence" in review.completeness.missing_documents
    assert review.recommendation_label == "More Information Needed Before Submission"
    assert any("driving licence" in action.lower() for action in review.next_actions)


def test_demo_claim_003_escalate():
    """Test Demo Case 3: Contradiction in incident dates between Form and FIR yields ESCALATE."""
    folder = os.path.join(BASE_CLAIMS_DIR, "claim_003_escalate")
    review = analyze_claim_package("claim_003_escalate", folder)

    assert review.recommendation == RecommendationType.ESCALATE
    assert len(review.contradictions) >= 1
    # Check that critical contradiction exists on incident_date
    date_c = [c for c in review.contradictions if c.field_name == "incident_date"]
    assert len(date_c) >= 1
    assert date_c[0].severity == Severity.CRITICAL
    assert review.recommendation_label == "Manual Review Needed by Claims Officer"


def test_demo_claim_004_reject():
    """Test Demo Case 4: Prohibited commercial taxi use yields REJECT."""
    folder = os.path.join(BASE_CLAIMS_DIR, "claim_004_reject")
    review = analyze_claim_package("claim_004_reject", folder)

    assert review.recommendation == RecommendationType.REJECT
    assert review.recommendation_label == "Potential Policy Exclusion or Ineligibility Detected"
    # Check that Clause 4.2 was flagged as BLOCKED
    blocked = [pa for pa in review.policy_assessments if pa.clause_id == "Clause 4.2"]
    assert len(blocked) >= 1
    assert blocked[0].classification == FindingStatus.BLOCKED


def test_unsafe_approval_fallback_prevented():
    """Verify that an empty policy_assessments list NEVER produces APPROVE."""
    completeness = CompletenessResult(
        incident_type="accident",
        required_documents=["claim_form"],
        submitted_documents=["claim_form"],
        missing_documents=[],
        is_complete=True
    )
    result = evaluate_recommendation(
        completeness=completeness,
        contradictions=[],
        policy_assessments=[],  # Empty assessments list
        findings=[]
    )
    assert result.recommendation == RecommendationType.ESCALATE
    assert "could not be established" in result.summary_reason.lower()


def test_idv_limit_violation():
    """Test that claimed amount exceeding IDV limit (INR 8,00,000) triggers BLOCKED finding."""
    claim = ClaimData(
        claim_id="CLM-IDV-TEST",
        claimed_amount=950000.0,
        incident_date="2026-06-15"
    )
    findings = check_idv_limits(claim, idv_limit=800000.0)
    assert len(findings) == 1
    assert findings[0].status == FindingStatus.BLOCKED
    assert findings[0].severity == Severity.CRITICAL
    assert "exceeds" in findings[0].description.lower()


def test_policy_period_out_of_bounds():
    """Test that incident date outside 2026 policy coverage window triggers BLOCKED finding."""
    claim_past = ClaimData(claim_id="CLM-PAST", incident_date="2025-11-20")
    findings_past = check_policy_validity(claim_past)
    assert len(findings_past) == 1
    assert findings_past[0].status == FindingStatus.BLOCKED

    claim_future = ClaimData(claim_id="CLM-FUTURE", incident_date="2027-02-10")
    findings_future = check_policy_validity(claim_future)
    assert len(findings_future) == 1
    assert findings_future[0].status == FindingStatus.BLOCKED


def test_date_normalization():
    """Test multi-format date parser and consistency standardizer."""
    assert normalize_date("2026-08-21") == "2026-08-21"
    assert normalize_date("21-08-2026") == "2026-08-21"
    assert normalize_date("21/08/2026") == "2026-08-21"
    assert normalize_date("21 August 2026") == "2026-08-21"
    assert normalize_date("21-Aug-2026") == "2026-08-21"
    assert normalize_date("August 21, 2026") == "2026-08-21"


def test_notification_window_validation():
    """Test notification window checks (Clause 6.1: 7 calendar days)."""
    assert calculate_notification_days("2026-08-20", "2026-08-24") == 4
    assert calculate_notification_days("2026-08-10", "2026-08-25") == 15

    # Test rule findings
    claim_ontime = ClaimData(
        claim_id="CLM-NOTIF-1",
        incident_date="2026-08-20",
        submission_date="2026-08-24"
    )
    findings_ontime = check_notification_window(claim_ontime)
    assert len(findings_ontime) == 1
    assert findings_ontime[0].status == FindingStatus.SUPPORTED

    claim_late = ClaimData(
        claim_id="CLM-NOTIF-2",
        incident_date="2026-08-10",
        submission_date="2026-08-25"
    )
    findings_late = check_notification_window(claim_late)
    assert len(findings_late) == 1
    assert findings_late[0].status == FindingStatus.BLOCKED


def test_file_upload_security():
    """Test upload security: sanitize names, block disallowed extensions and traversal."""
    assert sanitize_filename("../../../malicious_file.pdf") == "malicious_file.pdf"
    assert sanitize_filename("..\\..\\test.pdf") == "test.pdf"

    # Valid upload
    safe_name = validate_file_upload("driving_licence.pdf", b"Dummy PDF content")
    assert safe_name == "driving_licence.pdf"

    # Disallowed extension (.exe)
    with pytest.raises(Exception):
        validate_file_upload("malware.exe", b"Executable binary")

    # Invalid claim ID path traversal
    with pytest.raises(Exception):
        validate_claim_id("../../traversal_claim")


def test_health_endpoint():
    """Test /health API endpoint returns 200 with diagnostics."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "policy_clauses_count" in data
    assert data["policy_clauses_count"] == 12
    assert data["database_connected"] is True


def test_policy_clauses_endpoint():
    """Test /api/policy/clauses returns all 12 policy clauses matching synthetic policy."""
    res = client.get("/api/policy/clauses")
    assert res.status_code == 200
    clauses = res.json()
    assert len(clauses) == 12
    clause_ids = [c["clause_id"] for c in clauses]
    assert "Clause 1.1" in clause_ids
    assert "Clause 1.2" in clause_ids
    assert "Clause 2.1" in clause_ids
    assert "Clause 3.1" in clause_ids
    assert "Clause 4.1" in clause_ids
    assert "Clause 4.2" in clause_ids
    assert "Clause 5.1" in clause_ids
    assert "Clause 6.1" in clause_ids


def test_real_document_upload_pipeline():
    """
    Test real document upload: Upload a driving licence to claim_002_request_information.
    Verifies that pipeline receives the file, re-runs full analysis, and upgrades to APPROVE!
    """
    # Create isolated test claim folder
    test_claim_id = "test_clm_upload_002"
    test_dir = os.path.join(BASE_CLAIMS_DIR, test_claim_id)
    src_dir = os.path.join(BASE_CLAIMS_DIR, "claim_002_request_information")

    os.makedirs(test_dir, exist_ok=True)
    for f in os.listdir(src_dir):
        shutil.copy2(os.path.join(src_dir, f), os.path.join(test_dir, f))

    try:
        # Step 1: Initial state before upload -> REQUEST_INFORMATION (missing driving_licence)
        initial_review = analyze_claim_package(test_claim_id, test_dir)
        assert initial_review.recommendation == RecommendationType.REQUEST_INFORMATION
        assert "driving_licence" in initial_review.completeness.missing_documents

        # Step 2: Upload real driving licence from claim_001
        dl_src_path = os.path.join(BASE_CLAIMS_DIR, "claim_001_approve", "driving_licence.pdf")
        with open(dl_src_path, "rb") as f:
            dl_content = f.read()

        response = client.post(
            f"/api/claims/{test_claim_id}/documents",
            files={"file": ("driving_licence.pdf", dl_content, "application/pdf")}
        )

        assert response.status_code == 200
        updated = response.json()

        # Step 3: Verify the claim is now upgraded to APPROVE!
        assert updated["recommendation"] == "APPROVE"
        assert len(updated["completeness"]["missing_documents"]) == 0
        assert "driving_licence" in updated["completeness"]["submitted_documents"]
        assert updated["recommendation_label"] == "Evidence Appears Ready for Submission"

    finally:
        # Clean up test directory
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)


def test_special_character_filename_upload():
    """
    Test uploading a document with special characters in the filename (<, >, &, quotes).
    Ensures safe filename sanitization without crash and valid review return.
    """
    special_name = "Driving_Licence_<test>&'quoted'.pdf"
    content = b"%PDF-1.4 Mock Driving Licence content for Jaswanth G. DL-TN-2026-99 Valid."
    
    # 1. Verify sanitization
    safe_name = validate_file_upload(special_name, content)
    assert "<" not in safe_name
    assert ">" not in safe_name
    assert "&" not in safe_name
    assert "'" not in safe_name
    assert safe_name.endswith(".pdf")

    # 2. Verify endpoint processes upload safely
    files = {"file": (special_name, content, "application/pdf")}
    res = client.post("/api/claims/claim_001_approve/documents", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "claim_id" in data
    assert data["claim_id"] == "claim_001_approve"
    assert "recommendation" in data


def test_upload_mismatched_document_rejected():
    """
    Test that uploading an incorrect document type (e.g. Repair Estimate instead of Driving Licence)
    is rejected with HTTP 400 and actionable guidance.
    """
    re_path = os.path.join(BASE_CLAIMS_DIR, "claim_001_approve", "repair_estimate.pdf")
    with open(re_path, "rb") as f:
        re_bytes = f.read()

    res = client.post(
        "/api/claims/claim_002_request_information/documents",
        files={"file": ("repair_estimate.pdf", re_bytes, "application/pdf")},
        data={"expected_doc_type": "driving_licence"}
    )
    assert res.status_code == 400
    detail = res.json().get("detail", "")
    assert "Upload rejected" in detail
    assert "Driving Licence" in detail
    assert "Please upload the correct document" in detail


def test_upload_correct_document_with_type_accepted():
    """
    Test that uploading the correct document type (Driving Licence) when expected
    succeeds with HTTP 200 and upgrades claim to APPROVE.
    """
    test_id = "test_clm_upload_dl_verified"
    test_dir = os.path.join(BASE_CLAIMS_DIR, test_id)
    src_dir = os.path.join(BASE_CLAIMS_DIR, "claim_002_request_information")

    os.makedirs(test_dir, exist_ok=True)
    for f in os.listdir(src_dir):
        shutil.copy2(os.path.join(src_dir, f), os.path.join(test_dir, f))

    try:
        dl_path = os.path.join(BASE_CLAIMS_DIR, "claim_001_approve", "driving_licence.pdf")
        with open(dl_path, "rb") as f:
            dl_bytes = f.read()

        res = client.post(
            f"/api/claims/{test_id}/documents",
            files={"file": ("driving_licence.pdf", dl_bytes, "application/pdf")},
            data={"expected_doc_type": "driving_licence"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["recommendation"] == "APPROVE"
        assert len(data["completeness"]["missing_documents"]) == 0
        assert "driving_licence" in data["completeness"]["submitted_documents"]
    finally:
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir, ignore_errors=True)
