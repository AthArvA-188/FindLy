"""Integration tests with real SentenceTransformers (skipped if unavailable)."""
import os
import sys

import numpy as np
import pytest

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

pytest.importorskip("sentence_transformers")

from findly_engine.engine import FindlyEngine


def test_semantic_search_ranks_related_text_higher(tmp_path):
    """Two temp files: query should rank the semantically closer file at top."""
    data = tmp_path / "idx"
    data.mkdir()
    a = tmp_path / "a.txt"
    b = tmp_path / "b.txt"
    a.write_text(
        "The spacecraft used solar panels and ion thrusters for deep space travel.",
        encoding="utf-8",
    )
    b.write_text(
        "Chocolate cake recipe with cocoa powder butter sugar and vanilla extract.",
        encoding="utf-8",
    )

    engine = FindlyEngine(
        base_path=str(data),
        use_sentence_transformer=True,
        pdf_chunk_size=500,
        pdf_chunk_overlap=0.25,
    )
    try:
        assert engine.process_file(str(a))
        assert engine.process_file(str(b))
        hits = engine.search_api("NASA satellite propulsion in orbit", mode="text", k=4)
        assert hits, "expected at least one hit"
        top = hits[0]["file_path"]
        assert top == str(a), f"expected space doc first, got {top}"
        # L2 distance on unit vectors: related chunk should be closer than unrelated
        assert hits[0]["confidence"] >= hits[-1]["confidence"] or len(hits) == 1
    finally:
        engine.shutdown()


def test_embedder_cosine_similarity_numeric():
    from findly_engine.text_embedder import TextEmbedder

    emb = TextEmbedder(use_model=True)
    a = emb.embed("machine learning algorithms")
    b = emb.embed("neural networks and training")
    c = emb.embed("zebra crossing regulations")
    sim_ab = float(np.dot(a, b))
    sim_ac = float(np.dot(a, c))
    assert sim_ab > sim_ac, f"expected related texts more similar: {sim_ab} vs {sim_ac}"
