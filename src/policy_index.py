import os
import json
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from src.schemas import PolicyClause, PolicyData

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False


DEFAULT_INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "index", "precomputed_faiss_files")


SYNTHETIC_CLAUSES: List[PolicyClause] = [
    PolicyClause(
        clause_id="Clause 1.1",
        clause_title="Policy Details & Idv Limit",
        category="insured declared value",
        page=1,
        clause_text="Section 1.1: The Insured Declared Value (IDV) of the vehicle is fixed at INR 8,00,000. Total claim liability for any single loss or damage shall not exceed this declared IDV limit."
    ),
    PolicyClause(
        clause_id="Clause 1.2",
        clause_title="Policy Period",
        category="coverage",
        page=1,
        clause_text="Section 1.2: This Motor Comprehensive Policy is valid from 2026-01-01 to 2026-12-31. Loss or damage occurring outside this policy period is not covered."
    ),
    PolicyClause(
        clause_id="Clause 2.1",
        clause_title="Accidental External Damage Cover",
        category="accidental damage",
        page=2,
        clause_text="Clause 2.1: Accidental external damage caused by collision, impact, overturn, fire, lightning, explosion, or malicious acts is covered subject to policy deductibles and proof of valid driving licence."
    ),
    PolicyClause(
        clause_id="Clause 3.1",
        clause_title="Theft Coverage",
        category="theft",
        page=3,
        clause_text="Clause 3.1: Loss of the insured vehicle due to theft is covered subject to immediate Police First Information Report (FIR) submission, final police non-traceable report, and transfer of vehicle registration certificate & keys to insurer."
    ),
    PolicyClause(
        clause_id="Clause 4.1",
        clause_title="Exclusion - Invalid Driving Licence",
        category="exclusions",
        page=4,
        clause_text="Clause 4.1 Exclusion: The insurer shall not be liable for any loss or damage incurred while the vehicle is driven by any person who does not hold an effective and valid driving licence."
    ),
    PolicyClause(
        clause_id="Clause 4.2",
        clause_title="Exclusion - Prohibited Commercial Use",
        category="exclusions",
        page=4,
        clause_text="Clause 4.2 Exclusion: The insurer shall not be liable for any loss, damage, or third-party liability if the private personal vehicle is operated or hired for commercial purposes, rideshare taxi services, or carriage of goods for hire/reward."
    ),
    PolicyClause(
        clause_id="Clause 4.3",
        clause_title="Exclusion - Intoxication & Illegal Driving",
        category="exclusions",
        page=5,
        clause_text="Clause 4.3 Exclusion: Any loss or damage occurring whilst the driver of the vehicle is under the influence of intoxicating liquor or drugs is strictly excluded from coverage."
    ),
    PolicyClause(
        clause_id="Clause 5.1",
        clause_title="Required Documents - Accidental Damage",
        category="required documents",
        page=6,
        clause_text="Clause 5.1: For accidental damage claims, the insured must submit: (1) Claim Form duly filled and signed, (2) Repair Estimate from authorized repairer, (3) Valid Driving Licence of driver, (4) Registration Certificate (RC)."
    ),
    PolicyClause(
        clause_id="Clause 5.2",
        clause_title="Required Documents - Theft Claims",
        category="required documents",
        page=6,
        clause_text="Clause 5.2: For theft claims, the insured must submit: (1) Claim Form, (2) Police First Information Report (FIR), (3) Registration Certificate (RC), (4) Keys and ownership transfer documentation."
    ),
    PolicyClause(
        clause_id="Clause 6.1",
        clause_title="Claim Notification Window",
        category="claim window",
        page=7,
        clause_text="Clause 6.1: Notice of any claim, accident, or theft must be given in writing to the company immediately and within 7 calendar days of the occurrence of the incident."
    )
]


def _simple_vectorize(text: str, dim: int = 128) -> np.ndarray:
    """Fallback deterministic TF-IDF / hashing vectorizer when Gemini API is unavailable."""
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    for w in words:
        idx = abs(hash(w)) % dim
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


def _get_embedding(text: str, dim: int = 128) -> np.ndarray:
    """Get Gemini embedding or fallback vector representation."""
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
            return emb
        except Exception:
            pass

    return _simple_vectorize(text, dim=dim)


class PolicyIndex:
    """FAISS and Numpy local vector index for motor policy retrieval."""

    def __init__(self, index_dir: str = DEFAULT_INDEX_DIR):
        self.index_dir = index_dir
        self.clauses: List[PolicyClause] = SYNTHETIC_CLAUSES
        self.index = None
        self.matrix: Optional[np.ndarray] = None
        self.dimension: int = 128

    def build_and_save_index(self):
        """Build vector index and save to local directory."""
        os.makedirs(self.index_dir, exist_ok=True)
        embeddings = []

        sample_vec = _get_embedding(self.clauses[0].clause_text)
        self.dimension = len(sample_vec)

        for clause in self.clauses:
            text = f"{clause.clause_id} {clause.clause_title} {clause.category} {clause.clause_text}"
            vec = _get_embedding(text, dim=self.dimension)
            embeddings.append(vec)

        self.matrix = np.array(embeddings, dtype=np.float32)

        if FAISS_AVAILABLE:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.index.add(self.matrix)
            faiss_path = os.path.join(self.index_dir, "index.faiss")
            faiss.write_index(self.index, faiss_path)

        meta_path = os.path.join(self.index_dir, "policy_metadata.json")
        meta_data = [c.model_dump() for c in self.clauses]
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, indent=2)

    def load_or_build(self):
        """Load index from local file or build if absent."""
        faiss_path = os.path.join(self.index_dir, "index.faiss")
        meta_path = os.path.join(self.index_dir, "policy_metadata.json")

        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
                self.clauses = [PolicyClause(**item) for item in meta_data]

                if FAISS_AVAILABLE and os.path.exists(faiss_path):
                    self.index = faiss.read_index(faiss_path)
                    self.dimension = self.index.d
                    return
            except Exception:
                pass

        self.build_and_save_index()

    def search(self, query: str, top_k: int = 4) -> List[PolicyClause]:
        """Search policy index for clauses relevant to query."""
        if self.matrix is None and self.index is None:
            self.load_or_build()

        query_vec = _get_embedding(query, dim=self.dimension).reshape(1, -1)

        if FAISS_AVAILABLE and self.index is not None:
            scores, indices = self.index.search(query_vec, min(top_k, len(self.clauses)))
            results = []
            for idx in indices[0]:
                if 0 <= idx < len(self.clauses):
                    results.append(self.clauses[idx])
            return results
        else:
            # Fallback numpy matrix cosine similarity search
            if self.matrix is None:
                self.build_and_save_index()
            scores = np.dot(self.matrix, query_vec.T).flatten()
            top_indices = np.argsort(scores)[::-1][:min(top_k, len(self.clauses))]
            return [self.clauses[idx] for idx in top_indices]
