# FindLy – Core (Initial Commit)

It implements dual-modality vector search (text + image), persistent storage, and deterministic dummy embeddings for testing.


## Architecture Overview

The system consists of four core modules:

- **engine.py** → Orchestration (ingestion + search)
- **vector_store.py** → Dual FAISS index (text & image)
- **metadata.py** → SQLite metadata persistence
- **watcher_service.py** → Daemon process with real-time file system monitoring & event handling

Flow:

File → Extract → Embed → FAISS Index → Store Metadata → Search

**With File Watcher (Daemon):**

File Event (Create/Modify/Delete/Move) → Watcher → Engine → Index Update


## Modules

### 1. engine.py

Main orchestration layer.

**Handles:**
- File ingestion (`process_file`)
- Query search (`search`)
- File deletion
- Vector ID generation
- Embedding generation (currently dummy)
- Saving indices after updates

**Behavior:**
- Idempotent indexing (re-index replaces previous vectors)
- Deterministic hash-based vector IDs
- Thread-safe within a single process


### 2. vector_store.py

Wrapper around two FAISS indices.

| Index Type | Dimension | FAISS Backend |
|------------|------------|---------------|
| Text       | 384        | IndexFlatL2 + IDMap |
| Image      | 512        | IndexFlatL2 + IDMap |

**Handles:**
- Add vectors
- Remove vectors
- Top-k search
- Atomic persistence (`.tmp → rename`)
- Load existing indices on startup

Persistent files:
- `text_index.faiss`
- `image_index.faiss`



### 3. metadata.py

SQLite-based metadata store.

**Schema:**  
`CREATE TABLE documents (
id INTEGER PRIMARY KEY AUTOINCREMENT,
vector_id INTEGER UNIQUE,
file_path TEXT,
index_type TEXT,
meta_blob TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

**Handles:**
- Insert / replace metadata
- Lookup by `vector_id`
- Lookup by `file_path`
- Delete by `file_path`
- WAL mode enabled for better concurrency

Metadata is stored as JSON in `meta_blob`.



### 4. watcher_service.py

Integrated daemon service with complete file system monitoring and event handling.

**Features:**
- Continuous daemon process for real-time monitoring
- Complete file system event handling (Create/Modify/Delete/Move)
- ISO8601 timestamp logging for all events
- Event filtering by file extension and ignore patterns
- Debouncing to prevent duplicate events
- Thread-safe integration with FindlyEngine
- Command-line interface with configuration support
- Signal handling (SIGINT, SIGTERM) for graceful shutdown
- Comprehensive logging setup

**Key Classes:**

**FindlyFileEventHandler:**
- Extends `watchdog.events.FileSystemEventHandler`
- Handles all file system events with timestamps
- Filters by extension and ignore patterns
- Implements debouncing logic (configurable delay)
- Triggers appropriate engine operations:
  - `on_created()` → `engine.process_file()`
  - `on_modified()` → `engine.process_file()` (re-index)
  - `on_deleted()` → `engine.delete_file()`
  - `on_moved()` → delete old path + index new path

**FindlyFileWatcher:**
- Main watcher service class
- Manages watchdog Observer for continuous monitoring
- Supports multiple watch paths
- Configurable recursive directory monitoring
- Start/stop controls with lifecycle management
- `run_forever()` for blocking daemon mode

**Event Logging (ISO8601 Timestamps):**
```
2026-02-22T10:15:30.123456+00:00 - [CREATED] /data/document.pdf
2026-02-22T10:15:30.234567+00:00 - ✓ Successfully indexed: /data/document.pdf
2026-02-22T10:16:45.345678+00:00 - [MODIFIED] /data/document.pdf
2026-02-22T10:16:45.456789+00:00 - ✓ Successfully re-indexed: /data/document.pdf
2026-02-22T10:17:55.567890+00:00 - [DELETED] /data/old_file.pdf
2026-02-22T10:17:55.678901+00:00 - ✓ Successfully removed from index: /data/old_file.pdf
2026-02-22T10:18:30.789012+00:00 - [MOVED] /data/temp.pdf → /data/final.pdf
```

**Usage:**
```bash
# Run with default config
python watcher_service.py

# Run with custom config
python watcher_service.py --config /path/to/config.json

# Create example config
python watcher_service.py --create-config

# Run with PID file (for daemon management)
python watcher_service.py --config config.json --pid watcher.pid
```


### 5. watcher_config.py

Configuration management for the file watcher service.

**WatcherConfig Class:**
- Loads configuration from JSON files
- Validates configuration values
- Provides sensible defaults
- Supports saving/loading configs

**Configuration Options:**
```json
{
  "watch_paths": ["./data", "./documents"],
  "watched_extensions": [".pdf", ".txt", ".jpg", ".png"],
  "ignore_patterns": ["~$", ".tmp", ".swp", ".DS_Store"],
  "recursive": true,
  "debounce_seconds": 1.0,
  "engine_base_path": "./data",
  "log_level": "INFO",
  "log_file": "./logs/watcher.log"
}
```

**Methods:**
- `from_file(path)` → Load from JSON
- `from_file_or_default(path)` → Load or use defaults
- `save_to_file(path)` → Save configuration



## Embeddings (Current State)

Using deterministic dummy embeddings for testing:

- Text vectors → 384 dimensions
- Image vectors → 512 dimensions
- Generated via seeded NumPy random vectors

These are placeholders and not semantic.


## API Call Guide

### `process_file(filepath: str) -> bool`
Indexes a file:
- Extract content (currently mocked)
- Generate embedding
- Update FAISS indices
- Update metadata
- Persist changes



### `search(query: str, top_k: int = 5)`
Searches indexed content:
- Embed query
- Search both text and image indices
- Return top-k results with metadata



## Data Modeling Coverage

### ML-10 (PDF Processing)
- Currently uses `mock_extract()` (single chunk per file)
- No real PDF parsing
- No page-level chunking yet
- Integration point: replace `mock_extract()` inside `process_file()` with real PDF extractor returning multiple chunks



### ML-6 (Embedding Integration)
- Clear separation of text (384d) and image (512d) indices
- Embedding generation isolated inside engine
- Replace dummy embedding function with SentenceTransformer (text) and CLIP (image)



### ML-9 (Chunking Strategy)
- Current: single vector per file
- Expected: multiple vectors per file (per page / chunk)
- Engine supports multiple inserts; requires extraction update



### ML-11 (Multimodal Search)
- Separate FAISS indices for text and image
- Independent search per modality
- Combined results returned
- Future: score fusion / normalization



## Summary

This system provides:
- Dual FAISS indexing (384d text, 512d image)
- Deterministic vector ID generation
- Persistent metadata store (SQLite)
- Ingestion and search engine
- Clear integration points for PDF parsing and real embeddings
- Dummy embeddings for reproducible testing
- **Integrated daemon service for continuous real-time file system monitoring**
- **Complete file event handling (create/modify/delete/move) with ISO8601 timestamps**
- **Automatic indexing on file changes**
- **Configurable file filtering and event debouncing**
- **Graceful shutdown and signal handling**



## Installation

### Dependencies

Install required dependencies:

```bash
pip install -r requirements.txt
```

Core dependencies:
- `faiss-cpu` - Vector similarity search
- `numpy` - Numerical operations
- `watchdog` - File system monitoring

### Quick Start

1. **Basic Indexing (Manual):**
```python
from engine import FindlyEngine

engine = FindlyEngine(base_path="./data")
engine.process_file("document.pdf")
results = engine.search("query text", mode="text", k=5)
```

2. **Using Daemon Service (Recommended):**
```bash
# Create configuration
python watcher_service.py --create-config

# Edit watcher_config.json to set your paths

# Run the daemon
python watcher_service.py --config watcher_config.json
```

3. **Programmatic Usage:**
```python
from engine import FindlyEngine
from watcher_service import FindlyFileWatcher

engine = FindlyEngine(base_path="./data")
watcher = FindlyFileWatcher(
    engine=engine,
    watch_paths=["./documents"],
    watched_extensions={'.pdf', '.txt', '.jpg'}
)

# Start watching (blocks until Ctrl+C)
watcher.run_forever()
```



## File Watcher Usage Guide

### Configuration Setup

Create a configuration file:

```bash
python watcher_service.py --create-config
```

Edit `watcher_config.json`:

```json
{
  "watch_paths": [
    "./data",
    "./documents"
  ],
  "watched_extensions": [
    ".pdf",
    ".txt",
    ".jpg",
    ".png",
    ".jpeg",
    ".doc",
    ".docx"
  ],
  "ignore_patterns": [
    "~$",
    ".tmp",
    ".swp",
    ".DS_Store",
    "__pycache__"
  ],
  "recursive": true,
  "debounce_seconds": 1.0,
  "engine_base_path": "./data",
  "log_level": "INFO",
  "log_file": "./logs/watcher.log"
}
```

### Running the Watcher

**Interactive Mode (foreground):**
```bash
python watcher_service.py --config watcher_config.json
```

Press `Ctrl+C` to stop.

**Background Mode (Unix/Linux with nohup):**
```bash
nohup python watcher_service.py --config watcher_config.json --pid watcher.pid > watcher.out 2>&1 &
```

Stop the watcher:
```bash
kill $(cat watcher.pid)
```

**Windows (run as background process):**
```powershell
Start-Process python -ArgumentList "watcher_service.py --config watcher_config.json" -WindowStyle Hidden
```

### Systemd Integration (Linux)

Create `/etc/systemd/system/findly-watcher.service`:

```ini
[Unit]
Description=FindLy File Watcher Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/findly_engine
ExecStart=/usr/bin/python3 /path/to/findly_engine/watcher_service.py --config /path/to/watcher_config.json --pid /var/run/findly-watcher.pid
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable findly-watcher
sudo systemctl start findly-watcher
sudo systemctl status findly-watcher

# View logs
sudo journalctl -u findly-watcher -f
```

### Programmatic Usage

**Programmatic Usage:**

**Basic Example:**
```python
from engine import FindlyEngine
from watcher_service import FindlyFileWatcher

# Initialize engine
engine = FindlyEngine(base_path="./data")

# Create watcher
watcher = FindlyFileWatcher(
    engine=engine,
    watch_paths=["./documents", "./uploads"],
    watched_extensions={'.pdf', '.txt', '.jpg', '.png'},
    recursive=True,
    debounce_seconds=1.0
)

# Start watching
watcher.start()

# ... do other work ...

# Stop watching when done
watcher.stop()
```

**Advanced Example with Configuration:**
```python
from engine import FindlyEngine
from watcher_service import FindlyFileWatcher
from watcher_config import WatcherConfig

# Load configuration
config = WatcherConfig.from_file("watcher_config.json")

# Initialize engine
engine = FindlyEngine(base_path=config.engine_base_path)

# Create watcher with config
watcher = FindlyFileWatcher(
    engine=engine,
    watch_paths=config.watch_paths,
    watched_extensions=config.watched_extensions,
    ignore_patterns=config.ignore_patterns,
    recursive=config.recursive,
    debounce_seconds=config.debounce_seconds
)

# Run forever (blocks)
watcher.run_forever()
```

### Event Handling Details

**Supported Events:**

| Event Type | Trigger | Action |
|------------|---------|--------|
| **Created** | New file added | Index the file |
| **Modified** | File content changed | Re-index the file |
| **Deleted** | File removed | Remove from index |
| **Moved** | File renamed/moved | Remove old path, index new path |

**Debouncing:**

File systems can generate multiple events for a single operation. The watcher includes debouncing:
- Default: 1.0 second
- Prevents duplicate indexing
- Configurable via `debounce_seconds`

**File Filtering:**

Files are processed only if:
1. File extension matches `watched_extensions`
2. Filename doesn't match `ignore_patterns`
3. Debounce check passes

### Monitoring and Logging

**Log Levels:**
- `DEBUG` - Detailed event information, debouncing, filtering decisions
- `INFO` - File operations, service lifecycle events
- `WARNING` - Failed operations, missing paths
- `ERROR` - Exceptions, critical failures

**Log Output:**

Console + File (if configured):
```
2026-02-22 10:15:30,123 - FindlyWatcher - INFO - Starting FindLy File Watcher...
2026-02-22 10:15:30,124 - FindlyWatcher - INFO - Watching: ./data (recursive=True)
2026-02-22 10:15:30,125 - FindlyWatcher - INFO - ✓ File Watcher started successfully
2026-02-22 10:15:35,234 - FindlyWatcher - INFO - 2026-02-22T10:15:35.234567+00:00 - [CREATED] ./data/new_doc.pdf
2026-02-22 10:15:35,345 - FindlyWatcher - INFO - ✓ Successfully indexed: ./data/new_doc.pdf
```

### Troubleshooting

**Issue: Files not being indexed**
- Check `watched_extensions` includes the file type
- Verify file isn't matching `ignore_patterns`
- Check log level is set to `DEBUG` to see filtering decisions
- Ensure file path is under one of the `watch_paths`

**Issue: Duplicate indexing**
- Increase `debounce_seconds` (try 2.0 or 3.0)
- Check logs for multiple rapid events

**Issue: Service not starting**
- Verify all paths in config exist
- Check permissions for watch paths
- Look for errors in log file
- Ensure no other instance is running (check PID file)

**Issue: High CPU/memory usage**
- Reduce number of watch paths
- Make `watched_extensions` more specific
- Set `recursive=false` for large directory trees
- Increase `debounce_seconds`

### Performance Considerations

**Watch Path Selection:**
- Watch specific directories, not entire file system
- Avoid watching temporary directories
- Use `ignore_patterns` liberally

**Recursive Watching:**
- `recursive=true` watches all subdirectories
- Can be expensive for large trees
- Consider watching only top-level directories

**Debounce Tuning:**
- Lower values (0.1-0.5s): More responsive, more CPU
- Higher values (1.0-3.0s): Less CPU, may batch rapid changes
- Default 1.0s is good for most use cases

**How To Start The App:**
pip install fastapi uvicorn redis faiss-cpu numpy pydantic
brew install redis
brew services start redis
- Open three terminal windows
```bash
# Run the worker python file cd backend
python worker.py

# Run the backend cd backend
uvicorn main:app --reload

# Run the frontend cd frontend
npm run dev
```
