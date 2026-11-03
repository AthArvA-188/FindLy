import faiss
import numpy as np
import os
import logging
from typing import Tuple, Optional, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FindlyVectorStore")


def _empty_search_result(k: int) -> Tuple[np.ndarray, np.ndarray]:
    """Distances / ids for 'no neighbors' (matches FAISS miss pattern)."""
    d = np.full(k, np.inf, dtype=np.float32)
    i = np.full(k, -1, dtype=np.int64)
    return d, i


class DualVectorIndex:
    """
    ML-1: Dual FAISS Index wrapper (Text 384d / Image 512d).
    """
    def __init__(self, base_path: str = "./data", text_dim: int = 384, image_dim: int = 512):
        self.base_path = base_path
        os.makedirs(base_path, exist_ok=True)
        
        self.text_path = os.path.join(base_path, "text_index.faiss")
        self.image_path = os.path.join(base_path, "image_index.faiss")
        
        self.text_index = self._init_index(self.text_path, text_dim, "Text")
        self.image_index = self._init_index(self.image_path, image_dim, "Image")

    def _init_index(self, path: str, dim: int, name: str) -> faiss.Index:
        if os.path.exists(path):
            try:
                index = faiss.read_index(path)
                # safe dimension extraction (handles IndexIDMap wrapper)
                try:
                    actual_dim = index.d
                except Exception:
                    # fallback: IndexIDMap wraps an index in index.index
                    try:
                        actual_dim = index.index.d
                    except Exception:
                        actual_dim = None
                if actual_dim is None or actual_dim != dim:
                    raise ValueError(f"Dim mismatch or unknown dim: {actual_dim} vs {dim}")
                return index
            except Exception as e:
                logger.warning(f"Reload failed for {name}: {e}. Creating new.")
        
        return faiss.IndexIDMap(faiss.IndexFlatL2(dim))

    def _process_input(self, vector: np.ndarray) -> np.ndarray:
        return np.ascontiguousarray(vector.astype('float32').reshape(1, -1))

    # --- Text ---
    def add_text(self, vector: np.ndarray, doc_id: int):
        self.text_index.add_with_ids(self._process_input(vector), np.array([doc_id], dtype='int64'))

    def remove_text(self, doc_id: int):
        self.text_index.remove_ids(np.array([doc_id], dtype='int64'))

    def search_text(self, query: np.ndarray, k: int = 5, allowed_ids: Optional[List[int]] = None) -> Tuple[np.ndarray, np.ndarray]:
        """
        If allowed_ids is provided (non-empty), restrict search with IDSelectorBatch + SearchParameters.
        Empty allowed_ids returns no hits; on selector failure, log and return empty (fail closed).
        """
        q = self._process_input(query)
        if allowed_ids is not None:
            if len(allowed_ids) == 0:
                return _empty_search_result(k)
            try:
                ids_np = np.ascontiguousarray(np.array(allowed_ids, dtype=np.int64))
                sel = faiss.IDSelectorBatch(len(ids_np), faiss.swig_ptr(ids_np))
                params = faiss.SearchParameters(sel=sel)
                D, I = self.text_index.search(q, k, params=params)
            except Exception as e:
                logger.warning("FAISS text filtered search failed: %s", e)
                return _empty_search_result(k)
        else:
            D, I = self.text_index.search(q, k)
        return D[0], I[0]
    
    # --- Image ---
    def add_image(self, vector: np.ndarray, doc_id: int):
        self.image_index.add_with_ids(self._process_input(vector), np.array([doc_id], dtype='int64'))

    def remove_image(self, doc_id: int):
        self.image_index.remove_ids(np.array([doc_id], dtype='int64'))

    def search_image(self, query: np.ndarray, k: int = 5, allowed_ids: Optional[List[int]] = None) -> Tuple[np.ndarray, np.ndarray]:
        q = self._process_input(query)
        if allowed_ids is not None:
            if len(allowed_ids) == 0:
                return _empty_search_result(k)
            try:
                ids_np = np.ascontiguousarray(np.array(allowed_ids, dtype=np.int64))
                sel = faiss.IDSelectorBatch(len(ids_np), faiss.swig_ptr(ids_np))
                params = faiss.SearchParameters(sel=sel)
                D, I = self.image_index.search(q, k, params=params)
            except Exception as e:
                logger.warning("FAISS image filtered search failed: %s", e)
                return _empty_search_result(k)
        else:
            D, I = self.image_index.search(q, k)
        return D[0], I[0]

    # --- Atomic Save ---
    def save(self):
        for index, path in [(self.text_index, self.text_path), (self.image_index, self.image_path)]:
            tmp_path = path + ".tmp"
            faiss.write_index(index, tmp_path)
            if os.path.exists(path):
                os.remove(path) # Windows compatibility for replace
            os.rename(tmp_path, path)
        logger.info("Indices saved atomically.")