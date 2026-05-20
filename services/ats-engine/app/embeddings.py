"""Local embeddings via sentence-transformers (MiniLM-L6-v2).

Free, no API key needed, ~80MB model, ~30ms per sentence on CPU.
Replace with voyage-3 / OpenAI embeddings in Phase 4 if needed.
"""
import os
from functools import lru_cache
from typing import List
import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def _model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def embed(texts: List[str]) -> np.ndarray:
    if not texts:
        return np.zeros((0, 384), dtype=np.float32)
    return _model().encode(texts, normalize_embeddings=True, show_progress_bar=False)


def cosine_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.size == 0 or b.size == 0:
        return np.zeros((max(1, a.shape[0]), max(1, b.shape[0])), dtype=np.float32)
    return a @ b.T
