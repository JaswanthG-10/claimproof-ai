import os
import sqlite3
import json
import shutil
import logging
import tempfile
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
from src.parser import validate_uploaded_document_type, parse_document, DOC_TYPE_NORMALIZATION

logger = logging.getLogger(__name__)
router = APIRouter()
templates = Jinja2Templates(directory="templates")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "claimproof.db")

if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    tmp_db = "/tmp/claimproof.db"
    if not os.path.exists(tmp_db) and os.path.exists(DB_PATH):
        try:
            shutil.copyfile(DB_PATH, tmp_db)
        except Exception as e:
            logger.warning(f"Failed to copy DB to /tmp: {e}")
    DB_PATH = tmp_db


def get_claims_base_dir() -> str:
    base_dir = os.path.join(BASE_DIR, "data", "claims")
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        tmp_base = "/tmp/data/claims"
        if not os.path.exists(tmp_base) and os.path.exists(base_dir):
            try:
                shutil.copytree(base_dir, tmp_base, dirs_exist_ok=True)
            except Exception:
                pass
        return tmp_base
    return base_dir


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

    try:
        cursor.execute("ALTER TABLE claims ADD COLUMN recommendation_label TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE evidence ADD COLUMN raw_text TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE findings ADD COLUMN policy_clause TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE findings ADD COLUMN policy_page INTEGER")
    except sqlite3.OperationalError:
        pass


    try:
        cursor.execute("ALTER TABLE reviews ADD COLUMN recommendation_label TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE reviews ADD COLUMN explanation TEXT")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE reviews ADD COLUMN raw_json TEXT")
    except sqlite3.OperationalError:
        pass





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
    base_dir = get_claims_base_dir()
    upload_dir = os.path.join(base_dir, safe_claim_id)
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
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    expected_doc_type: Optional[str] = Form(None)
):
    """
    Real document upload endpoint:
    - Validates file security and claim ID.
    - Uses AI parser to verify document type against expected document (e.g. driving_licence).
    - If document type doesn't match expected requirement, rejects upload with clean actionable message.
    - If valid, saves document to claim directory.
    - Re-runs complete analysis pipeline end-to-end.
    - Persists updated review cleanly.
    - Returns updated ClaimReview payload.
    """
    safe_claim_id = validate_claim_id(claim_id)
    base_dir = get_claims_base_dir()
    claim_dir = os.path.join(base_dir, safe_claim_id)

    # If folder doesn't exist or is empty, initialize it with base files
    os.makedirs(claim_dir, exist_ok=True)
    if safe_claim_id in ["CLM-CUSTOM-001", "claim_002_request_information"]:
        src_folder = os.path.join(base_dir, "claim_002_request_information")
        if os.path.exists(src_folder) and src_folder != claim_dir:
            for sf in os.listdir(src_folder):
                dest_f = os.path.join(claim_dir, sf)
                if not os.path.exists(dest_f):
                    shutil.copy2(os.path.join(src_folder, sf), dest_f)

    content = await file.read()
    safe_name = validate_file_upload(file.filename, content)

    target_type = expected_doc_type or doc_type

    # AI Document Type Verification
    ext = os.path.splitext(safe_name)[1]
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        parsed_doc = parse_document(tmp_path)
        is_valid, detected_type, err_reason = validate_uploaded_document_type(
            filename=safe_name,
            raw_text=parsed_doc.raw_full_text,
            expected_type=target_type
        )
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    if not is_valid:
        logger.warning(f"Document upload rejected for claim '{safe_claim_id}': {err_reason}")
        raise HTTPException(status_code=400, detail=err_reason)

    # Standardize saved filename for recognized document types
    saved_filename = safe_name
    if target_type:
        norm_t = DOC_TYPE_NORMALIZATION.get(target_type.strip().lower(), target_type.strip().lower())
        if norm_t == "driving_licence":
            saved_filename = "driving_licence.pdf" if safe_name.lower().endswith(".pdf") else safe_name

    target_path = os.path.join(claim_dir, saved_filename)
    with open(target_path, "wb") as f:
        f.write(content)

    logger.info(f"Saved verified document '{saved_filename}' to {claim_dir}. Re-analyzing claim package...")

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
