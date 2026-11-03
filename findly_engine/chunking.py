"""Character-based text chunking with configurable overlap (e.g. 25% between chunks)."""
from __future__ import annotations

from typing import List


def chunk_text_with_overlap(
    text: str,
    chunk_size: int,
    overlap_ratio: float = 0.25,
) -> List[str]:
    """
    Split text into chunks of at most `chunk_size` characters.
    Consecutive chunks overlap by `overlap_ratio` * chunk_size (e.g. 0.25 => 25% overlap),
    so step = chunk_size * (1 - overlap_ratio).

    Empty or whitespace-only input returns [].
    """
    if chunk_size < 1:
        raise ValueError("chunk_size must be >= 1")
    if not 0 <= overlap_ratio < 1:
        raise ValueError("overlap_ratio must be in [0, 1)")

    if not text:
        return []
    stripped = text.strip()
    if not stripped:
        return []

    if len(stripped) <= chunk_size:
        return [stripped]

    overlap_chars = int(round(chunk_size * overlap_ratio))
    step = chunk_size - overlap_chars
    step = max(1, step)

    chunks: List[str] = []
    start = 0
    n = len(stripped)
    while start < n:
        end = min(start + chunk_size, n)
        piece = stripped[start:end]
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start += step

    return chunks
