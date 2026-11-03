import torch
from transformers import CLIPProcessor, CLIPModel
from sentence_transformers import SentenceTransformer
from PIL import Image
import numpy as np
from io import BytesIO
import numpy as np
import requests

class CLIPEmbedder:
    def __init__(self, model_name="openai/clip-vit-base-patch32", device=None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CLIPModel.from_pretrained(model_name).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(model_name)

    def embed_text(self, text: str) -> np.ndarray:
        inputs = self.processor(text=[text], return_tensors="pt", padding=True).to(self.device)
        with torch.no_grad():
            embeddings = self.model.get_text_features(**inputs)
        return embeddings.cpu().numpy().squeeze()

    def embed_image(self, image_bytes: bytes) -> np.ndarray:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            embeddings = self.model.get_image_features(**inputs)
        return embeddings.cpu().numpy().squeeze()

    def embed(self, text: str = None, image_bytes: str = None) -> dict:
        result = {}
        if text:
            result["text_embedding"] = self.embed_text(text).tolist()
        if image_bytes:
            result["image_embedding"] = self.embed_image(image_bytes).tolist()
        return result


class TextEmbedder:
    """
    State-of-the-art text embedding model using Sentence Transformers.
    Uses 'all-mpnet-base-v2' which provides high-quality semantic embeddings (768-dim).
    """
    def __init__(self, model_name: str = "sentence-transformers/all-mpnet-base-v2", device: str = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SentenceTransformer(model_name, device=self.device)
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
    
    def embed_text(self, text: str) -> np.ndarray:
        """Embed a single text string."""
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding
    
    def embed_texts(self, texts: list) -> np.ndarray:
        """Embed multiple texts efficiently in batch."""
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return embeddings
    
    def embed(self, text: str) -> dict:
        """Embed text and return as dictionary."""
        return {
            "text_embedding": self.embed_text(text).tolist(),
            "embedding_dim": self.embedding_dim
        }
