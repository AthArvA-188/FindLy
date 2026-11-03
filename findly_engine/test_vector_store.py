"""Tests for DualVectorIndex (FAISS) in isolation."""
import os
import sys

import numpy as np
import pytest

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from findly_engine.vector_store import DualVectorIndex


def test_search_text_with_allowed_ids_restricts_neighbors(tmp_path):
    base = str(tmp_path / "vs_data")
    dex = DualVectorIndex(base_path=base, text_dim=4, image_dim=4)
    v_keep = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    v_other = np.array([0.0, 1.0, 0.0, 0.0], dtype=np.float32)
    dex.add_text(v_keep, 1001)
    dex.add_text(v_other, 2002)
    q = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)
    D, I = dex.search_text(q, k=2, allowed_ids=[2002])
    assert 2002 in I
    assert 1001 not in I


def test_search_text_empty_allowed_ids_returns_no_hits(tmp_path):
    base = str(tmp_path / "vs_data")
    dex = DualVectorIndex(base_path=base, text_dim=3, image_dim=3)
    dex.add_text(np.array([1.0, 0.0, 0.0], dtype=np.float32), 42)
    D, I = dex.search_text(np.array([1.0, 0.0, 0.0], dtype=np.float32), k=3, allowed_ids=[])
    assert np.all(I == -1)


def test_save_and_reload_text_index(tmp_path):
    base = str(tmp_path / "persist")
    dex = DualVectorIndex(base_path=base, text_dim=2, image_dim=2)
    v = np.array([0.0, 1.0], dtype=np.float32)
    dex.add_text(v, 99)
    dex.save()
    dex2 = DualVectorIndex(base_path=base, text_dim=2, image_dim=2)
    D, I = dex2.search_text(v, k=1)
    assert int(I[0]) == 99
