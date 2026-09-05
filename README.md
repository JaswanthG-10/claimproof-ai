TRACK_ID=PS02

# ClaimProof AI

**AI-Powered Motor Insurance Claims Evidence Review Assistant**

ClaimProof AI helps insurance investigators review motor vehicle claims by analyzing claim documents against policy rules and producing evidence-backed recommendations.

## Problem

Insurance investigators manually compare claim forms, repair estimates, FIRs, customer descriptions, and policy documents. These documents may contain missing information, contradictions, or policy violations.

## Solution

ClaimProof AI automatically:

* Reviews uploaded claim documents
* Checks whether required documents are complete
* Detects contradictions between documents
* Matches claims with relevant policy clauses
* Identifies coverage, exclusions, claim limits, and reporting windows
* Cites the evidence behind every finding
* Recommends **Approve, Reject, or Request Missing Information**
* Escalates uncertain cases to a human investigator

## How It Works

```text
Upload Claim Documents
        ↓
Extract Information
        ↓
Check Completeness
        ↓
Detect Contradictions
        ↓
Retrieve Policy Clauses
        ↓
Analyze Evidence
        ↓
Generate Claim Review
        ↓
Approve / Reject / Request Info / Escalate
```

## Key Features

* Multi-document claim analysis
* Policy clause matching
* Evidence citations
* Missing-document detection
* Contradiction detection
* Structured claim review report
* Human escalation for uncertain cases
* Local retrieval pipeline
* Gemini-powered reasoning

## Tech Stack

* **Backend:** Python
* **AI:** Gemini API
* **Embeddings:** `gemini-embedding-001`
* **Vector Search:** Local FAISS / Chroma
* **Frontend:** Web Interface
* **Port:** `8000`

## Run the Project

Install dependencies:

```bash
pip install -r requirements.txt
```

Set Gemini API key:

```bash
export GEMINI_API_KEY="your_api_key"
```

Run:

```bash
python app.py
```

Open:

```text
http://localhost:8000
```

The complete application runs using a single command as required by the hackathon.

## Example Output

```text
Claim Type: Accidental Damage

Documents:
✓ Claim Form
✓ Repair Estimate
✓ Incident Description

Policy:
Clause 3.1 – Accidental Damage Covered

Contradiction:
Claim Form Amount: ₹45,000
Repair Estimate: ₹48,500

Recommendation:
ESCALATE TO INVESTIGATOR

Reason:
Repair amounts do not match.
```

## Safety Principle

ClaimProof AI does not guess when information is missing or contradictory.

**Evidence → Policy Clause → Finding → Recommendation**

Uncertain cases are always escalated to a human investigator.

## Demo Video

**Demo:** https://drive.google.com/file/d/1NdgrGon9IUkmy2s6sABiqPOKV3LKSa4c/view?usp=sharing

---

**ClaimProof AI — Evidence Before Decisions.**

