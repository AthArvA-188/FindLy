import uuid
import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.core.redis_client import redis_client

router = APIRouter()

INDEX_QUEUE = "index_queue"


class IndexRequest(BaseModel):
    paths: List[str]


@router.post("/index")
def start_indexing(request: IndexRequest):
    if not request.paths:
        raise HTTPException(status_code=400, detail="No paths provided")

    # Validate paths exist
    for path in request.paths:
        if not os.path.exists(path):
            raise HTTPException(
                status_code=400,
                detail=f"Path does not exist: {path}"
            )

    job_id = str(uuid.uuid4())

    job_data = {
        "status": "queued",
        "progress": 0,
        "paths": request.paths,
        "error": None
    }

    redis_client.set(f"job:{job_id}", json.dumps(job_data))
    redis_client.rpush(INDEX_QUEUE, job_id)

    return {
        "job_id": job_id,
        "status": "queued"
    }


@router.get("/index/status/{job_id}")
def get_status(job_id: str):
    job = redis_client.get(f"job:{job_id}")

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return json.loads(job)