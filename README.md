TRACK_ID=PS02

# ClaimProof AI - Motor Insurance Claims Evidence Review Assistant

ClaimProof AI is an enterprise-grade, evidence-grounded motor insurance claim checker and preliminary eligibility review assistant built for motor vehicle claims (accidental damage and theft for cars and two-wheelers). It automates document verification, cross-document factual consistency checks, synthetic policy clause grounding, and preliminary claim readiness evaluations while enforcing a strict foundational rule:

> **"NO EVIDENCE, NO ASSERTION."**

---

## Key Highlights

- **Real End-to-End Pipeline**: Zero fake client-side progress bars or mock assertions. Every document upload invokes the central analysis pipeline (`POST /api/claims/{claim_id}/documents`), parses the file, extracts evidence with provenance, evaluates deterministic rules, and returns live assessment results.
- **Strict Deterministic Decision Hierarchy**: LLM explanations are constrained to an immutable decision engine. The LLM can never override policy or rule logic.
- **Safe Approval Gate**: The system strictly prevents unsafe approval fallbacks. Zero policy assessments or empty evidence guarantees `ESCALATE`, never `APPROVE`.
- **Backend Single Source of Truth**: Policy clauses in `data/policy/policy_clauses.json` directly match `synthetic_motor_policy.pdf` and are exposed via `GET /api/policy/clauses` to guarantee 100% clause synchronization across FAISS indexing, backend reasoning, and the frontend UI.
- **Evidence Provenance Tracking**: Every finding and evidence item tracks `source_document`, `page_number`, `source_field`, `raw_evidence_text`, and applicable `policy_clause` citations.
- **Multi-Format Date Normalization**: Standardizes `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, and textual date formats, eliminating false contradictions.
- **13 Automated Unit & Integration Tests**: Comprehensive pytest test suite covering all demo cases, edge cases, IDV limits, notification windows, security validations, and real file uploads.
- **GitHub Actions CI/CD**: Automated linting, bytecode compilation, and test execution workflow in `.github/workflows/ci.yml`.

---

## Architecture & Workflow

```text
                                 ┌─────────────────────────┐
                                 │   Claim Documents       │
                                 │  (PDFs, TXT, Images)    │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Document Parser (fitz) │
                                 │  + OCR Fallback Check   │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │   Evidence Extraction   │
                                 │  (Deterministic Regex   │
                                 │   + Optional Gemini)    │
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
          │   Hybrid Policy Search    │               │   Deterministic Rules     │
          │ (Mandatory Structural     │               │  - Policy Window (1.2)    │
          │  + SHA256 / FAISS Vector) │               │  - Notification 7d (6.1)  │
          └─────────────┬─────────────┘               │  - DL Validity (4.1)      │
                        │                             │  - IDV Limit ₹8L (1.1)    │
                        │                             └─────────────┬─────────────┘
                        └─────────────────────┬─────────────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  Strict Decision Engine │
                                 │   (Immutable Hierarchy) │
                                 └────────────┬────────────┘
                                              │
                                              ▼
                                 ┌─────────────────────────┐
                                 │  SQLite (No Duplicates) │
                                 │   & FastAPI Web UI      │
                                 └─────────────────────────┘
```

---

## Strict Decision Hierarchy

ClaimProof AI evaluates claim eligibility through six deterministic gates:

| Gate | Condition | Outcome | Customer-Facing Label |
| :--- | :--- | :--- | :--- |
| **Gate 0** | File corrupted / unreadable | `ESCALATE` | Manual Review Needed by Claims Officer |
| **Gate 1** | Mandatory preliminary documents missing | `REQUEST_INFORMATION` | More Information Needed Before Submission |
| **Gate 2** | Material cross-document contradiction | `ESCALATE` | Manual Review Needed by Claims Officer |
| **Gate 3** | Policy coverage applicability uncertain | `ESCALATE` | Manual Review Needed by Claims Officer |
| **Gate 4** | Policy exclusion or IDV limit violation | `REJECT` | Potential Policy Exclusion or Ineligibility Detected |
| **Gate 5** | All documents present, verified coverage, no contradictions | `APPROVE` | Evidence Appears Ready for Submission |
| **Gate 6** | Default safety fallback | `ESCALATE` | Manual Review Needed by Claims Officer |

---

## Document Checklists (Synthetic Motor Policy)

### Accidental Damage Claims (Clause 5.1)
- **Mandatory Submission**:
  1. Signed Claim Form
  2. Itemized Repair Estimate from authorized service centre
  3. Valid Driving Licence of the driver
  4. Vehicle Registration Certificate (RC)

### Theft Claims (Clause 3.1 & 5.2)
- **Mandatory Submission**:
  1. Signed Claim Form
  2. Police First Information Report (FIR)
  3. Vehicle Registration Certificate (RC)
- **Settlement Documents** (Required before final payout, flagged as non-blocking notices):
  1. Police Final Non-Traceable Report
  2. Original Vehicle Keys
  3. Ownership Transfer Forms

---

## Pre-Configured Demo Cases

| Case ID | Incident Type | Core Condition | Expected Outcome |
| :--- | :--- | :--- | :--- |
| `claim_001_approve` | Accident | Complete docs, consistent dates, estimate within ₹8,00,000 IDV limit | `APPROVE` |
| `claim_002_request_information` | Accident | Missing mandatory Driving Licence document | `REQUEST_INFORMATION` |
| `claim_003_escalate` | Theft | Contradiction between Claim Form date (2026-08-21) and FIR date (2026-08-22) | `ESCALATE` |
| `claim_004_reject` | Accident | Vehicle operated for commercial ride-share taxi fare (Clause 4.2 Exclusion) | `REJECT` |

---

## API Reference

### Core Endpoints

- `GET /`: Serves the responsive web workspace.
- `GET /health`: Diagnostic health check returning database status, policy clauses count, and vector provider.
- `GET /api/policy/clauses`: Returns the 12 canonical policy clauses derived from `synthetic_motor_policy.pdf`.
- `GET /api/demo-cases`: Lists available demo cases with titles and expected outcomes.
- `POST /api/demo-cases/{case_id}/analyze`: Runs the central analysis pipeline on a pre-seeded demo package.
- `POST /api/claims/analyze`: Ingests initial multipart document uploads and creates a new reviewed claim package.
- `POST /api/claims/{claim_id}/documents`: **Real document upload endpoint**. Saves file to the claim package, re-runs complete pipeline, cleans previous records, and returns the updated `ClaimReview`.
- `GET /api/claims/{claim_id}`: Retrieves stored review details from SQLite.

---

## Installation & Setup

### Prerequisites
- Python 3.10, 3.11, 3.12, 3.13, or 3.14
- Git

```bash
# Clone the repository
git clone https://github.com/JaswanthG-10/claimproof-ai.git
cd claimproof-ai

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables (Optional)

Copy `.env.example` to `.env`:

```bash
# Optional: Set Gemini API key for narrative explanations
# If unset, ClaimProof AI operates in 100% deterministic mode
export GEMINI_API_KEY="your-gemini-api-key"
```

---

## Running the Application

Start the local server:

```bash
python app.py
```

Open your browser at:
**[http://localhost:8000](http://localhost:8000)**

---

## Running Automated Tests

Run the complete 13-test test suite:

```bash
pytest -v tests/
```

Verify Python bytecode compilation:

```bash
python -m compileall .
```

---

## CI/CD Pipeline

The project includes an automated GitHub Actions CI pipeline (`.github/workflows/ci.yml`) that validates every pull request and push to `main`:
1. Checks out repository and sets up Python 3.10 and 3.11.
2. Caches pip dependencies.
3. Installs requirements.
4. Executes `python -m compileall .` for syntax verification.
5. Executes `pytest -v tests/` ensuring 100% test success.

---

## License

MIT License. Designed for Track PS02 — Insurance Claims Evidence Review Assistant.
