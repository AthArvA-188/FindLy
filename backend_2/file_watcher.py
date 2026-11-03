import os
import json
import time
import hashlib
import mimetypes
import logging
from pathlib import Path
from typing import Dict, Optional

import redis
from filelock import FileLock
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

import config
from file_handler import FileHandler

logging.basicConfig(
    format='%(asctime)s - %(process)d - %(name)s - %(filename)s:%(lineno)d - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

redis_client = redis.Redis(host="findly-redis", port=6379, db=config.REDIS_DB_NUMBER)
file_handler = FileHandler()

DEBOUNCE_SECONDS = 2.0
STABILITY_WAIT = 0.5
RETRY_DELAY = 3.0
RELOAD_INTERVAL = 30
INDEXED_FILES_LOCK = "/app/indexed_files.json.lock"

# Duplicated from app.py intentionally — extract to a shared module later to prevent drift
# Must match app.py CODE_EXTENSIONS and TEXT_EXTENSIONS exactly
CODE_EXTENSIONS = {
    ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".py", ".pyw", ".java", ".kt", ".kts", ".scala", ".groovy",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cxx", ".cs", ".vb",
    ".go", ".rs", ".rb", ".php", ".swift", ".m", ".mm",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".sh", ".bash", ".zsh", ".fish", ".sql", ".yaml", ".yml",
    ".toml", ".ini", ".r", ".lua", ".pl", ".dart", ".ex", ".exs",
}
TEXT_EXTENSIONS = {".txt", ".md", ".log", ".json", ".xml", ".csv", ".rtf"}


def generate_md5(file_path: str) -> str:
    return hashlib.md5(file_path.encode("utf-8")).hexdigest()


def _detect_kind(file_path: str) -> Optional[dict]:
    """Return full metadata dict mirroring app.py _detect_kind, or None if file unreadable."""
    p = Path(file_path)
    if not p.exists() or not p.is_file():
        return None
    mime, _ = mimetypes.guess_type(file_path)
    stat = p.stat()
    ext = p.suffix.lower()
    kind = "binary"

    # Same order as app.py: code → text → mime fallback (pdf detected via mime)
    if ext in CODE_EXTENSIONS:
        kind = "code"
    elif ext in TEXT_EXTENSIONS:
        kind = "text"
    elif mime:
        if mime.startswith("image/"):
            kind = "image"
        elif mime == "application/pdf":
            kind = "pdf"
        elif mime.startswith("text/"):
            kind = "text"

    return {
        "mime": mime,
        "size": stat.st_size,
        "page_count": None,  # mirrors app.py; watcher does not recalculate PDF page counts
        "kind": kind,
        "filename": p.name,
        "extension": ext,
        "mod_time": stat.st_mtime,
        "mod_time_readable": time.ctime(stat.st_mtime),
    }


def _load_indexed() -> dict:
    try:
        with FileLock(INDEXED_FILES_LOCK):
            db = file_handler.load_json_db(config.INDEXED_FILES_DB)
        return db if db else {}
    except Exception:
        logger.warning("indexed_files.json missing or unreadable — watching 0 files until next reload")
        return {}


def _is_stable(file_path: str) -> bool:
    try:
        stat1 = os.stat(file_path)
        time.sleep(STABILITY_WAIT)
        stat2 = os.stat(file_path)
        return stat1.st_size == stat2.st_size and stat1.st_mtime == stat2.st_mtime
    except OSError:
        return False


class IndexedFileEventHandler(FileSystemEventHandler):
    def __init__(self, indexed: dict, norm_to_stored: dict,
                 debounce: dict, retry_queue: dict) -> None:
        self._indexed = indexed
        self._norm_to_stored = norm_to_stored
        self._debounce = debounce
        self._retry_queue = retry_queue

    def _resolve(self, raw_path: str) -> Optional[str]:
        return self._norm_to_stored.get(os.path.normpath(raw_path))

    def _dispatch(self, raw_path: str) -> None:
        stored = self._resolve(raw_path)
        if stored is None:
            return

        now = time.time()
        if now - self._debounce.get(stored, 0) < DEBOUNCE_SECONDS:
            return
        self._debounce[stored] = now

        _handle_modification(stored, self._retry_queue)

    def on_modified(self, event):
        if not event.is_directory:
            self._dispatch(event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._dispatch(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._dispatch(event.dest_path)


def _handle_modification(file_path: str, retry_queue: dict) -> None:
    if not _is_stable(file_path):
        retry_queue[file_path] = time.time() + RETRY_DELAY
        logger.info("File unstable, scheduled retry: %s", file_path)
        return
    _enqueue_reindex(file_path)


def _enqueue_reindex(file_path: str) -> None:
    meta = _detect_kind(file_path)
    if meta is None:
        logger.error("File unreadable/deleted during handling: %s — skipping", file_path)
        return

    kind = meta["kind"]
    file_hash = generate_md5(file_path)

    with FileLock(INDEXED_FILES_LOCK):
        db = file_handler.load_json_db(config.INDEXED_FILES_DB)
        if file_path not in db:
            logger.warning("File no longer in indexed_files.json — skipping reindex: %s", file_path)
            return
        db[file_path].update(meta)
        db[file_path]["hash"] = file_hash
        db[file_path]["indexed_at"] = time.time()
        tmp = config.INDEXED_FILES_DB + ".tmp"
        with open(tmp, "w") as f:
            json.dump(db, f, indent=2)
        os.replace(tmp, config.INDEXED_FILES_DB)

    # Just set — avoids brief window where file appears unindexed to concurrent REST requests
    redis_client.set(file_hash, file_path)

    redis_client.rpush(
        config.REDIS_QUEUE_NAME,
        json.dumps({"file_path": file_path, "kind": kind, "hash": file_hash}),
    )
    logger.info("Queued reindex for: %s (kind=%s)", file_path, kind)


def main() -> None:
    indexed: dict = {}
    norm_to_stored: dict = {}
    debounce: dict = {}
    retry_queue: dict = {}
    watches: Dict[str, object] = {}  # dir_path -> ObservedWatch handle

    observer = Observer()
    handler = IndexedFileEventHandler(indexed, norm_to_stored, debounce, retry_queue)

    def _get_watch_dirs(db: dict) -> set:
        return {str(Path(p).parent) for p in db}

    def _sync_watches(new_db: dict) -> None:
        new_dirs = _get_watch_dirs(new_db)
        current_dirs = set(watches.keys())

        for d in new_dirs - current_dirs:
            if os.path.isdir(d):
                handle = observer.schedule(handler, d, recursive=False)
                watches[d] = handle
                logger.info("Now watching: %s", d)

        for d in current_dirs - new_dirs:
            observer.unschedule(watches.pop(d))
            logger.info("Stopped watching: %s", d)

    def _reload() -> None:
        new_db = _load_indexed()
        indexed.clear()
        indexed.update(new_db)
        norm_to_stored.clear()
        norm_to_stored.update({os.path.normpath(p): p for p in new_db})
        _sync_watches(new_db)
        logger.info("Loaded %d indexed files, watching %d parent directories",
                    len(indexed), len(watches))

    _reload()
    observer.start()

    last_reload = time.time()
    try:
        while True:
            time.sleep(1)
            now = time.time()

            # Process retries
            for path, retry_at in list(retry_queue.items()):
                if now >= retry_at:
                    del retry_queue[path]
                    _handle_modification(path, retry_queue)

            # Reload indexed_files.json periodically
            if now - last_reload >= RELOAD_INTERVAL:
                _reload()
                last_reload = now
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()


if __name__ == "__main__":
    main()
