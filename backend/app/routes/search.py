import io
import os
import json
from fastapi import APIRouter, File, UploadFile, Form
from pydantic import BaseModel
from typing import List, Optional
from findly_engine.engine import FindlyEngine

try:
    from PIL import Image
except Exception:
    Image = None

router = APIRouter()

# Compute absolute project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
DATA_PATH = os.path.join(PROJECT_ROOT, "findly_engine", "data")
engine = FindlyEngine(base_path=DATA_PATH, use_sentence_transformer=True)

class SearchRequest(BaseModel):
    query: str
    k: int = 5
    mode: str = "text"
    allowed_paths: Optional[List[str]] = None

class ClipTextSearchRequest(BaseModel):
    """Text query to search across image embeddings (text→image via CLIP)."""
    query: str
    k: int = 5
    allowed_paths: Optional[List[str]] = None

def _format_results(results):
    """Shared formatter for both text and image search results."""
    formatted = []
    for r in results:
        formatted.append({
            "file_path": r["file_path"],
            "file_type": r["file_type"],
            "confidence": r["confidence"],
            "snippet": r["meta_blob"].get("text_preview", ""),
            "page": r["meta_blob"].get("page")
        })
    return formatted


@router.post("/search/text")
def search_text(req: SearchRequest):
    results = engine.search_api(
        query=req.query,
        mode=req.mode,
        k=req.k,
        allowed_paths=req.allowed_paths
    )
    return {"results": _format_results(results)}

@router.post("/search/text-to-image")
def clip_text_search(req: ClipTextSearchRequest):
    """
    Text-to-image search.
    Embeds the text query into the CLIP image space and searches the image
    FAISS index. Returns images whose embeddings are closest to the text query.

    TODO: Replace dummy embedding with  clip_model.encode_text(query)
    """
    results = engine.search_api(
        query=req.query,
        mode="image",          # search the image index
        k=req.k,
        allowed_paths=req.allowed_paths
    )
    return {"results": _format_results(results)}


@router.post("/search/image-to-image")
async def clip_image_search(
    image: UploadFile = File(...),
    k: int = Form(10),
    allowed_paths: Optional[str] = Form(None),
):
    """
    Image-to-image search.
    Reads the uploaded image, computes its CLIP embedding, and searches
    the image FAISS index for visually similar indexed images.

    TODO: Replace dummy embedding with  clip_model.encode_image(image_bytes)
    """
    contents = await image.read()
    filename = image.filename or "upload"

    # Build content identifier (mirrors engine.extract_image format)
    content_id = f"image_data_{filename}"
    if Image:
        try:
            img = Image.open(io.BytesIO(contents))
            width, height = img.size
            content_id = f"IMAGE({filename})_{width}x{height}"
            img.close()
        except Exception:
            pass

    # Parse allowed_paths from JSON string (form fields are strings)
    parsed_paths = None
    if allowed_paths:
        try:
            parsed_paths = json.loads(allowed_paths)
        except (json.JSONDecodeError, TypeError):
            parsed_paths = None

    results = engine.search_api(
        query=content_id,
        mode="image",
        k=k,
        allowed_paths=parsed_paths
    )
    return {"results": _format_results(results)}