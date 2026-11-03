Files to review:- 
metadata.py (Schema), engine.py (Extraction Logic)
******************************************************************************************
Schema summary:-

Storage: SQLite (findly_metadata.db) using WAL (Write-Ahead Logging) mode for better concurrency.

Table documents:-

vector_id (int64): Maps directly to the FAISS ID.

index_type ('text'|'image'): Distinguishes between the two indices.

meta_blob (TEXT): A JSON string column for storing flexible metadata (page numbers, bounding boxes) without changing the schema.

checksum (TEXT): Stores the MD5 hash of the file content.

******************************************************************************************
What to Expect from meta_blob

Currently, engine.py injects a placeholder dictionary. You need to standardize this JSON structure.

For PDFs: Should likely contain {"page": int, "chunk_index": int, "text_preview": str}.

For Images: Should likely contain {"width": int, "height": int, "format": str}. ##I can look more into this

******************************************************************************************

Data modeling items to address

ML-10:
Extraction Replacement: In engine.py, the function mock_extract(filepath) currently returns dummy text. one needs to replace this with pdfplumber logic.

Note: The current logic assumes 1 file = 1 vector. If a PDF has 10 pages, you will need to modify the loop in process_file to generate 10 vectors (one per page) and call add_text 10 times.

Update Logic (ML-9):-

The MetadataStore.add_record method uses INSERT OR REPLACE. This means if a file is re-indexed, the old metadata is strictly overwritten (no history).

Verify if this "overwrite" behavior is sufficient for the requirements or if we need a separate audit_log table.

File Watcher Contract:-

Use metadata.get_by_path(filepath) to check if a file exists before processing.

Use engine.delete_file(filepath) for deletions—this method automatically cleans up all rows associated with that path (e.g., if one PDF generated 10 vector rows, all 10 are deleted).

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