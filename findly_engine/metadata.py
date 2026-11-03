import sqlite3
import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FindlyMetadata")

class MetadataStore:
    """
    ML-5: Metadata Store (SQLite) with ML-9 Support.
    """
    def __init__(self, db_path: str = "findly_metadata.db"):
        self.db_path = db_path
        self._bootstrap()

    def _get_connection(self):
        return sqlite3.connect(self.db_path, check_same_thread=False)

    def _bootstrap(self):
        with self._get_connection() as conn:
            conn.execute("PRAGMA journal_mode=WAL;") 
            conn.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    db_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    vector_id INTEGER NOT NULL,
                    index_type TEXT CHECK(index_type IN ('text', 'image')) NOT NULL,
                    file_path TEXT NOT NULL,
                    file_type TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    meta_blob TEXT, 
                    UNIQUE(vector_id, index_type)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_path ON documents(file_path);")
            conn.commit()


    def add_record(self, vector_id: int, index_type: str, file_path: str,
                   file_type: str, checksum: str, meta_blob: Dict = None) -> int:
        ts = datetime.now(timezone.utc).isoformat()
        meta_str = json.dumps(meta_blob or {})
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO documents
                (vector_id, index_type, file_path, file_type, checksum, timestamp, meta_blob)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(vector_id, index_type) DO UPDATE SET
                    file_path=excluded.file_path,
                    file_type=excluded.file_type,
                    checksum=excluded.checksum,
                    timestamp=excluded.timestamp,
                    meta_blob=excluded.meta_blob
            """, (vector_id, index_type, file_path, file_type, checksum, ts, meta_str))
        conn.commit()
        return cursor.lastrowid


    def get_record(self, vector_id: int, index_type: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM documents WHERE vector_id = ? AND index_type = ?", 
                (vector_id, index_type)
            )
            result = cursor.fetchone()
            if result:
                row = dict(result)
                row['meta_blob'] = json.loads(row['meta_blob']) if row['meta_blob'] else {}
                return row
            return None

    def get_by_path(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Required for ML-9 (Deletion/Updates).
        Returns all records (chunks/images) associated with a file path.
        """
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM documents WHERE file_path = ?", (file_path,))
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d['meta_blob'] = json.loads(d['meta_blob']) if d['meta_blob'] else {}
                results.append(d)
            return results
    def get_valid_vector_ids(self, allowed_paths: List[str]) -> List[int]:
        """
        Returns vector_ids under specified allowed file path prefixes.
        allowed_paths are interpreted as prefixes to match file_path.
        """
        if not allowed_paths:
            return []
        placeholders = " OR ".join(["file_path LIKE ?"] * len(allowed_paths))
        params = [p + "%" for p in allowed_paths]
        query = f"SELECT vector_id FROM documents WHERE {placeholders}"
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            return [int(r[0]) for r in cursor.fetchall()]
        
    def delete_by_path(self, file_path: str):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM documents WHERE file_path = ?", (file_path,))
            conn.commit()

    def delete_by_vector_id(self, vector_id: int, index_type: str):
        """
        Remove a single document row by vector_id and index_type.
        """
        with self._get_connection() as conn:
            conn.execute(
                "DELETE FROM documents WHERE vector_id = ? AND index_type = ?",
                (vector_id, index_type)
            )
            conn.commit()

    def close(self):
        """Explicitly close connection (useful for tests/Windows)"""
        # Force a checkpoint to release WAL lock
        try:
            with self._get_connection() as conn:
                conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        except Exception:
            pass