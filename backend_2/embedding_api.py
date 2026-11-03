from fastapi import FastAPI
from pydantic import BaseModel  
from embedding_helper import CLIPEmbedder, TextEmbedder
from fastapi import UploadFile, File

embedder = CLIPEmbedder()
text_embedder = TextEmbedder()
app = FastAPI()

class EmbedRequest(BaseModel):
    text: str = None
    image_path: str = None

@app.post("/get-clip-text-embedding")
async def get_text_embedding(request: EmbedRequest):
    return embedder.embed(text=request.text)

@app.post("/get-clip-image-embedding")
async def get_image_embedding(file: UploadFile = File(...)):
    image_bytes = await file.read()
    return embedder.embed(image_bytes=image_bytes)

@app.post("/get-text-embedding")
async def get_text_embedding_sota(request: EmbedRequest):
    """Get SOTA text embedding (768-dim) using Sentence Transformers."""
    return text_embedder.embed(text=request.text)

@app.get("/health")
async def check_status():
    return {"message": "ready"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("embedding_api:app", host="0.0.0.0", port=5000, reload=False)
