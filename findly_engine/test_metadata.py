"""Tests for MetadataStore (SQLite)."""
import os
import sys

import pytest

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

from findly_engine.metadata import MetadataStore


def test_get_valid_vector_ids_prefix_match(tmp_path):
    db_path = str(tmp_path / "meta.db")
    store = MetadataStore(db_path=db_path)
    store.add_record(
        10,
        "text",
        "/data/project_a/file1.txt",
        ".txt",
        "chk1",
        {"page": 1},
    )
    store.add_record(
        20,
        "text",
        "/data/project_b/file2.txt",
        ".txt",
        "chk2",
        {"page": 1},
    )
    ids = store.get_valid_vector_ids(["/data/project_a"])
    assert 10 in ids
    assert 20 not in ids
