import os
import sys

import pytest

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from findly_engine.chunking import chunk_text_with_overlap


def test_overlap_25_percent_step():
    # chunk_size=100, overlap 25% => step 75; length 175 yields exactly two chunks
    s = "".join(chr(ord("a") + (i % 26)) for i in range(175))
    parts = chunk_text_with_overlap(s, chunk_size=100, overlap_ratio=0.25)
    assert len(parts) == 2
    assert parts[0] == s[0:100]
    assert parts[1] == s[75:175]
    # 25-char overlap between consecutive windows [0:100] and [75:175]
    assert parts[0][75:100] == parts[1][0:25]


def test_short_text_single_chunk():
    assert chunk_text_with_overlap("hello", chunk_size=100, overlap_ratio=0.25) == ["hello"]


def test_empty_returns_empty():
    assert chunk_text_with_overlap("", 100) == []
    assert chunk_text_with_overlap("   \n", 100) == []


def test_invalid_overlap_raises():
    with pytest.raises(ValueError):
        chunk_text_with_overlap("a", 10, overlap_ratio=1.0)
