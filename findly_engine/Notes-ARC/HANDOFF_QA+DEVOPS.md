
summary of runtime behavior:-

Data Isolation: The engine stores all state (DB + Indices) in a single directory (default: ./data). Deleting this folder effectively "factory resets" the application.

Windows Compatibility: The code includes specific fixes for Windows file locking (using gc.collect() and retry logic in tests).


Operational notes:-

File Locking (Windows): SQLite in WAL mode keeps shared memory files (.shm, .wal) open. If you try to delete the data folder while the app is running, it will fail. Ensure the application calls engine.shutdown() (or the process terminates) before attempting cleanup.

Deterministic Testing: The system currently uses seeded random vectors. This means searching for "apple" will always yield the exact same confidence score across different runs/machines. This is intentional for QA consistency until real models are integrated.

Memory Usage: faiss-cpu loads indices into RAM. Monitor memory usage if the text_index.faiss grows beyond 1GB.

Who should do what:-

DevOps: Ensure the Docker container mounts a persistent volume for the ./data directory so that indices survive container restarts.

QA:

Test 1 (Persistence): Index a file -> Restart the Python process -> Search for the file. (Should pass).

Test 2 (Idempotency): Index the same file 5 times in a row. (Should result in only 1 entry in the DB and 1 vector in FAISS, not 5).

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