"""
Index sample files and run a text search (SentenceTransformers if installed).

From repository root:
  python -m findly_engine.similarity_demo

Uses mock embeddings if sentence-transformers is unavailable.
"""
from __future__ import annotations

import gc
import os
import sys
import tempfile

_REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO not in sys.path:
    sys.path.insert(0, _REPO)

from findly_engine.engine import FindlyEngine


def main() -> None:
    sample_txt = os.path.join(os.path.dirname(__file__), "tmp_sample", "sample.txt")
    sample_pdf = os.path.join(os.path.dirname(__file__), "tmp_sample", "two_page.pdf")

    paths = []
    if os.path.isfile(sample_txt):
        paths.append(sample_txt)
    if os.path.isfile(sample_pdf):
        paths.append(sample_pdf)
    if not paths:
        print("No tmp_sample files; create findly_engine/tmp_sample/sample.txt")
        return

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        engine = FindlyEngine(
            base_path=tmp,
            use_sentence_transformer=True,  # falls back to mock if ST missing
            pdf_chunk_size=400,
            pdf_chunk_overlap=0.25,
        )
        try:
            for p in paths:
                ok = engine.process_file(p)
                print(f"index {p!r} -> {ok}")

            queries = [
                "sample document",
                "machine learning",
                "unique-token",
            ]
            for q in queries:
                hits = engine.search_api(q, mode="text", k=3)
                print(f"\nquery: {q!r}")
                for h in hits:
                    mb = h.get("meta_blob") or {}
                    print(
                        f"  score~ {h.get('confidence'):.2f}  page={mb.get('page')} "
                        f"chunk={mb.get('chunk_index')}  path={h.get('file_path')}"
                    )
                    prev = mb.get("text_preview", "")[:120]
                    if prev:
                        print(f"    preview: {prev!r}")
        finally:
            engine.shutdown()
            gc.collect()


if __name__ == "__main__":
    main()
