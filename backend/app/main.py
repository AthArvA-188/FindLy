import sys
import os
# Add project root to PYTHONPATH
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import directory, indexing, search

app = FastAPI(title="Local File Search API")

# Enable CORS (frontend will need this)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(directory.router)
app.include_router(indexing.router)
app.include_router(search.router)

@app.get("/")
def root():
    return {"message": "Backend is running"}