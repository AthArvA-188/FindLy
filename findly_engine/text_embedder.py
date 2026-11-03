"""
Text embeddings: Sentence-Transformers when available (384-d MiniLM), else hash-based mock.
Vectors are L2-normalized for stable cosine-related distance with IndexFlatL2.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Optional

import numpy as np

logger = logging.getLogger("FindlyTextEmbedder")

TEXT_EMBED_DIM = 384
DEFAULT_ST_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

__all__ = [
    "TEXT_EMBED_DIM",
    "DEFAULT_ST_MODEL",
    "deterministic_mock_embedding",
    "TextEmbedder",
]


def deterministic_mock_embedding(content: str, dim: int = TEXT_EMBED_DIM) -> np.ndarray:
    seed = int(hashlib.md5(content.encode("utf-8", errors="ignore")).hexdigest(), 16) % (2**32)
    rng = np.random.RandomState(seed)
    vec = rng.rand(dim).astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


class TextEmbedder:
    """
    Lazy-loads SentenceTransformer on first embed() if use_model is True.
    Falls back to deterministic_mock_embedding if import fails or use_model is False.
    """

    def __init__(
        self,
        use_model: bool = True,
        model_name: str = DEFAULT_ST_MODEL,
        embedding_dim: int = TEXT_EMBED_DIM,
    ):
        self.use_model = use_model
        self.model_name = model_name
        self.embedding_dim = embedding_dim
        self._model = None
        self._model_failed = False

    def _ensure_model(self) -> None:
        if not self.use_model or self._model_failed or self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)
            logger.info("Loaded SentenceTransformer: %s", self.model_name)
        except Exception as e:
            self._model_failed = True
            logger.warning("SentenceTransformer unavailable (%s); using mock text embeddings.", e)

    def embed(self, text: str) -> np.ndarray:
        text = (text or "").strip()
        if not text:
            return np.zeros(self.embedding_dim, dtype=np.float32)

        self._ensure_model()
        if self._model is not None:
            v = self._model.encode(
                text,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            v = np.asarray(v, dtype=np.float32).reshape(-1)
            if v.shape[0] != self.embedding_dim:
                raise ValueError(
                    f"Model output dim {v.shape[0]} != expected {self.embedding_dim}"
                )
            return v

        return deterministic_mock_embedding(text, self.embedding_dim)
