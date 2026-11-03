"""
FindlyEngine: ingestion, PDF chunking (25% overlap by default), FAISS + SQLite.
Text embeddings: SentenceTransformers (384-d MiniLM) when available, else deterministic mock.
Thread-safe within process only; not safe for multi-process writes.
"""

import os
import logging
import hashlib
import threading
import numpy as np
from typing import List, Dict, Any, Optional

from .metadata import MetadataStore
from .vector_store import DualVectorIndex
from .chunking import chunk_text_with_overlap
from .text_embedder import TextEmbedder, DEFAULT_ST_MODEL, deterministic_mock_embedding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FindlyEngine")

# optional libs for extraction (import attempts)
try:
    import pdfplumber
except Exception:
    pdfplumber = None

try:
    from PIL import Image
except Exception:
    Image = None


class FindlyEngine:
    def __init__(
        self,
        base_path: str = "./data",
        *,
        pdf_chunk_size: int = 800,
        pdf_chunk_overlap: float = 0.25,
        use_sentence_transformer: bool = False,
        sentence_transformer_model: Optional[str] = None,
    ):
        self.base_path = base_path
        self.pdf_chunk_size = pdf_chunk_size
        self.pdf_chunk_overlap = pdf_chunk_overlap
        # ensure directory exists so SQLite/FAISS can create files there
        os.makedirs(self.base_path, exist_ok=True)

        self.lock = threading.Lock() # Concurrency Safeguard

        self.metadata = MetadataStore(os.path.join(self.base_path, "findly_metadata.db"))
        self.vector_store = DualVectorIndex(self.base_path)
        self._text_embedder = TextEmbedder(
            use_model=use_sentence_transformer,
            model_name=(sentence_transformer_model or DEFAULT_ST_MODEL),
        )

    def _embed_text(self, text: str) -> np.ndarray:
        """384-d unit vector (or zero if empty) for text index."""
        return self._text_embedder.embed(text)

    def _generate_id(self, filepath: str, index_type: str) -> int:
        # Robust ID: First 8 bytes of SHA256 -> int64
        h = hashlib.sha256(f"{filepath}_{index_type}".encode()).digest()
        return int.from_bytes(h[:8], 'big', signed=True)

    def _compute_checksum(self, filepath: str) -> str:
        # Strong checksum (MD5)
        hash_md5 = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def _generate_page_id(self, filepath: str, index_type: str, page: int = 1, chunk: int = 0) -> int:
        """
        Stable int64 id for file+index_type+page+chunk.
        """
        unique = f"{filepath}::{index_type}::p{page}::c{chunk}"
        h = hashlib.sha256(unique.encode()).digest()
        return int.from_bytes(h[:8], 'big', signed=True)

    def _text_preview(self, text: str, n: int = 200) -> str:
        if not text:
            return ""
        preview = " ".join(text.strip().split())
        return preview[:n]

    def extract_pdf_pages(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Returns one dict per text chunk. Each PDF page is split with character chunking
        and pdf_chunk_overlap (default 25% overlap between consecutive chunks).
        """
        items: List[Dict[str, Any]] = []
        if pdfplumber:
            try:
                with pdfplumber.open(filepath) as pdf:
                    for i, page in enumerate(pdf.pages, start=1):
                        try:
                            text = (page.extract_text() or "").strip()
                        except Exception:
                            text = ""
                        chunks = chunk_text_with_overlap(
                            text,
                            self.pdf_chunk_size,
                            self.pdf_chunk_overlap,
                        )
                        if not chunks:
                            continue
                        for cidx, chunk in enumerate(chunks):
                            items.append({
                                "type": "text",
                                "content": chunk,
                                "meta": {
                                    "page": i,
                                    "chunk_index": cidx,
                                    "text_preview": self._text_preview(chunk),
                                },
                            })
                if items:
                    return items
            except Exception as e:
                logger.warning(f"pdfplumber failed for {filepath}: {e}")

        # fallback single-chunk placeholder
        fb = f"Text content of {os.path.basename(filepath)}"
        return [{
            "type": "text",
            "content": fb,
            "meta": {
                "page": 1,
                "chunk_index": 0,
                "text_preview": self._text_preview(fb),
            },
        }]

    def extract_image(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Returns one item for an image with width/height/format metadata.
        """
        if Image:
            try:
                with Image.open(filepath) as im:
                    width, height = im.size
                    fmt = im.format or ""
                    return [{
                        "type": "image",
                        "content": f"IMAGE({os.path.basename(filepath)})_{width}x{height}",
                        "meta": {"width": width, "height": height, "format": fmt, "text_preview": ""}
                    }]
            except Exception as e:
                logger.warning(f"PIL failed for {filepath}: {e}")

        return [{
            "type": "image",
            "content": f"image_data_{os.path.basename(filepath)}",
            "meta": {"width": 0, "height": 0, "format": "", "text_preview": ""}
        }]

    def extract_file(self, filepath: str) -> List[Dict[str, Any]]:
        """
        Unified extractor returning a list of items:
        - PDFs -> multiple items per page when chunked (overlap chunking)
        - images -> one item
        - text files -> one item (page=1)
        """
        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".pdf":
            return self.extract_pdf_pages(filepath)
        if ext in [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tiff", ".webp"]:
            return self.extract_image(filepath)
        # txt or other text
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                txt = f.read()
                return [{
                    "type": "text",
                    "content": txt,
                    "meta": {"page": 1, "chunk_index": 0, "text_preview": self._text_preview(txt)}
                }]
        except Exception:
            # fallback single-page
            return [{
                "type": "text",
                "content": f"Text content of {os.path.basename(filepath)}",
                "meta": {"page": 1, "chunk_index": 0, "text_preview": self._text_preview(f"Text content of {os.path.basename(filepath)}")}
            }]

    def process_file(self, filepath: str) -> bool:
        """
        Index a file. For PDFs we create one vector per text chunk (page + chunk_index).
        Existing vectors for this file are removed first (via metadata.get_by_path) to guarantee idempotence.
        """
        with self.lock:
            try:
                if not os.path.exists(filepath):
                    logger.info(f"process_file: file not found {filepath}")
                    return False

                items = self.extract_file(filepath)  # list of dicts (pages/chunks)
                checksum = self._compute_checksum(filepath)

                # Remove existing vectors for that path (if any)
                existing = self.metadata.get_by_path(filepath)
                for rec in existing:
                    if rec['index_type'] == 'text':
                        self.vector_store.remove_text(rec['vector_id'])
                    else:
                        self.vector_store.remove_image(rec['vector_id'])

                added = 0
                for item in items:
                    idx_type = item['type']
                    raw_content = str(item.get("content", ""))
                    if idx_type == "text" and not raw_content.strip():
                        continue
                    meta = item.get('meta', {}) or {}
                    page = int(meta.get('page', 1))
                    chunk = int(meta.get('chunk_index', 0))

                    vec_id = self._generate_page_id(filepath, idx_type, page, chunk)

                    # embedding dims
                    if idx_type == "text":
                        vec = self._embed_text(raw_content)
                        # remove any existing vector with same id then add
                        self.vector_store.remove_text(vec_id)
                        self.vector_store.add_text(vec, vec_id)
                    else:
                        vec = deterministic_mock_embedding(str(item.get('content', "")), 512)
                        self.vector_store.remove_image(vec_id)
                        self.vector_store.add_image(vec, vec_id)

                    # Standardize meta_blob and include filename + preview
                    standard_meta = dict(meta)
                    standard_meta.setdefault("file_name", os.path.basename(filepath))
                    standard_meta.setdefault("text_preview", self._text_preview(item.get('content', "")[:200]))

                    self.metadata.add_record(vec_id, idx_type, filepath,
                                             os.path.splitext(filepath)[1].lower(), checksum, standard_meta)
                    added += 1

                # persist
                self.vector_store.save()
                logger.info(f"Indexed {added} vectors for {filepath}")
                return True
            except Exception as e:
                logger.error(f"Process failed for {filepath}: {e}", exc_info=True)
                return False

    def delete_file(self, filepath: str) -> bool:
        with self.lock:
            try:
                records = self.metadata.get_by_path(filepath)
                for rec in records:
                    if rec['index_type'] == 'text':
                        self.vector_store.remove_text(rec['vector_id'])
                    else:
                        self.vector_store.remove_image(rec['vector_id'])
                
                self.metadata.delete_by_path(filepath)
                self.vector_store.save()
                return True
            except Exception as e:
                logger.error(f"Delete failed: {e}")
                return False

    # -------------------------
    # ML-6: Embedding wrapper + frontend search API

    # Core search helper + public search APIs (refactored)
    # -------------------------
    def _allowed_ids_from_paths(self, allowed_paths: Optional[List[str]]) -> Optional[List[int]]:
        """
        None  -> no path filter (search full index).
        []    -> caller should treat as no filter (same as None) when paths list is empty.
        When allowed_paths is non-empty: return vector ids for file_path prefixes; on error return [].
        """
        if not allowed_paths:
            return None
        try:
            return self.metadata.get_valid_vector_ids(allowed_paths)
        except Exception as e:
            logger.warning("get_valid_vector_ids failed: %s", e)
            return []

    def _search_core(
        self,
        query: str,
        mode: str = "text",
        k: int = 5,
        allowed_ids: Optional[List[int]] = None,
    ):
        """
        Core search: builds embedding, queries FAISS and returns raw (D_list, I_list).
        When allowed_ids is set (including empty), FAISS search is restricted to those ids (pre-filter).
        """
        if mode == "text":
            vec = self._embed_text(query)
            with self.lock:
                D, I = self.vector_store.search_text(vec, k, allowed_ids=allowed_ids)
        else:
            vec = deterministic_mock_embedding(query, 512)
            with self.lock:
                D, I = self.vector_store.search_image(vec, k, allowed_ids=allowed_ids)
        return D, I

    def search(self, query: str, mode: str = "text", k: int = 5, allowed_paths: List[str] = None):
        """
        Backwards-compatible search method (existing behavior).
        Uses the core _search_core and then maps FAISS hits to metadata + normalized confidence.
        """
        allowed_ids = self._allowed_ids_from_paths(allowed_paths)
        if allowed_ids is not None and len(allowed_ids) == 0:
            return []

        D, I = self._search_core(query, mode, k, allowed_ids=allowed_ids)

        results = []
        for dist, doc_id in zip(D, I):
            if doc_id == -1:
                continue
            meta = self.metadata.get_record(int(doc_id), mode)
            if meta:
                confidence = (1 / (1 + float(dist))) * 100
                results.append({**meta, "confidence": round(confidence, 2)})
        return results

    def search_api(self, query: str, mode: str = "text", k: int = 5, allowed_paths: List[str] = None) -> List[Dict[str, Any]]:
        """
        Frontend-friendly search wrapper.
        Path filter is applied inside FAISS via allowed vector ids (pre-filter), not post-filter.
        """
        allowed_ids = self._allowed_ids_from_paths(allowed_paths)
        if allowed_ids is not None and len(allowed_ids) == 0:
            return []

        D, I = self._search_core(query, mode, k, allowed_ids=allowed_ids)

        results = []
        for dist, doc_id in zip(D, I):
            if len(results) >= k:
                break
            if int(doc_id) == -1:
                continue
            meta = self.metadata.get_record(int(doc_id), mode)
            if not meta:
                continue
            confidence = (1 / (1 + float(dist))) * 100
            out = {
                "vector_id": int(meta["vector_id"]),
                "index_type": meta["index_type"],
                "file_path": meta["file_path"],
                "file_type": meta["file_type"],
                "checksum": meta["checksum"],
                "timestamp": meta["timestamp"],
                "meta_blob": meta["meta_blob"],
                "confidence": round(confidence, 2)
            }
            results.append(out)

        return results
    

    # -------------------------
    # ML-9: Index add / update / delete APIs
    # -------------------------
    def index_add(self, docs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Add multiple vectors with metadata.
        Each doc should contain:
          - 'vector_id' (optional). If omitted, engine will generate one from file_path/index_type/page/chunk.
          - 'file_path' (optional but recommended)
          - 'index_type': 'text'|'image' (required)
          - 'content': str used to create embedding (required)
          - 'meta': dict (optional) with page, chunk_index, text_preview, etc.
          - 'checksum' (optional)
        Returns {"added": n, "errors": [...]}
        """
        added = 0
        errors = []
        with self.lock:
            for doc in docs:
                try:
                    idx_type = doc["index_type"]
                    file_path = doc.get("file_path", "")
                    meta = doc.get("meta", {}) or {}
                    page = int(meta.get("page", 1))
                    chunk = int(meta.get("chunk_index", 0))

                    # vector id: use provided or derive stable id
                    if "vector_id" in doc and doc["vector_id"] is not None:
                        vec_id = int(doc["vector_id"])
                    else:
                        unique = f"{file_path}::{idx_type}::p{page}::c{chunk}"
                        h = hashlib.sha256(unique.encode()).digest()
                        vec_id = int.from_bytes(h[:8], 'big', signed=True)

                    if idx_type == "text":
                        vec = self._embed_text(str(doc.get("content", "")))
                    else:
                        vec = deterministic_mock_embedding(str(doc.get("content", "")), 512)

                    # replace existing vector with same id
                    if idx_type == "text":
                        self.vector_store.remove_text(vec_id)
                        self.vector_store.add_text(vec, vec_id)
                    else:
                        self.vector_store.remove_image(vec_id)
                        self.vector_store.add_image(vec, vec_id)

                    checksum = doc.get("checksum", "")
                    if not checksum and os.path.exists(file_path):
                        try:
                            checksum = self._compute_checksum(file_path)
                        except Exception:
                            checksum = ""

                    standard_meta = dict(meta)
                    standard_meta.setdefault("file_name", os.path.basename(file_path))
                    standard_meta.setdefault("text_preview", str(doc.get("content", ""))[:200])

                    self.metadata.add_record(vec_id, idx_type, file_path,
                                             os.path.splitext(file_path)[1], checksum, standard_meta)
                    added += 1
                except Exception as e:
                    errors.append({"doc": doc, "error": str(e)})
            # persist index state after all docs processed
            try:
                self.vector_store.save()
            except Exception as e:
                errors.append({"save_error": str(e)})
        return {"added": added, "errors": errors}

    def index_update(self, vector_id: int, doc: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a single vector and its metadata (upsert semantics).
        doc must contain 'index_type' and optional 'content','file_path','meta','checksum'.
        """
        try:
            idx_type = doc["index_type"]
            vec_id = int(vector_id)
            # remove existing index entry (safe even if not present)
            if idx_type == "text":
                self.vector_store.remove_text(vec_id)
                vec = self._embed_text(str(doc.get("content", "")))
            else:
                self.vector_store.remove_image(vec_id)
                vec = deterministic_mock_embedding(str(doc.get("content", "")), 512)
            if idx_type == "text":
                self.vector_store.add_text(vec, vec_id)
            else:
                self.vector_store.add_image(vec, vec_id)

            file_path = doc.get("file_path", "")
            file_type = os.path.splitext(file_path)[1] if file_path else ""
            checksum = doc.get("checksum", "")
            meta = doc.get("meta", {}) or {}

            self.metadata.add_record(vec_id, idx_type, file_path, file_type, checksum, meta)
            self.vector_store.save()
            return {"updated": True}
        except Exception as e:
            return {"updated": False, "error": str(e)}

    def index_delete(self, vector_id: int, index_type: str = "text") -> Dict[str, Any]:
        """
        Delete single vector and its metadata row.
        """
        try:
            vid = int(vector_id)
            if index_type == "text":
                self.vector_store.remove_text(vid)
            else:
                self.vector_store.remove_image(vid)

            # requires metadata.delete_by_vector_id to exist
            self.metadata.delete_by_vector_id(vid, index_type)
            self.vector_store.save()
            return {"deleted": True}
        except Exception as e:
            return {"deleted": False, "error": str(e)}

    def shutdown(self):
        """Releases resources to prevent file locking on Windows"""
        if hasattr(self, 'metadata'):
            self.metadata.close()