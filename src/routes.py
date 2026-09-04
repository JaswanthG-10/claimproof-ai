import os
import sqlite3
import json
import shutil
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from src.schemas import (
    ClaimReview,
    ClaimData,
    RecommendationType,
    CompletenessResult,
    Finding,
    FindingStatus,
    Severity
)
from src.parser import parse_document, ParsedDocument
from src.extraction import extract_document_evidence
from src.evidence import EvidenceStore, detect_contradictions, build_claim_data
from src.policy_index import PolicyIndex
from src.policy_reasoner import analyze_policy_clauses
from src.rules import check_document_completeness, check_policy_validity, check_idv_limits
from src.decision import evaluate_recommendation, generate_gemini_explanation


router = APIRouter()
templates = Jinja2Templates(directory="templates")

# Initialize global FAISS index
policy_index = PolicyIndex()
policy_index.load_or_build()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "claimproof.db")


def init_sqlite_db():
    """Initialize SQLite database tables if not existing."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        customer_name TEXT,
        vehicle_number TEXT,
        incident_type TEXT,
        incident_date TEXT,
        claimed_amount REAL,
        recommendation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        filename TEXT,
        document_type TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        filename TEXT,
        field_name TEXT,
        field_value TEXT,
        source_page INTEGER,
        confidence REAL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        category TEXT,
        status TEXT,
        description TEXT,
        severity TEXT,
        policy_clause TEXT
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        recommendation TEXT,
        explanation TEXT,
        raw_json TEXT
    );
    """)

    conn.commit()
    conn.close()


init_sqlite_db()


def save_review_to_db(review: ClaimReview):
    """Save claim review results to SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "INSERT OR REPLACE INTO claims (id, customer_name, vehicle_number, incident_type, incident_date, claimed_amount, recommendation) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            review.claim_id,
            review.customer_name,
            review.vehicle_number,
            review.incident_type,
            review.incident_date,
            review.claimed_amount,
            review.recommendation.value
        )
    )

    for item in review.evidence_items:
        cursor.execute(
            "INSERT INTO evidence (claim_id, filename, field_name, field_value, source_page, confidence) VALUES (?, ?, ?, ?, ?, ?)",
            (review.claim_id, item.source_document, item.field_name, item.value, item.page_number, item.confidence)
        )

    for f in review.findings:
        cursor.execute(
            "INSERT INTO findings (claim_id, category, status, description, severity, policy_clause) VALUES (?, ?, ?, ?, ?, ?)",
            (review.claim_id, f.category, f.status.value, f.description, f.severity.value, f.policy_clause)
        )

    cursor.execute(
        "INSERT INTO reviews (claim_id, recommendation, explanation, raw_json) VALUES (?, ?, ?, ?)",
        (review.claim_id, review.recommendation.value, review.explanation, review.model_dump_json())
    )

    conn.commit()
    conn.close()


def process_claim_folder(claim_id: str, folder_path: str) -> ClaimReview:
    """Analyze a claim package directory end-to-end."""
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Claim folder not found: {folder_path}")

    files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]

    parsed_docs: List[ParsedDocument] = []
    store = EvidenceStore()

    for fpath in files:
        doc = parse_document(fpath)
        parsed_docs.append(doc)
        evidence_items = extract_document_evidence(doc)
        store.add_items(evidence_items)

    # 1. Build aggregated ClaimData
    claim_data = build_claim_data(claim_id, store)

    # 2. Detect Cross-Document Contradictions
    contradictions = detect_contradictions(store)

    # 3. Check Document Completeness
    completeness = check_document_completeness(claim_data.incident_type or "accident", parsed_docs)

    # 4. Perform FAISS Policy Retrieval & Reasoning
    policy_assessments = analyze_policy_clauses(claim_data, policy_index)

    # 5. Execute Deterministic Rule Checks
    validity_findings = check_policy_validity(claim_data)
    idv_findings = check_idv_limits(claim_data)

    all_findings: List[Finding] = validity_findings + idv_findings

    # Map policy assessments into findings for display
    for pa in policy_assessments:
        if pa.classification in [FindingStatus.SUPPORTED, FindingStatus.BLOCKED, FindingStatus.UNCERTAIN]:
            sev = Severity.CRITICAL if pa.classification == FindingStatus.BLOCKED else Severity.INFO
            all_findings.append(
                Finding(
                    category=pa.category,
                    status=pa.classification,
                    description=pa.reasoning,
                    severity=sev,
                    policy_clause=pa.clause_id
                )
            )

    # 6. Evaluate Recommendation Engine
    rec_result = evaluate_recommendation(
        completeness=completeness,
        contradictions=contradictions,
        policy_assessments=policy_assessments,
        findings=all_findings
    )

    # 7. Generate Gemini narrative explanation
    explanation = generate_gemini_explanation(claim_data, rec_result)

    review = ClaimReview(
        claim_id=claim_id,
        customer_name=claim_data.customer_name or "Unknown Claimant",
        vehicle_number=claim_data.vehicle_number or "Unknown Vehicle",
        incident_type=claim_data.incident_type or "accident",
        incident_date=claim_data.incident_date or "Not specified",
        claimed_amount=claim_data.claimed_amount or 0.0,
        recommendation=rec_result.recommendation,
        completeness=completeness,
        evidence_items=store.items,
        contradictions=contradictions,
        findings=all_findings,
        policy_assessments=policy_assessments,
        explanation=explanation
    )

    save_review_to_db(review)
    return review


# HTTP Routes
@router.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/health")
async def health_check():
    gemini_key = os.environ.get("GEMINI_API_KEY")
    return {
        "status": "ok",
        "gemini_configured": bool(gemini_key),
        "policy_index_loaded": policy_index.index is not None
    }


@router.get("/api/demo-cases")
async def get_demo_cases():
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims")
    cases = [
        {
            "id": "claim_001_approve",
            "title": "Case 1: Standard Accident Claim",
            "expected": "APPROVE",
            "description": "Complete documentation, valid policy, consistent dates & repair estimate within IDV limit."
        },
        {
            "id": "claim_002_request_information",
            "title": "Case 2: Missing Driving Licence",
            "expected": "REQUEST_INFORMATION",
            "description": "Accident claim submitted without mandatory Driving Licence document."
        },
        {
            "id": "claim_003_escalate",
            "title": "Case 3: Incident Date Mismatch",
            "expected": "ESCALATE",
            "description": "Contradiction between Claim Form date (2026-08-21) and Police FIR date (2026-08-22)."
        },
        {
            "id": "claim_004_reject",
            "title": "Case 4: Prohibited Commercial Use",
            "expected": "REJECT",
            "description": "Accident occurred while vehicle was being operated as a commercial ride-share taxi."
        }
    ]
    return cases


@router.post("/api/demo-cases/{case_id}/analyze")
async def analyze_demo_case(case_id: str):
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims")
    folder_path = os.path.join(base_dir, case_id)
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Demo case folder '{case_id}' not found.")

    review = process_claim_folder(case_id, folder_path)
    return review.model_dump()


@router.post("/api/claims/analyze")
async def analyze_uploaded_claim(
    claim_id: str = Form("claim_custom"),
    files: List[UploadFile] = File(...)
):
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims", claim_id)
    os.makedirs(upload_dir, exist_ok=True)

    for file in files:
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    review = process_claim_folder(claim_id, upload_dir)
    return review.model_dump()
