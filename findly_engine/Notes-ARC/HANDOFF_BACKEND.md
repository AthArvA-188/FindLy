
Files to review:-
engine.py (FindlyEngine), vector_store.py (DualVectorIndex)
******************************************************************************************
Summary of runtime behavior:-

Engine API: Exposes process_file(filepath) for ingestion, search(query, mode, k) for retrieval, and delete_file(filepath) for cleanup.

Dual Indexing: vector_store.py manages two separate FAISS indices to handle different embedding dimensions:

text_index.faiss: Stores 384d vectors (Text/PDFs).

image_index.faiss: Stores 512d vectors (Images).

Persistence: Indices are saved to disk atomically (write to .tmp -> rename) to prevent corruption during crashes.

******************************************************************************************
Immediate checks to perform on your environment:-

Dependency Match: Ensure faiss-cpu is installed.

python -c "import faiss; print(f'FAISS Version: {faiss.version}')"

Smoke Test: Run this snippet to verify the engine initializes and generates the DB:

from engine import FindlyEngine

This should create ./data/findly_metadata.db and .faiss files
e = FindlyEngine(base_path="./data")
print("Engine initialized successfully.")

******************************************************************************************
Operational notes:-

Mocked data: The current engine.py uses deterministic_mock_embedding (seeded by the content's MD5 hash). This ensures tests pass reliably but must be replaced with sentence-transformers (Text) and CLIP (Image) models in process_file and search.

ID Generation Strategy: Doc IDs are generated using the first 8 bytes of the SHA256 hash of the filepath + index_type. This guarantees that re-indexing the same file always results in the same ID, ensuring idempotency.

Concurrency Locking: FindlyEngine uses a threading.Lock() for all write operations (process_file, delete_file). This is safe for a single FastAPI worker. If you scale to multiple workers, you must move the writer to a dedicated queue/service, as FAISS is not multi-process write-safe.

Remove-Before-Add: To prevent duplicate vectors for the same file, process_file explicitly calls remove_text/image before adding the new vector. This logic relies on the ID stability mentioned above.

******************************************************************************************
Who should do what:-

API tasks: Wrap 'process_file()' in a POST /index endpoint and search() in POST /search. Critical: Ensure the API sanitizes file paths, as the engine trusts the input path blindly.

ML tasks: Replace the mock_extract() and deterministic_mock_embedding() functions in engine.py with the actual model inference calls. The vector dimensions (384/512) are hardcoded in init and must match your models.

******************************************************************************************
Future Upgrade: Hybrid Search (BM25 + Vector)

This initial commit focuses on establishing clean abstractions and a working Vector Search pipeline to let other teams start working.

Planned Enhancement:
To improve search precision for exact keywords (e.g., specific filenames or jargon), I plan to implement Hybrid Search eventually.

Method: We will integrate SQLite FTS5 (Full-Text Search) alongside the existing FAISS vector indices.

Integration: Since the backend already uses the FindlyEngine abstraction, I can drop this in later by modifying only the internal engine.search() logic. No changes will be required for the API or Frontend code.

More possible future improvements:-
Multi-Worker Safety: Replace threading.Lock() with a file-locking library (e.g., portalocker) to support multiple FastAPI workers safely.

Metadata Snapshots: Standardize meta_blob to include text previews for instant frontend display without file I/O.

Atomic State Checkpoints: Implement folder-level snapshotting to ensure the DB and FAISS indices never drift out of sync after a crash.

Asynchronous Job Tracking: Add a tasks table to track indexing progress (0-100%) for requirements BE-2 and BE-3.