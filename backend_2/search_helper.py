import requests
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import config 

from qdrant_helper import QdrantHelper
qdrant_helper = QdrantHelper(hostname=config.QDRANT_HOST, port=config.QDRANT_PORT)

import logging
logger = logging.getLogger(__name__)
logging.basicConfig(
    # filename="logs.log",
    format='%(asctime)s - %(process)d - %(name)s - %(filename)s:%(lineno)d - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    level=logging.INFO)

def get_embeddings(text=None, image_bytes=None, type=None):
    # clip_image_embed_url = "http://localhost:5000/get-clip-image-embedding"
    # clip_text_embed_url = "http://localhost:5000/get-clip-text-embedding"
    clip_image_embed_url = "http://embedding-api:5000/get-clip-image-embedding"
    clip_text_embed_url = "http://embedding-api:5000/get-clip-text-embedding"
    mpnet_text_embed_url = "http://embedding-api:5000/get-text-embedding"

    if text is not None:
        data = {
            "text": text
        }
        if type == "text":
            response = requests.post(mpnet_text_embed_url, json=data)
        else:
            response = requests.post(clip_text_embed_url, json=data)
    else:
        files = {'file': ('image.jpg', image_bytes, 'image/jpeg')}
        response = requests.post(clip_image_embed_url, files=files)

    if response.status_code == 200:
        return response.json()
    else:
        logger.error(f"Error in embedding API: {response.text}")
        return {}
    
def search(text=None, image_bytes=None, search_for=None, group_by=None, file_kinds=None):
    def _build_filters(search_type, file_kinds):
        """Build filter dict: always filter by type, optionally by file_kind."""
        f = {"type": [search_type]}
        if file_kinds:
            f["file_kind"] = list(file_kinds)
        return f

    if text is not None:
        if search_for == "text":
            embed_result = get_embeddings(text=text, type="text")
            if "text_embedding" not in embed_result:
                logger.error("text_embedding missing from embedding API response")
                return []
            embeddings = embed_result["text_embedding"]
            results = qdrant_helper.search(config.QDRANT_COLLECTION_NAME, embeddings, limit=6, feature_name=config.TEXT_EMBEDDING_NAME, filters=_build_filters("text", file_kinds), group_by=group_by)
        else:
            embed_result = get_embeddings(text=text, type="image")
            if "text_embedding" not in embed_result:
                logger.error("clip text_embedding missing from embedding API response")
                return []
            embeddings = embed_result["text_embedding"]
            results = qdrant_helper.search(config.QDRANT_COLLECTION_NAME, embeddings, limit=6, feature_name=config.CLIP_EMBEDDING_NAME, filters=_build_filters("image", file_kinds), group_by=group_by)
    else:
        embed_result = get_embeddings(image_bytes=image_bytes)
        if "image_embedding" not in embed_result:
            logger.error("image_embedding missing from embedding API response")
            return []
        embeddings = embed_result["image_embedding"]
        results = qdrant_helper.search(config.QDRANT_COLLECTION_NAME, embeddings, limit=6, feature_name=config.CLIP_EMBEDDING_NAME, filters=_build_filters("image", file_kinds), group_by=group_by)

    logger.info(results)
    final_result = []
    groups = results.groups if hasattr(results, "groups") else []
    for group in groups:
        if group.hits:
            hit = group.hits[0]
            final_result.append({
                "score": hit.score,
                "payload": hit.payload
            })
    return final_result