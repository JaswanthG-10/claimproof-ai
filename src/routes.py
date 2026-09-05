import os
import sqlite3
import json
import shutil
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.templating import Jinja2Templates

from src.schemas import (
    ClaimReview,
    ClaimData,
    RecommendationType,
    CompletenessResult,
    Finding,
    FindingStatus,
    Severity,
    PolicyClause
)
from src.policy_index import load_policy_clauses_from_file
from src.claim_analysis import analyze_claim_package, get_shared_policy_index
from src.file_security import sanitize_filename, validate_claim_id, validate_file_upload

logger = logging.getLogger(__name__)
router = APIRouter()
templates = Jinja2Templates(directory="templates")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "claimproof.db")


def init_sqlite_db():
    """Initialize SQLite database tables with proper indexing."""
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
        recommendation_label TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        filename TEXT,
        document_type TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        confidence REAL,
        raw_text TEXT
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
        policy_clause TEXT,
        policy_page INTEGER
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id TEXT,
        recommendation TEXT,
        recommendation_label TEXT,
        explanation TEXT,
        raw_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()


init_sqlite_db()


def save_review_to_db(review: ClaimReview):
    """
    Save or update claim review in SQLite database.
    Cleans previous evidence, findings, and reviews for this claim_id to prevent duplicate row accumulation.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. Update or replace claims record
        cursor.execute(
            """INSERT OR REPLACE INTO claims 
            (id, customer_name, vehicle_number, incident_type, incident_date, claimed_amount, recommendation, recommendation_label) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                review.claim_id,
                review.customer_name,
                review.vehicle_number,
                review.incident_type,
                review.incident_date,
                review.claimed_amount,
                review.recommendation.value,
                review.recommendation_label
            )
        )

        # 2. Clean previous child records to prevent accumulation upon re-analysis
        cursor.execute("DELETE FROM evidence WHERE claim_id = ?", (review.claim_id,))
        cursor.execute("DELETE FROM findings WHERE claim_id = ?", (review.claim_id,))
        cursor.execute("DELETE FROM reviews WHERE claim_id = ?", (review.claim_id,))

        # 3. Insert fresh evidence items
        for item in review.evidence_items:
            cursor.execute(
                """INSERT INTO evidence 
                (claim_id, filename, field_name, field_value, source_page, confidence, raw_text) 
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (review.claim_id, item.source_document, item.field_name, item.value, item.page_number, item.confidence, item.raw_text)
            )

        # 4. Insert fresh findings
        for f in review.findings:
            cursor.execute(
                """INSERT INTO findings 
                (claim_id, category, status, description, severity, policy_clause, policy_page) 
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (review.claim_id, f.category, f.status.value, f.description, f.severity.value, f.policy_clause, f.policy_page)
            )

        # 5. Insert fresh review snapshot
        cursor.execute(
            """INSERT INTO reviews 
            (claim_id, recommendation, recommendation_label, explanation, raw_json) 
            VALUES (?, ?, ?, ?, ?)""",
            (review.claim_id, review.recommendation.value, review.recommendation_label, review.explanation, review.model_dump_json())
        )

        conn.commit()
    except Exception as e:
        logger.error(f"Failed to persist review to SQLite: {e}")
        conn.rollback()
    finally:
        conn.close()


# Static and Health Routes
@router.get("/", response_class=FileResponse)
async def serve_dashboard():
    return FileResponse("templates/index.html")

@router.get("/react", response_class=FileResponse)
async def serve_react_app():
    react_index = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist", "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
    return FileResponse("templates/index.html")


@router.get("/classic", response_class=FileResponse)
async def serve_classic():
    return FileResponse("templates/index.html")


@router.get("/api/claims")
async def list_all_claims():
    """Fetch all claims from SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, customer_name, vehicle_number, incident_type, incident_date, 
               claimed_amount, recommendation, recommendation_label, created_at
        FROM claims ORDER BY created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "customer_name": r[1],
            "vehicle_number": r[2],
            "incident_type": r[3],
            "incident_date": r[4],
            "claimed_amount": r[5],
            "recommendation": r[6],
            "recommendation_label": r[7],
            "created_at": r[8]
        }
        for r in rows
    ]



@router.get("/health")
async def health_check():
    gemini_key = os.environ.get("GEMINI_API_KEY")
    p_index = get_shared_policy_index()
    clauses = p_index.clauses

    db_ok = os.path.exists(DB_PATH)

    return {
        "status": "ok",
        "gemini_configured": bool(gemini_key),
        "policy_index_loaded": p_index.index is not None or p_index.matrix is not None,
        "policy_clauses_count": len(clauses),
        "embedding_provider": p_index.provider,
        "database_connected": db_ok
    }


@router.get("/api/policy/clauses", response_model=List[PolicyClause])
async def get_policy_clauses():
    """Single source of truth for synthetic policy clauses."""
    return load_policy_clauses_from_file()


@router.get("/api/demo-cases")
async def get_demo_cases():
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
    valid_case_id = validate_claim_id(case_id)
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims")
    folder_path = os.path.join(base_dir, valid_case_id)
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Demo case folder '{valid_case_id}' not found.")

    review = analyze_claim_package(valid_case_id, folder_path)
    save_review_to_db(review)
    return review.model_dump()


@router.post("/api/claims/analyze")
async def analyze_uploaded_claim(
    claim_id: str = Form("claim_custom"),
    files: List[UploadFile] = File(...)
):
    safe_claim_id = validate_claim_id(claim_id)
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims", safe_claim_id)
    os.makedirs(upload_dir, exist_ok=True)

    for file in files:
        content = await file.read()
        safe_filename = validate_file_upload(file.filename, content)
        file_path = os.path.join(upload_dir, safe_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(content)

    review = analyze_claim_package(safe_claim_id, upload_dir)
    save_review_to_db(review)
    return review.model_dump()


@router.post("/api/claims/{claim_id}/documents")
async def upload_document_to_claim(
    claim_id: str,
    file: UploadFile = File(...)
):
    """
    Real document upload endpoint:
    - Validates file security and claim ID.
    - Saves document to claim directory.
    - Re-runs complete analysis pipeline end-to-end.
    - Persists updated review cleanly.
    - Returns updated ClaimReview payload.
    """
    safe_claim_id = validate_claim_id(claim_id)
    base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "claims")
    claim_dir = os.path.join(base_dir, safe_claim_id)

    # If folder doesn't exist, create it (or copy base documents if CLM-CUSTOM-001 based on claim_002)
    if not os.path.exists(claim_dir):
        os.makedirs(claim_dir, exist_ok=True)
        # If user is repairing claim_002 (e.g. adding DL to claim_002), make sure base files exist
        if safe_claim_id in ["CLM-CUSTOM-001", "claim_002_request_information"]:
            src_folder = os.path.join(base_dir, "claim_002_request_information")
            if os.path.exists(src_folder) and src_folder != claim_dir:
                for sf in os.listdir(src_folder):
                    shutil.copy2(os.path.join(src_folder, sf), os.path.join(claim_dir, sf))

    content = await file.read()
    safe_name = validate_file_upload(file.filename, content)

    target_path = os.path.join(claim_dir, safe_name)
    with open(target_path, "wb") as f:
        f.write(content)

    logger.info(f"Saved uploaded document '{safe_name}' to {claim_dir}. Re-analyzing claim package...")

    # Re-run full end-to-end pipeline
    updated_review = analyze_claim_package(safe_claim_id, claim_dir)
    save_review_to_db(updated_review)

    return updated_review.model_dump()


@router.get("/api/claims/{claim_id}")
async def get_claim_details(claim_id: str):
    safe_id = validate_claim_id(claim_id)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT raw_json FROM reviews WHERE claim_id = ? ORDER BY id DESC LIMIT 1", (safe_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"No saved review found for claim '{safe_id}'.")

    return json.loads(row[0])
