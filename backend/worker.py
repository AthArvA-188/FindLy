import json
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))
from app.core.redis_client import redis_client
from findly_engine.engine import FindlyEngine


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(PROJECT_ROOT, "findly_engine", "data")
engine = FindlyEngine(base_path=DATA_PATH, use_sentence_transformer=True)

INDEX_QUEUE = "index_queue"


def process_job(job_id):
    print(f"Processing job {job_id}")

    job_key = f"job:{job_id}"
    job = json.loads(redis_client.get(job_key))

    try:
        job["status"] = "processing"
        redis_client.set(job_key, json.dumps(job))

        all_files = []

        # Collect files — handle both individual files and directories
        for root_path in job["paths"]:
            if os.path.isfile(root_path):
                all_files.append(root_path)
            elif os.path.isdir(root_path):
                for root, _, files in os.walk(root_path):
                    for f in files:
                        full_path = os.path.join(root, f)
                        all_files.append(full_path)

        total = len(all_files)
        if total == 0:
            raise Exception("No files found to index")

        indexed = 0

        for filepath in all_files:
            success = engine.process_file(filepath)
            if success:
                indexed += 1

            job["progress"] = int((indexed / total) * 100)
            redis_client.set(job_key, json.dumps(job))

        job["status"] = "completed"

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)

    redis_client.set(job_key, json.dumps(job))
    print(f"Job {job_id} finished with status: {job['status']}")


def worker():
    print("Worker started...")

    while True:
        _, job_id = redis_client.blpop(INDEX_QUEUE)
        process_job(job_id)


if __name__ == "__main__":
    worker()