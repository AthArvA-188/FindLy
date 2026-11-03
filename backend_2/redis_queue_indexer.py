import redis
import json
import os
import config
import mimetypes
import hashlib
import logging
import fitz
import uuid
import time
from typing import List, Tuple
from search_helper import get_embeddings

logger = logging.getLogger(__name__)
logging.basicConfig(
    filename="logs.log",
    format='%(asctime)s - %(process)d - %(name)s - %(filename)s:%(lineno)d - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.INFO)

# ── Chunking configuration ──────────────────────────────────────────────────
PDF_CHUNK_SIZE    = 800   # characters per chunk for PDF pages
PDF_CHUNK_OVERLAP = 0.25  # 25% character overlap between consecutive chunks
TEXT_CHUNK_SIZE    = 800
TEXT_CHUNK_OVERLAP = 0.25

redis_client = redis.Redis(host="findly-redis", port=6379, db=0)

from qdrant_helper import QdrantHelper
qdrant_helper = QdrantHelper(hostname=config.QDRANT_HOST, port=config.QDRANT_PORT)
collections = qdrant_helper.list_collections()
if config.QDRANT_COLLECTION_NAME not in collections:
    logger.info(f"creating collection: {config.QDRANT_COLLECTION_NAME}")
    qdrant_helper.create_collection(
        config.QDRANT_COLLECTION_NAME, {
            config.CLIP_EMBEDDING_NAME: config.CLIP_EMBEDDING_FEATURE_LENGTH,
            config.TEXT_EMBEDDING_NAME: config.TEXT_EMBEDDING_FEATURE_LENGTH
        }
    )

# Extensions that should always be read as UTF-8 text (code + plain text)
_TEXTUAL_EXTENSIONS = {
    # Plain text / data
    ".txt", ".md", ".log", ".json", ".xml", ".csv", ".rtf",
    # Code
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

def get_file_content(file_path: str):
    """
    Opens a file and returns:
      - str  for plain-text / code files
      - bytes for image files
      - None on error or unsupported type

    PDFs are handled separately via get_pdf_pages(); this function does NOT
    read PDFs so callers should branch on file_kind before calling.
    """
    if not os.path.exists(file_path):
        logger.warning("File not found: %s", file_path)
        return None

    mime_type, _ = mimetypes.guess_type(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext in _TEXTUAL_EXTENSIONS or (mime_type and mime_type.startswith("text")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            logger.info("Read text file: %s (%d chars)", file_path, len(content))
            return content

        elif mime_type and mime_type.startswith("image"):
            with open(file_path, "rb") as f:
                content = f.read()
            logger.info("Read image file: %s (%d bytes)", file_path, len(content))
            return content

        logger.warning("Unsupported file type: %s (mime: %s)", file_path, mime_type)
        return None

    except Exception as e:
        logger.error("Error reading file %s: %s", file_path, e)
        return None
    
def chunk_text_with_overlap(text: str, chunk_size: int = 800, overlap_ratio: float = 0.25) -> List[str]:
    """
    Character-based text chunking with configurable overlap (mirrors findly_engine.chunking).

    Splits text into chunks of at most `chunk_size` characters where consecutive
    chunks overlap by `overlap_ratio * chunk_size` characters (e.g. 0.25 → 25%).
    Empty / whitespace-only input returns [].
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
    step = max(1, chunk_size - overlap_chars)

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

    logger.info("Created %d chunks from %d chars", len(chunks), len(stripped))
    return chunks


def get_pdf_pages(file_path: str) -> List[Tuple[int, str]]:
    """
    Extract text from a PDF, returning a list of (page_number, page_text) tuples.
    page_number is 1-based. Pages with no extractable text are skipped.
    """
    pages = []
    try:
        with fitz.open(file_path) as pdf:
            for page_num, page in enumerate(pdf, start=1):
                text = (page.get_text() or "").strip()
                if text:
                    pages.append((page_num, text))
        logger.info("Extracted %d non-empty pages from %s", len(pages), file_path)
    except Exception as e:
        logger.warning("fitz failed for %s: %s", file_path, e)
    return pages

def index(all_indexing_data): 
    """
    High-level indexing function: processes chunks and items, generates embeddings, and stores in Qdrant.
    Separates text items from image items and processes them accordingly.
    
    TODO: Integrate with:
    - get_embeddings() from search_helper
    - qdrant_helper from QdrantHelper class
    """
    try:
        text_points = []
        image_points = []
        
        logger.info(f"Indexing {len(all_indexing_data)} items")
        
        for item in all_indexing_data:
            try:
                if "text" in item and item["text"]:
                    # Text chunk - generate text embedding
                    if len(text_points) < 500:  # Batch limit
                        logger.info(f"Text item: {item.get('file_path')} - {item['text'][:50]}...")
                        text_embedding = get_embeddings(text=item["text"], type="text")["text_embedding"]
                        point = {
                            "id": str(uuid.uuid4()),
                            "payload": item,
                            "vectors": {config.TEXT_EMBEDDING_NAME: text_embedding}
                        }
                        text_points.append(point)
                        logger.info(f"Added text point: {item.get('file_path')}")
                
                elif "image_bytes" in item and item["image_bytes"]:
                    logger.info(f"Image item: {item.get('file_path')} ({len(item['image_bytes'])} bytes)")
                    image_bytes = item["image_bytes"]
                    item_copy = item.copy()
                    del item_copy["image_bytes"] 
                    
                    image_embedding = get_embeddings(image_bytes=image_bytes, type="image")["image_embedding"]
                    point = {
                        "id": str(uuid.uuid4()),
                        "payload": item_copy,
                        "vectors": {config.CLIP_EMBEDDING_NAME: image_embedding} 
                    }
                    image_points.append(point)
                    logger.info(f"Added image point: {item.get('file_path')}")
                    
            except Exception as e:
                logger.error(f"Error processing item: {item} - {e}")
        
        # Upsert to Qdrant if we have points
        if text_points:
            logger.info(f"Upserting {len(text_points)} text points to Qdrant")
            try:
                qdrant_helper.upsert_points(config.QDRANT_COLLECTION_NAME, text_points)
                logger.info(f"Successfully upserted {len(text_points)} text points")
            except Exception as e1:
                logger.exception(f"Exception while upserting text_points: {e1}")
        
        if image_points:
            logger.info(f"Upserting {len(image_points)} image points to Qdrant")
            try:
                qdrant_helper.upsert_points(config.QDRANT_COLLECTION_NAME, image_points)
                logger.info(f"Successfully upserted {len(image_points)} image points")
            except Exception as e2:
                logger.exception(f"Exception while upserting image_points: {e2}")
            
    except Exception as e:
        logger.exception(f"Exception in index(): {e}")

if __name__ == "__main__":
    logger.info("[Redis Queue Consumer] Starting... Waiting for messages")
    while True:
        try:
            # Blocking pop - waits indefinitely for messages
            item = redis_client.brpop(config.REDIS_QUEUE_NAME, timeout=0)
            
            if item:
                queue_name, message = item
                message_str = message.decode('utf-8')
                
                try:
                    # Parse JSON message
                    msg_data = json.loads(message_str)
                    file_path = msg_data.get("file_path")
                    file_kind = msg_data.get("kind")
                    file_hash = msg_data.get("hash")
                    retry_count = msg_data.get("retry_count", 0)

                    logger.info("[Queue] Received: %s (kind: %s, hash: %s)", file_path, file_kind, file_hash)

                    if not file_path or not file_kind:
                        logger.error("[Queue] Malformed message — missing file_path or kind: %s", message_str)
                        continue

                    # Delete existing Qdrant chunks before (re)indexing — makes all queue
                    # messages idempotent. delete_points with no matching points is a no-op,
                    # so this is safe for first-time indexing too.
                    MAX_DELETE_RETRIES = 3
                    try:
                        qdrant_helper.delete_points(config.QDRANT_COLLECTION_NAME, {"file_path": [file_path]})
                        logger.info("[Queue] Cleared existing points for: %s", file_path)
                    except Exception:
                        if retry_count < MAX_DELETE_RETRIES:
                            time.sleep(1)
                            requeue_msg = json.dumps({**msg_data, "retry_count": retry_count + 1})
                            redis_client.rpush(config.REDIS_QUEUE_NAME, requeue_msg)
                            logger.warning("[Queue] delete_points failed for %s — requeued (attempt %d/%d)",
                                           file_path, retry_count + 1, MAX_DELETE_RETRIES)
                        else:
                            logger.exception("[Queue] delete_points FAILED %d times for %s — dropping message",
                                             MAX_DELETE_RETRIES, file_path)
                        continue

                    timestamp = time.time()
                    source = "pc"  # Personal computer files
                    
                    # ── Common filename chunk (added to every file for name-based search) ──
                    def _filename_chunk():
                        return {
                            "file_path": file_path,
                            "text": os.path.basename(file_path),
                            "timestamp": timestamp,
                            "type": "text",
                            "source": source,
                            "hash": file_hash,
                            "file_kind": file_kind,
                            "is_filename": True,
                        }

                    # ── Process by file kind ──────────────────────────────────────────
                    if file_kind == "image":
                        logger.info("Processing image file: %s", file_path)
                        content = get_file_content(file_path)
                        if content is None:
                            logger.warning("Could not read image: %s", file_path)
                            continue
                        index([{
                            "file_path": file_path,
                            "timestamp": timestamp,
                            "type": "image",
                            "image_bytes": content,
                            "source": source,
                            "hash": file_hash,
                            "file_kind": file_kind,
                        }])

                    elif file_kind == "pdf":
                        logger.info("Processing PDF file: %s", file_path)
                        pages = get_pdf_pages(file_path)
                        if not pages:
                            # No extractable text — render each page as an image and index via CLIP
                            logger.warning("No text extracted from PDF: %s — falling back to image rendering", file_path)
                            try:
                                with fitz.open(file_path) as pdf:
                                    image_items = []
                                    for page_num, page in enumerate(pdf, start=1):
                                        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                                        img_bytes = pix.tobytes("jpeg")
                                        image_items.append({
                                            "file_path": file_path,
                                            "timestamp": timestamp,
                                            "type": "image",
                                            "image_bytes": img_bytes,
                                            "source": source,
                                            "hash": file_hash,
                                            "file_kind": file_kind,
                                            "page": page_num,
                                        })
                                    if image_items:
                                        image_items.append(_filename_chunk())
                                        logger.info("Rendered %d pages as images for %s", len(image_items) - 1, file_path)
                                        index(image_items)
                            except Exception as e:
                                logger.error("Failed to render PDF pages as images for %s: %s", file_path, e)
                            continue

                        all_chunks = []
                        for page_num, page_text in pages:
                            chunks = chunk_text_with_overlap(
                                page_text, PDF_CHUNK_SIZE, PDF_CHUNK_OVERLAP
                            )
                            for cidx, chunk in enumerate(chunks):
                                all_chunks.append({
                                    "file_path": file_path,
                                    "text": chunk,
                                    "timestamp": timestamp,
                                    "type": "text",
                                    "source": source,
                                    "hash": file_hash,
                                    "file_kind": file_kind,
                                    "page": page_num,
                                    "chunk_index": cidx,
                                })

                        all_chunks.append(_filename_chunk())
                        logger.info(
                            "Created %d chunks from %d pages of %s",
                            len(all_chunks), len(pages), file_path,
                        )
                        index(all_chunks)

                    elif file_kind in ("text", "code"):
                        logger.info("Processing %s file: %s", file_kind, file_path)
                        content = get_file_content(file_path)
                        if content is None:
                            logger.warning("Could not read %s file: %s", file_kind, file_path)
                            continue

                        chunks = chunk_text_with_overlap(
                            content, TEXT_CHUNK_SIZE, TEXT_CHUNK_OVERLAP
                        )
                        all_chunks = []
                        for cidx, chunk in enumerate(chunks):
                            all_chunks.append({
                                "file_path": file_path,
                                "text": chunk,
                                "timestamp": timestamp,
                                "type": "text",
                                "source": source,
                                "hash": file_hash,
                                "file_kind": file_kind,  # preserves "code" vs "text" for filtering
                                "chunk_index": cidx,
                            })

                        all_chunks.append(_filename_chunk())
                        logger.info(
                            "Created %d chunks from %s", len(all_chunks), file_path
                        )
                        index(all_chunks)

                    else:
                        logger.warning("Unknown file kind: %s", file_kind)
                
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse message as JSON: {message_str} - Error: {e}")
                except Exception as e:
                    logger.error(f"Error processing queue item: {e}", exc_info=True)
        
        except Exception as e:
            logger.error(f"Unexpected error in consumer loop: {e}", exc_info=True)
