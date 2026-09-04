TRACK_ID=PS02

# ClaimProof AI - Insurance Claims Evidence Review Assistant

ClaimProof AI is an intelligent, evidence-grounded review assistant built for motor insurance claims (accidental damage and theft for cars and two-wheelers). It automates document verification, evidence consistency checks, policy clause analysis, and recommendation generation while upholding a strict principle:

> **"NO EVIDENCE, NO ASSERTION."**

---

## Problem Statement

Insurance claims processing suffers from manual bottlenecks, human error in cross-checking disparate documents (claim forms, FIRs, repair estimates, driving licences, RCs), and inconsistency in policy interpretation. Manual reviewers can easily miss date mismatches, document omissions, or specific policy exclusions, leading to fraud leakage or delayed legitimate payouts.

---

## Solution Overview

ClaimProof AI solves this by combining deterministic validation rules with LLM-powered semantic extraction and local FAISS vector retrieval. It ingests multi-document claim packages, extracts structured facts with provenance tracking (document name, page number, confidence), checks cross-document consistency deterministically, retrieves relevant policy clauses, and assigns one of four strict recommendations:
1. `APPROVE`: Complete evidence, valid coverage, no contradictions or exclusions.
2. `REQUEST_INFORMATION`: Missing critical mandatory documentation (e.g., driving licence).
3. `ESCALATE`: Material factual contradictions (e.g., date mismatch between Claim Form & FIR) or semantic uncertainty.
4. `REJECT`: Evidence explicitly triggers a policy exclusion clause (e.g., commercial ride-share use on a private vehicle policy).

---

## Architecture

```text
                                 ┌─────────────────────────┐
                                 │   Claim Documents       │
                                 │ (PDFs & TXT files)      │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Document Parser        │
                                 │  (PyMuPDF / fitz)       │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Structured Extraction  │
                                 │ (Gemini 3.5 Flash / JSON│
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │   Evidence Store        │
                                 │ & Contradiction Engine  │
                                 └────────────┬────────────┘
                                              │
                        ┌─────────────────────┴─────────────────────┐
                        ▼                                           ▼
          ┌───────────────────────────┐               ┌───────────────────────────┐
          │  FAISS Policy Retriever   │               │   Deterministic Rules     │
          │  & Policy Reasoner        │               │   (Dates, IDV, Docs Window│
          └─────────────┬─────────────┘               └─────────────┬─────────────┘
                        │                                           │
                        └─────────────────────┬─────────────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Recommendation Engine  │
                                 │ (Strict Rule Hierarchy) │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │ SQLite Store & FastAPI  │
                                 │ Dashboard Interface     │
                                 └─────────────────────────┘
```

---

## GenAI Workflow

1. **Structured Extractions**: Gemini 3.5 Flash converts raw unstructured PDF page text into validated Pydantic JSON objects representing claims, repair estimates, FIRs, and licences.
2. **Local Embedding Vector Search**: Motor policy clauses are chunked and indexed into a local FAISS vector database using embeddings. The top relevant clauses are retrieved based on claim facts.
3. **Semantic Policy Classification**: Gemini evaluates candidate policy clauses against extracted evidence to categorize each clause as `SUPPORTS`, `BLOCKS`, `UNCERTAIN`, or `NOT_APPLICABLE` with exact page & clause citations.
4. **Explanation Generation**: Gemini generates natural-language summaries explaining the final decision reached by the deterministic rule engine.

---

## Deterministic Logic vs LLM Logic

| Task / Domain | Deterministic Logic (Python) | LLM Reasoning (Gemini 3.5 Flash) |
| :--- | :--- | :--- |
| **Field Extraction** | Strict schema validation via Pydantic | Unstructured text parsing to JSON |
| **Contradiction Detection** | Date comparison, exact string/number equality | Narrative interpretation & intent |
| **Document Completeness** | Mandatory doc checklist per claim type | Contextual document type recognition |
| **Policy Search** | Local FAISS vector retrieval & score thresholding | Clause grounding & applicability |
| **Final Recommendation** | Strict hierarchical state machine (cannot be overridden) | Investigator summary explanation |

---

## Data & Synthetic Documents Generated

The project comes pre-seeded with a comprehensive 7-page synthetic motor insurance policy (`data/policy/synthetic_motor_policy.pdf`) and 4 synthetic claim test packages:
1. `claim_001_approve`: Accident claim with all required documents, consistent dates, and amount within IDV limit.
2. `claim_002_request_information`: Accident claim missing driving licence.
3. `claim_003_escalate`: Claim with a material date mismatch (Claim form: Aug 21, 2026 vs. FIR: Aug 22, 2026).
4. `claim_004_reject`: Claim for an accident during commercial ride-share taxi operation on a private vehicle policy (Clause 4.2 Exclusion).

---

## Installation

```bash
# Clone or navigate to the project directory
cd claimproof-ai

# Install dependencies
pip install -r requirements.txt
```

---

## Environment Variables

Set your Gemini API key:

```bash
# Windows PowerShell
$env:GEMINI_API_KEY="your-gemini-api-key-here"

# Linux / macOS / Bash
export GEMINI_API_KEY="your-gemini-api-key-here"
```

*Note: If `GEMINI_API_KEY` is absent, ClaimProof AI operates gracefully using deterministic rule fallbacks without crashing.*

---

## How to Run

Launch the entire application with a single command:

```bash
python app.py
```

The application will launch on:
[http://localhost:8000](http://localhost:8000)

---

## Demo Cases

You can test the 4 pre-configured demo cases directly in the interactive UI or via API:
- **Case 1: Approve** (`claim_001_approve`) -> `APPROVE`
- **Case 2: Missing Document** (`claim_002_request_information`) -> `REQUEST_INFORMATION`
- **Case 3: Factual Mismatch** (`claim_003_escalate`) -> `ESCALATE`
- **Case 4: Policy Exclusion** (`claim_004_reject`) -> `REJECT`

---

## API Endpoints

- `GET /`: Serves the Investigator Dashboard HTML UI.
- `GET /health`: Health status & configuration check.
- `GET /api/demo-cases`: Lists available synthetic demo claims.
- `POST /api/demo-cases/{case_id}/analyze`: Analyzes a specific demo case end-to-end.
- `POST /api/claims/analyze`: Accepts multipart document uploads for dynamic claim evaluation.

---

## Limitations

- Local FAISS vector index uses exact vector distance without graph network clustering.
- OCR on scanned images/handwritten documents relies on PDF text layer availability (PyMuPDF).
- Designed for motor insurance domain (accidental damage and theft).

---

## Future Improvements

- OCR pipeline integration (Tesseract / Vision API) for hand-written police report scanning.
- Automated multi-document fraud ring detection across historical claims in SQLite.
- Interactive human-in-the-loop review workflow for complex escalations.

---

## Demo Video

[Link to Demo Video](https://youtube.com/placeholder-demo-video)
