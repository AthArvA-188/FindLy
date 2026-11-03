from fastapi import FastAPI
from pydantic import BaseModel
import redis  
import hashlib
from file_handler import FileHandler
from fastapi import UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from search_helper import search
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import Response, FileResponse, PlainTextResponse
from pathlib import Path
import mimetypes
from typing import Optional, List
import fitz
import config
import os
import time
import json

import logging
from qdrant_helper import QdrantHelper

logger = logging.getLogger(__name__)
logging.basicConfig(
    # filename="logs.log",
    format='%(asctime)s - %(process)d - %(name)s - %(filename)s:%(lineno)d - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.INFO)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       
    allow_credentials=False,
    allow_methods=["*"],         
    allow_headers=["*"],         
)

redis_client = redis.Redis(host="findly-redis", port=6379, db=0)

# Initialize Qdrant helper
qdrant_helper = QdrantHelper(hostname=config.QDRANT_HOST, port=config.QDRANT_PORT)

class PCData(BaseModel):
    file_path: str
    file_name: str
    timestamp: str
    type: str

class IndexFilesRequest(BaseModel):
    file_paths: List[str]

class ReindexFilesRequest(BaseModel):
    file_paths: List[str]

class IndexDirectoriesRequest(BaseModel):
    directory_paths: List[str]

def generate_md5(file_path: str) -> str:
    return hashlib.md5(file_path.encode('utf-8')).hexdigest()

def _is_hidden(path: str) -> bool:
    """Check if path is hidden (starts with .)"""
    return os.path.basename(path).startswith(".")

def _safe_path(path: str) -> Path:
    p = Path(path)
    # Optionally enforce a root directory or validation policy here
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return p

CODE_EXTENSIONS = {
    ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".py", ".pyw",
    ".java", ".kt", ".kts", ".scala", ".groovy",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".hh", ".cxx",
    ".cs", ".vb",
    ".go", ".rs",
    ".rb", ".php",
    ".swift", ".m", ".mm",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".sh", ".bash", ".zsh", ".fish",
    ".sql", ".yaml", ".yml", ".toml", ".ini",
    ".r", ".lua", ".pl", ".dart", ".ex", ".exs",
}

TEXT_EXTENSIONS = {".txt", ".md", ".log", ".json", ".xml", ".csv", ".rtf"}

def _detect_kind(p: Path) -> dict:
    """Detect file kind and metadata for indexing.

    Order of checks:
      1. Code files (by extension) — so .py / .java / .html aren't swallowed by
         mime sniffing as generic text. Code is indexed like text but stored
         under a distinct `file_kind` so the UI can filter on it.
      2. Explicit text extensions.
      3. MIME-based fallback (image, pdf, text).
    """
    mime, _ = mimetypes.guess_type(str(p))
    stat = p.stat()
    size = stat.st_size
    kind = "binary"
    page_count: Optional[int] = None
    ext = p.suffix.lower()

    # Get modification time
    mod_time = stat.st_mtime
    mod_time_readable = time.ctime(mod_time)

    if ext in CODE_EXTENSIONS:
        kind = "code"
    elif ext in TEXT_EXTENSIONS:
        kind = "text"
    elif mime:
        if mime.startswith("image/"):
            kind = "image"
        elif mime == "application/pdf":
            kind = "pdf"
        elif mime.startswith("text/") or mime in {"application/json", "application/xml"}:
            kind = "text"
        else:
            kind = "binary"

    return {
        "mime": mime,
        "size": size,
        "page_count": page_count,
        "kind": kind,
        "filename": p.name,
        "extension": ext,
        "mod_time": mod_time,
        "mod_time_readable": mod_time_readable
    }

@app.get("/api/get-directories-and-files")
async def get_directories_and_files(path: str = Query(None, description="Starting path for browsing")):
    """
    Return all directories and files accessible from a given path.
    If no path provided, defaults to mounted host home directory.
    Frontend uses this to show directory/file selection for indexing.
    """
    try:
        # Default to mounted host home directory
        if not path:
            path = "/host/home"
        
        # Validate path exists
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Path does not exist")
        
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        
        # List all items in directory
        try:
            for entry in os.scandir(path):
                # Skip hidden files/folders
                if _is_hidden(entry.path):
                    continue
                
                # Skip if no read permission
                if not os.access(entry.path, os.R_OK):
                    continue
                
                is_dir = entry.is_dir(follow_symlinks=False)
                items.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_dir": is_dir,
                    "type": "directory" if is_dir else "file"
                })
        
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Sort: directories first, then files
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        
        return {
            "status": "success",
            "current_path": path,
            "items": items
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting directories and files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/index-files")
async def index_files(request: IndexFilesRequest):
    """
    Index multiple files in batch.
    - Validates each file exists
    - Detects file kind and metadata for each
    - Generates MD5 hash for each file path
    - Checks Redis for existing hashes (skips if exists)
    - Stores all in JSON database and Redis
    - Returns detailed summary of indexed, skipped, and failed files
    """
    try:
        if not request.file_paths:
            raise HTTPException(status_code=400, detail="No file paths provided")
        
        indexed = []
        skipped = []
        failed = []
        
        file_handler = FileHandler()
        
        for file_path in request.file_paths:
            try:
                # Validate file exists
                if not os.path.exists(file_path):
                    failed.append({
                        "file_path": file_path,
                        "error": "File not found"
                    })
                    continue
                
                if not os.path.isfile(file_path):
                    failed.append({
                        "file_path": file_path,
                        "error": "Path is not a file"
                    })
                    continue
                
                # Detect file kind and metadata
                p = Path(file_path)
                file_metadata = _detect_kind(p)
                
                # Generate hash of file path
                file_hash = generate_md5(file_path)
                
                # Check if already indexed in Redis
                if redis_client.exists(file_hash):
                    logger.info(f"File already indexed: {file_path}")
                    skipped.append({
                        "file_path": file_path,
                        "hash": file_hash,
                        "reason": "Already indexed"
                    })
                    continue
                
                # Add hash to metadata
                file_metadata["hash"] = file_hash
                file_metadata["indexed_at"] = time.time()
                
                # Store in JSON database with complete metadata
                file_handler.update_json_db(config.INDEXED_FILES_DB, file_path, file_metadata)
                
                # Store hash in Redis for quick lookup
                redis_client.set(file_hash, file_path)
                
                # Queue for processing: send both file_path and kind
                queue_message = json.dumps({
                    "file_path": file_path,
                    "kind": file_metadata.get("kind"),
                    "hash": file_hash
                })
                redis_client.rpush(config.REDIS_QUEUE_NAME, queue_message)

                indexed.append({    
                    "file_path": file_path,
                    "hash": file_hash,
                    "kind": file_metadata.get("kind"),
                    "size": file_metadata.get("size")
                })
                logger.info(f"File indexed successfully: {file_path}")
            
            except Exception as e:
                logger.error(f"Error indexing file {file_path}: {e}")
                failed.append({
                    "file_path": file_path,
                    "error": str(e)
                })
        
        return {
            "status": "success",
            "summary": {
                "total_requested": len(request.file_paths),
                "total_indexed": len(indexed),
                "total_skipped": len(skipped),
                "total_failed": len(failed)
            },
            "indexed": indexed,
            "skipped": skipped,
            "failed": failed
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch indexing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/index-directories")
async def index_directories(request: IndexDirectoriesRequest):
    """
    Index all files in directories recursively in batch.
    - Validates each directory exists
    - Recursively walks through all directories
    - Skips hidden files and permission-denied paths
    - Detects file kind and metadata for each file
    - Generates MD5 hash for each file path
    - Checks Redis for existing hashes (skips if exists)
    - Stores all in JSON database and Redis
    - Returns detailed summary of indexed, skipped, and failed files
    """
    try:
        if not request.directory_paths:
            raise HTTPException(status_code=400, detail="No directory paths provided")
        
        indexed = []
        skipped = []
        failed = []
        
        file_handler = FileHandler()
        all_files = []  # Collect all files from directories first
        
        # Recursively collect all files from directories
        for directory_path in request.directory_paths:
            try:
                # Validate directory exists
                if not os.path.exists(directory_path):
                    failed.append({
                        "path": directory_path,
                        "error": "Directory not found"
                    })
                    continue
                
                if not os.path.isdir(directory_path):
                    failed.append({
                        "path": directory_path,
                        "error": "Path is not a directory"
                    })
                    continue
                
                # Recursively walk through directory
                for root, dirs, files in os.walk(directory_path):
                    # Filter out hidden directories
                    dirs[:] = [d for d in dirs if not _is_hidden(os.path.join(root, d))]
                    
                    for file_name in files:
                        file_path = os.path.join(root, file_name)
                        
                        # Skip hidden files
                        if _is_hidden(file_path):
                            continue
                        
                        # Skip if no read permission
                        if not os.access(file_path, os.R_OK):
                            continue
                        
                        all_files.append(file_path)
                
                logger.info(f"Found {len(all_files)} files in directory: {directory_path}")
            
            except PermissionError:
                failed.append({
                    "path": directory_path,
                    "error": "Permission denied"
                })
                continue
            except Exception as e:
                logger.error(f"Error scanning directory {directory_path}: {e}")
                failed.append({
                    "path": directory_path,
                    "error": str(e)
                })
                continue
        
        # Now index all collected files using same logic as index_files
        for file_path in all_files:
            try:
                # Validate file exists and is readable
                if not os.path.exists(file_path) or not os.path.isfile(file_path):
                    continue
                
                # Detect file kind and metadata
                p = Path(file_path)
                file_metadata = _detect_kind(p)
                
                # Generate hash of file path
                file_hash = generate_md5(file_path)
                
                # Check if already indexed in Redis
                if redis_client.exists(file_hash):
                    logger.info(f"File already indexed: {file_path}")
                    skipped.append({
                        "file_path": file_path,
                        "hash": file_hash,
                        "reason": "Already indexed"
                    })
                    continue
                
                # Add hash to metadata
                file_metadata["hash"] = file_hash
                file_metadata["indexed_at"] = time.time()
                
                # Store in JSON database with complete metadata
                file_handler.update_json_db(config.INDEXED_FILES_DB, file_path, file_metadata)
                
                # Store hash in Redis for quick lookup
                redis_client.set(file_hash, file_path)
                
                # Queue for processing: send both file_path and kind
                queue_message = json.dumps({
                    "file_path": file_path,
                    "kind": file_metadata.get("kind"),
                    "hash": file_hash
                })
                redis_client.rpush(config.REDIS_QUEUE_NAME, queue_message)

                indexed.append({    
                    "file_path": file_path,
                    "hash": file_hash,
                    "kind": file_metadata.get("kind"),
                    "size": file_metadata.get("size")
                })
                logger.info(f"File indexed successfully: {file_path}")
            
            except Exception as e:
                logger.error(f"Error indexing file {file_path}: {e}")
                failed.append({
                    "file_path": file_path,
                    "error": str(e)
                })
        
        return {
            "status": "success",
            "summary": {
                "total_directories": len(request.directory_paths),
                "total_files_found": len(all_files),
                "total_indexed": len(indexed),
                "total_skipped": len(skipped),
                "total_failed": len(failed)
            },
            "indexed": indexed,
            "skipped": skipped,
            "failed": failed
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in directory indexing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/indexed-files")
async def get_indexed_files():
    """
    Return list of all indexed files.
    Retrieves keys from JSON database file.
    """
    try:
        file_handler = FileHandler()
        indexed_files = file_handler.get_json_db_keys(config.INDEXED_FILES_DB)
        
        logger.info(f"Retrieved {len(indexed_files)} indexed files")
        
        return {
            "status": "success",
            "total_files": len(indexed_files),
            "indexed_files": indexed_files
        }
    
    except Exception as e:
        logger.error(f"Error getting indexed files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reindex-files")
async def reindex_files(request: ReindexFilesRequest):
    """
    Re-index multiple files in batch without checking Redis hash.
    Forces re-indexing even if files were previously indexed.
    Updates metadata in JSON database and Redis for all files.
    Returns detailed summary of re-indexed and failed files.
    """
    try:
        if not request.file_paths:
            raise HTTPException(status_code=400, detail="No file paths provided")
        
        reindexed = []
        failed = []
        
        file_handler = FileHandler()
        
        for file_path in request.file_paths:
            try:
                # Validate file exists
                if not os.path.exists(file_path):
                    failed.append({
                        "file_path": file_path,
                        "error": "File not found"
                    })
                    continue
                
                if not os.path.isfile(file_path):
                    failed.append({
                        "file_path": file_path,
                        "error": "Path is not a file"
                    })
                    continue
                
                # Detect file kind and metadata
                p = Path(file_path)
                file_metadata = _detect_kind(p)
                
                # Generate hash of file path
                file_hash = generate_md5(file_path)
                
                # Add hash to metadata
                file_metadata["hash"] = file_hash
                file_metadata["reindexed_at"] = time.time()
                
                # Store in JSON database (overwrites existing)
                file_handler.update_json_db(config.INDEXED_FILES_DB, file_path, file_metadata)
                
                # Store/update hash in Redis
                redis_client.set(file_hash, file_path)
                
                # Queue for processing: send both file_path and kind
                queue_message = json.dumps({
                    "file_path": file_path,
                    "kind": file_metadata.get("kind"),
                    "hash": file_hash
                })
                redis_client.rpush(config.REDIS_QUEUE_NAME, queue_message)

                reindexed.append({
                    "file_path": file_path,
                    "hash": file_hash,
                    "kind": file_metadata.get("kind"),
                    "size": file_metadata.get("size")
                })
                logger.info(f"File re-indexed successfully: {file_path}")
            
            except Exception as e:
                logger.error(f"Error re-indexing file {file_path}: {e}")
                failed.append({
                    "file_path": file_path,
                    "error": str(e)
                })
        
        return {
            "status": "success",
            "summary": {
                "total_requested": len(request.file_paths),
                "total_reindexed": len(reindexed),
                "total_failed": len(failed)
            },
            "reindexed": reindexed,
            "failed": failed
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch re-indexing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search-pc")
async def search_pc(
    text: str = Form(None),
    file: UploadFile = File(None),
    search_for: str = Form("text", description="Search type: text, image"),
    file_kinds: List[str] = Form(default=[], description="Optional file_kind filters (text, pdf, image, binary). Empty = search all kinds.")
):
    """
    Search for similar content across indexed files.

    search_for options:
    - text: Search text/PDF chunks via mpnet embeddings
    - image: Search images via CLIP embeddings

    file_kinds: optional list to narrow results by file_kind payload field.
    Leave empty to search across all file kinds in the selected embedding space.
    """
    valid_search_types = ["text", "image"]

    if search_for not in valid_search_types:
        raise HTTPException(status_code=400, detail=f"Invalid search_for. Must be one of: {', '.join(valid_search_types)}")

    if text and file:
        raise HTTPException(status_code=400, detail="Provide either 'text' OR 'file', not both")

    if text:
        try:
            results = search(text=text, image_bytes=None, search_for=search_for, group_by="file_path", file_kinds=file_kinds or None)
        except Exception as e:
            logger.warning(f"Search error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        return {"search_type": search_for, "query_type": "text", "results": results}

    elif file:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")

        image_bytes = await file.read()
        try:
            results = search(text=None, image_bytes=image_bytes, search_for=search_for, group_by="file_path", file_kinds=file_kinds or None)
        except Exception as e:
            logger.warning(f"Search error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        return {"search_type": search_for, "query_type": "image", "results": results}

    else:
        return {"error": "No input provided", "message": "Provide either 'text' or 'file' for search query"}

@app.get("/api/file/preview-image")
async def file_preview_image(
    path: str = Query(..., description="Absolute file path"),
    page: int = Query(1, ge=1, description="PDF page number (1-based)"),
    scale: float = Query(2.0, ge=1.0, le=4.0, description="PDF render scale factor")
):
    """
    Return an image preview.
    - If the file is an image, stream the original file.
    - If the file is a PDF, render the requested page to PNG bytes.
    """
    p = _safe_path(path)
    meta = _detect_kind(p)

    # Direct image streaming for images
    if meta["kind"] == "image":
        return FileResponse(str(p), media_type=meta["mime"] or "image/png", filename=p.name)  # [6][12]

    # Render PDF page to PNG
    if meta["kind"] == "pdf":
        try:
            with fitz.open(str(p)) as doc:
                if page > (doc.page_count or 0):
                    raise HTTPException(status_code=400, detail="Page out of range")
                pg = doc.load_page(page - 1)
                mat = fitz.Matrix(scale, scale)
                pix = pg.get_pixmap(matrix=mat, alpha=False)
                png_bytes = pix.tobytes("png")
                return Response(content=png_bytes, media_type="image/png")  # [6][12]
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF render failed: {e}")

    raise HTTPException(status_code=415, detail=f"Unsupported preview-image kind: {meta['kind']}")

@app.get("/api/file/preview-text", response_class=PlainTextResponse)
async def file_preview_text(
    path: str = Query(..., description="Absolute file path"),
    offset: int = Query(0, ge=0, description="Byte offset for large text files"),
    limit: int = Query(20000, ge=1000, le=200000, description="Max bytes to return")
):
    """
    Return text for preview.
    - Text files: return a chunk (offset/limit) to keep UI responsive.
    - PDFs: attempt text extraction for a quick textual summary (first few pages).
    """
    p = _safe_path(path)
    meta = _detect_kind(p)

    # Text-like files: chunked read (treat code files the same as text)
    if meta["kind"] in ("text", "code"):
        try:
            with open(p, "rb") as f:
                f.seek(offset)
                chunk = f.read(limit)
            try:
                return chunk.decode("utf-8", errors="replace")
            except Exception:
                return chunk.decode("latin-1", errors="replace")
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File not found")

    # PDF quick text extraction (first N chars from first pages)
    if meta["kind"] == "pdf":
        try:
            # Extract text until 'limit' chars or doc end
            remaining = limit
            out = []
            with fitz.open(str(p)) as doc:
                for i in range(doc.page_count):
                    t = doc.load_page(i).get_text()
                    if not t:
                        continue
                    if len(t) >= remaining:
                        out.append(t[:remaining])
                        remaining = 0
                        break
                    else:
                        out.append(t)
                        remaining -= len(t)
                    if remaining <= 0:
                        break
            return "".join(out)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF text extract failed: {e}")

    raise HTTPException(status_code=415, detail=f"Unsupported preview-text kind: {meta['kind']}")

# ============ QDRANT OPERATIONS ============

@app.get("/api/qdrant/health")
def qdrant_health():
    """Test if Qdrant is running and healthy"""
    try:
        # Try to fetch collections
        collections = qdrant_helper.list_collections()
        return {
            "status": "healthy",
            "qdrant_running": True,
            "collections": collections,
            "collection_count": len(collections)
        }
    except Exception as e:
        logger.error(f"Qdrant health check failed: {e}")
        return {
            "status": "unhealthy",
            "qdrant_running": False,
            "error": str(e)
        }

@app.get("/api/qdrant/collection-info")
def qdrant_collection_info():
    """Get info about the Findly collection"""
    try:
        info = qdrant_helper.get_collection_info(config.QDRANT_COLLECTION_NAME)
        return {
            "status": "success",
            "collection_name": config.QDRANT_COLLECTION_NAME,
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "config": {
                "vector_size": info.config.params.vectors if hasattr(info.config.params, 'vectors') else "N/A",
                "distance": str(info.config.params.distance) if hasattr(info.config.params, 'distance') else "N/A"
            }
        }
    except Exception as e:
        logger.error(f"Error fetching collection info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch collection info: {str(e)}")

@app.get("/api/qdrant/points")
def qdrant_get_points(limit: int = Query(10, description="Number of points to retrieve")):
    """Retrieve sample points/chunks from Qdrant collection with metadata"""
    try:
        # Scroll through collection to get sample points
        points = qdrant_helper.scroll(config.QDRANT_COLLECTION_NAME, limit=limit)
        
        formatted_points = []
        for point in points:
            formatted_points.append({
                "id": point.id,
                "payload": point.payload,
                "text_preview": point.payload.get("text", "")[:100] if "text" in point.payload else "No text",
                "file_path": point.payload.get("file_path", "N/A"),
                "type": point.payload.get("type", "N/A"),
                "hash": point.payload.get("hash", "N/A"),
                "is_filename": point.payload.get("is_filename", False)
            })
        
        return {
            "status": "success",
            "collection_name": config.QDRANT_COLLECTION_NAME,
            "total_retrieved": len(formatted_points),
            "points": formatted_points
        }
    except Exception as e:
        logger.error(f"Error retrieving points from Qdrant: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve points: {str(e)}")

@app.delete("/api/qdrant/collection")
def qdrant_delete_collection():
    """Delete/reset the Qdrant collection"""
    try:
        collection_name = config.QDRANT_COLLECTION_NAME
        qdrant_helper.delete_collection(collection_name)
        return {
            "status": "success",
            "message": f"Collection '{collection_name}' deleted successfully",
            "collection_name": collection_name
        }
    except Exception as e:
        logger.error(f"Error deleting Qdrant collection: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete collection: {str(e)}")

@app.get("/api/qdrant/filter-points")
def qdrant_filter_points(
    file_path: Optional[str] = Query(None, description="Filter by file_path"),
    file_kind: Optional[str] = Query(None, description="Filter by file_kind (text, pdf, image, binary)"),
    source: Optional[str] = Query(None, description="Filter by source (pc, etc)"),
    type_: Optional[str] = Query(None, alias="type", description="Filter by type (text, image)"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return")
):
    """
    Debug API: Filter and search for points in Qdrant based on payload attributes.
    All parameters are optional - only the provided ones will be used for filtering.
    
    Payload fields available for filtering:
    - file_path: Path to the indexed file
    - file_kind: File type (text, pdf, image, binary)
    - source: Source type (pc for personal computer files)
    - type: Content type (text or image)
    
    Example: /api/qdrant/filter-points?file_kind=image&source=pc&limit=10
    """
    try:
        # Build filter dict - only include provided parameters
        filters = {}
        
        if file_path:
            filters["file_path"] = [file_path]
            logger.info(f"Filter: file_path = {file_path}")
        
        if file_kind:
            filters["file_kind"] = [file_kind]
            logger.info(f"Filter: file_kind = {file_kind}")
        
        if source:
            filters["source"] = [source]
            logger.info(f"Filter: source = {source}")
        
        if type_:
            filters["type"] = [type_]
            logger.info(f"Filter: type = {type_}")
        
        # Scroll through collection with filters
        points = qdrant_helper.scroll(
            config.QDRANT_COLLECTION_NAME, 
            limit=limit, 
            filters=filters if filters else None
        )
        
        formatted_points = []
        for point in points:
            payload = point.payload
            formatted_points.append({
                "id": point.id,
                "file_path": payload.get("file_path", "N/A"),
                "file_kind": payload.get("file_kind", "N/A"),
                "type": payload.get("type", "N/A"),
                "source": payload.get("source", "N/A"),
                "hash": payload.get("hash", "N/A"),
                "timestamp": payload.get("timestamp", "N/A"),
                "is_filename": payload.get("is_filename", False),
                "text_preview": payload.get("text", "")[:80] if "text" in payload else "No text",
                "full_payload": payload
            })
        
        return {
            "status": "success",
            "collection_name": config.QDRANT_COLLECTION_NAME,
            "filters_applied": filters if filters else "None",
            "total_found": len(formatted_points),
            "limit": limit,
            "points": formatted_points
        }
    
    except Exception as e:
        logger.error(f"Error filtering points in Qdrant: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to filter points: {str(e)}")

@app.post("/api/reset-all")
def reset_all():
    """
    Reset everything: Qdrant collection, Redis keys, Redis queue, and indexed files database.
    WARNING: This will delete all indexed data and clear the processing queue!
    """
    try:
        results = {}
        
        # 1. Delete Qdrant collection
        try:
            qdrant_helper.delete_collection(config.QDRANT_COLLECTION_NAME)
            results["qdrant_collection"] = f"Deleted collection '{config.QDRANT_COLLECTION_NAME}'"
            logger.info("Qdrant collection deleted")
        except Exception as e:
            logger.error(f"Error deleting Qdrant collection: {e}")
            results["qdrant_collection"] = f"Error: {str(e)}"
        
        qdrant_helper.create_collection(
            config.QDRANT_COLLECTION_NAME, {
                config.CLIP_EMBEDDING_NAME: config.CLIP_EMBEDDING_FEATURE_LENGTH,
                config.TEXT_EMBEDDING_NAME: config.TEXT_EMBEDDING_FEATURE_LENGTH
            }
        )
        # 2. Clear Redis (all keys including queue)
        try:
            redis_client.flushdb()
            results["redis_database"] = "Flushed all Redis keys and queue"
            logger.info("Redis database flushed")
        except Exception as e:
            logger.error(f"Error flushing Redis: {e}")
            results["redis_database"] = f"Error: {str(e)}"
        
        # 3. Clear indexed files JSON database
        try:
            file_handler = FileHandler()
            # Delete the indexed files database file
            if os.path.exists(config.INDEXED_FILES_DB):
                os.remove(config.INDEXED_FILES_DB)
                results["indexed_files_db"] = f"Deleted '{config.INDEXED_FILES_DB}'"
                logger.info("Indexed files database cleared")
            else:
                results["indexed_files_db"] = f"File '{config.INDEXED_FILES_DB}' not found (already empty)"
        except Exception as e:
            logger.error(f"Error clearing indexed files database: {e}")
            results["indexed_files_db"] = f"Error: {str(e)}"
        
        return {
            "status": "success",
            "message": "All systems reset successfully",
            "reset_details": results
        }
    
    except Exception as e:
        logger.error(f"Error during full reset: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset all systems: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
