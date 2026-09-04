import os
import json
import hashlib
import logging
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from src.schemas import PolicyClause

logger = logging.getLogger(__name__)

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

DEFAULT_INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "index", "precomputed_faiss_files")
POLICY_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "policy", "policy_clauses.json")


def load_policy_clauses_from_file() -> List[PolicyClause]:
    """Load canonical policy clauses from data/policy/policy_clauses.json."""
    if os.path.exists(POLICY_JSON_PATH):
        try:
            with open(POLICY_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            clauses = [PolicyClause(**item) for item in data]
            if clauses:
                return clauses
        except Exception as e:
            logger.warning(f"Could not load policy clauses from JSON file: {e}")

    # Fallback to embedded canonical definitions
    return [
        PolicyClause(
            clause_id="Clause 1.1",
            clause_title="Insured Declared Value (IDV Limit)",
            category="insured declared value",
            page=1,
            clause_text="Section 1.1: The Insured Declared Value (IDV) of the vehicle is fixed at INR 8,00,000. Total claim liability for any single loss or damage shall not exceed this declared IDV limit."
        ),
        PolicyClause(
            clause_id="Clause 1.2",
            clause_title="Policy Period",
            category="policy period",
            page=1,
            clause_text="Section 1.2: This Motor Comprehensive Policy is valid from 2026-01-01 to 2026-12-31. Loss or damage occurring outside this policy period is not covered under any circumstances."
        ),
        PolicyClause(
            clause_id="Clause 2.1",
            clause_title="Accidental External Damage Cover",
            category="accidental damage",
            page=2,
            clause_text="Clause 2.1: Subject to terms and conditions, the Company indemnifies against accidental external damage, collision, fire, lightning, explosion, or malicious acts. Deductible applicable per claim: INR 1,000 standard compulsory deductible."
        ),
        PolicyClause(
            clause_id="Clause 3.1",
            clause_title="Theft Coverage & Requirements",
            category="theft",
            page=3,
            clause_text="Clause 3.1: Loss of vehicle due to theft is covered up to IDV subject to immediate Police First Information Report (FIR), written notice within 7 days, submission of Police Final Non-Traceable Report, and transfer of RC and original keys."
        ),
        PolicyClause(
            clause_id="Clause 4.1",
            clause_title="Exclusion - Invalid Driving Licence",
            category="exclusions",
            page=4,
            clause_text="Clause 4.1 Exclusion: The Company shall not be liable for any loss or damage incurred while the vehicle is driven by or is under the control of any person who does not hold an effective and valid driving licence at the time of the accident."
        ),
        PolicyClause(
            clause_id="Clause 4.2",
            clause_title="Exclusion - Prohibited Commercial Use",
            category="exclusions",
            page=4,
            clause_text="Clause 4.2 Exclusion: The Company shall not be liable for any loss, damage, or third-party liability if the private personal vehicle is operated, rented, hired, or used for commercial purposes, rideshare taxi operations (including Uber, Ola, or commercial transport), or carriage of goods for hire or reward."
        ),
        PolicyClause(
            clause_id="Clause 4.3",
            clause_title="Exclusion - Intoxication & Illegal Driving",
            category="exclusions",
            page=5,
            clause_text="Clause 4.3 Exclusion: Any loss or damage occurring whilst the driver of the vehicle is under the influence of intoxicating liquor or drugs is strictly excluded from coverage."
        ),
        PolicyClause(
            clause_id="Clause 4.4",
            clause_title="Exclusion - Consequential Loss & Wear & Tear",
            category="exclusions",
            page=5,
            clause_text="Clause 4.4 Exclusion: Consequential loss, depreciation, wear and tear, mechanical or electrical breakdown, failures or breakages are strictly excluded."
        ),
        PolicyClause(
            clause_id="Clause 5.1",
            clause_title="Required Documents - Accidental Damage Claims",
            category="required documents",
            page=6,
            clause_text="Clause 5.1: For processing any accidental damage claim, the insured must submit: (1) Official Claim Form duly filled and signed, (2) Itemized Repair Estimate from authorized repair centre, (3) Valid Driving Licence of the driver at the time of accident, (4) Vehicle Registration Certificate (RC)."
        ),
        PolicyClause(
            clause_id="Clause 5.2",
            clause_title="Required Documents - Theft Claims",
            category="required documents",
            page=6,
            clause_text="Clause 5.2: For processing any theft claim, the insured must submit: (1) Official Claim Form, (2) Police First Information Report (FIR), (3) Vehicle Registration Certificate (RC), (4) Original Vehicle Keys and ownership transfer documents."
        ),
        PolicyClause(
            clause_id="Clause 6.1",
            clause_title="Claim Notification Window",
            category="claim window",
            page=7,
            clause_text="Clause 6.1: Notice of any claim, accident, or theft must be given in writing to the Company immediately and within 7 calendar days of the occurrence of the incident. Delay in notification without valid justification may prejudice claim settlement."
        ),
        PolicyClause(
            clause_id="Clause 7.1",
            clause_title="Maximum Insured Declared Value Limit",
            category="coverage limit",
            page=7,
            clause_text="Clause 7.1: The maximum indemnity payable under this policy is strictly limited to the Insured Declared Value (IDV) of INR 8,00,000 specified in the Policy Schedule."
        )
    ]


def _deterministic_vectorize(text: str, dim: int = 128) -> np.ndarray:
    """
    Deterministic SHA-256 word-hashing vectorizer.
    Guarantees 100% reproducible vectors across processes, platforms, and Python restarts.
    """
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().replace("-", " ").replace("_", " ").split()
    for w in words:
        digest = hashlib.sha256(w.encode("utf-8")).digest()
        # Convert first 4 bytes to integer mod dim
        idx = int.from_bytes(digest[:4], byteorder="big") % dim
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def _get_embedding(text: str, dim: int = 128) -> Tuple[np.ndarray, str]:
    """Get Gemini embedding or deterministic SHA-256 vector representation."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            result = client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            emb = np.array(result.embedding.values, dtype=np.float32)
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb /= norm
            return emb, "gemini-text-embedding-004"
        except Exception as e:
            logger.warning(f"Gemini embedding failed, falling back to deterministic vectorizer: {e}")

    return _deterministic_vectorize(text, dim=dim), "sha256_deterministic"


class PolicyIndex:
    """FAISS and Numpy local vector index for motor policy retrieval."""

    def __init__(self, index_dir: str = DEFAULT_INDEX_DIR):
        self.index_dir = index_dir
        self.clauses: List[PolicyClause] = load_policy_clauses_from_file()
        self.index = None
        self.matrix: Optional[np.ndarray] = None
        self.dimension: int = 128
        self.provider: str = "sha256_deterministic"

    def build_and_save_index(self):
        """Build vector index and save to local directory with metadata."""
        os.makedirs(self.index_dir, exist_ok=True)
        self.clauses = load_policy_clauses_from_file()
        embeddings = []

        active_provider = "sha256_deterministic"
        for c in self.clauses:
            full_text = f"{c.clause_id} {c.clause_title} {c.category} {c.clause_text}"
            emb, provider = _get_embedding(full_text, dim=self.dimension)
            active_provider = provider
            embeddings.append(emb)

        emb_matrix = np.array(embeddings, dtype=np.float32)
        self.matrix = emb_matrix
        self.dimension = emb_matrix.shape[1]
        self.provider = active_provider

        if FAISS_AVAILABLE:
            try:
                faiss_index = faiss.IndexFlatIP(self.dimension)
                faiss_index.add(emb_matrix)
                self.index = faiss_index
                faiss_path = os.path.join(self.index_dir, "index.faiss")
                faiss.write_index(faiss_index, faiss_path)
            except Exception as e:
                logger.warning(f"Failed to write FAISS index: {e}")
                self.index = None
        else:
            self.index = None

        meta = {
            "dimension": self.dimension,
            "provider": self.provider,
            "clauses_count": len(self.clauses),
            "clauses": [c.model_dump() for c in self.clauses]
        }
        meta_path = os.path.join(self.index_dir, "policy_metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        logger.info(f"Successfully built policy index ({len(self.clauses)} clauses, provider: {self.provider}).")

    def load_or_build(self):
        """Load index from disk or build if missing/mismatched."""
        meta_path = os.path.join(self.index_dir, "policy_metadata.json")
        faiss_path = os.path.join(self.index_dir, "index.faiss")

        rebuild_needed = False
        if not os.path.exists(meta_path):
            rebuild_needed = True
        else:
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                loaded_clauses = [PolicyClause(**item) for item in meta.get("clauses", [])]
                # Check clause count and provider consistency
                current_file_clauses = load_policy_clauses_from_file()
                if len(loaded_clauses) != len(current_file_clauses):
                    rebuild_needed = True
                else:
                    self.clauses = loaded_clauses
                    self.dimension = meta.get("dimension", 128)
                    self.provider = meta.get("provider", "sha256_deterministic")

                    if FAISS_AVAILABLE and os.path.exists(faiss_path):
                        self.index = faiss.read_index(faiss_path)
                    else:
                        # Rebuild matrix for cosine search fallback
                        self.matrix = np.array(
                            [_deterministic_vectorize(f"{c.clause_id} {c.clause_title} {c.category} {c.clause_text}", dim=self.dimension) for c in self.clauses],
                            dtype=np.float32
                        )
            except Exception as e:
                logger.warning(f"Failed to load existing index, will rebuild: {e}")
                rebuild_needed = True

        if rebuild_needed:
            self.build_and_save_index()

    def search(self, query: str, top_k: int = 5) -> List[PolicyClause]:
        """Search policy index for most relevant clauses."""
        if not self.clauses:
            self.load_or_build()

        q_vec, _ = _get_embedding(query, dim=self.dimension)
        q_vec = q_vec.reshape(1, -1).astype(np.float32)

        if self.index is not None:
            try:
                distances, indices = self.index.search(q_vec, min(top_k, len(self.clauses)))
                results = []
                for idx in indices[0]:
                    if 0 <= idx < len(self.clauses):
                        results.append(self.clauses[idx])
                return results
            except Exception as e:
                logger.warning(f"FAISS search failed, using matrix cosine search: {e}")

        # Fallback cosine matrix search
        if self.matrix is None or len(self.matrix) != len(self.clauses):
            self.matrix = np.array(
                [_deterministic_vectorize(f"{c.clause_id} {c.clause_title} {c.category} {c.clause_text}", dim=self.dimension) for c in self.clauses],
                dtype=np.float32
            )

        sims = np.dot(self.matrix, q_vec.flatten())
        top_indices = np.argsort(-sims)[:min(top_k, len(self.clauses))]
        return [self.clauses[i] for i in top_indices]
