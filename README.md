# FindLy

Public portfolio snapshot of a **USC team project**, maintained by
Atharva Sandeep Bhide. See [team attribution and source provenance](ATTRIBUTION.md).

The current full stack uses **FastAPI, Redis, Qdrant, CLIP/SentenceTransformer,
React, and Docker Compose**. `findly_engine/` retains the earlier FAISS/SQLite
engine and Atharva's file-watcher implementation. Documentation inside that
directory describes an earlier development stage.

This source snapshot excludes local indexes, metadata, caches, and private
Git history. No new license has been added. The application is a local
development/demo system; its Docker Compose setup is not a hardened public
deployment. Mount only folders you intend to index.


Semantic file search for your local machine using CLIP and SentenceTransformer embeddings.

## TL;DR (30 seconds)

```bash
cd backend_2
cp .env.mac.example .env   # Windows: copy .env.windows.example .env
docker compose up -d --build
```

Open `http://localhost:5173` and use the left panel to pick folders/files.

Path rule:
- In API examples, replace `<YOUR_USER>` with your OS username.
- Example: `/host/home/<YOUR_USER>/Documents`

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

---

## One-Command Full Stack (Recommended)

FindLy runs frontend + backend together from `backend_2` using Docker Compose.

### 1) Prepare `.env` (required)

- Mac:
  ```bash
  cd backend_2
  cp .env.mac.example .env
  ```
- Windows:
  ```bash
  cd backend_2
  copy .env.windows.example .env
  ```

`HOST_USERS_PATH` is mandatory. Compose will fail fast if it is not set.

### 2) Start all services

```bash
cd backend_2
docker compose up -d --build
```

This starts:
- Frontend (Vite): `http://localhost:5173`
- API app (FastAPI): `http://localhost:8000`
- Embedding API: `http://localhost:5001`
- Redis + Qdrant + Queue Indexer

### 3) Stop

```bash
cd backend_2
docker compose down
```

### 4) Check logs

```bash
cd backend_2
docker compose logs -f app
docker compose logs -f frontend
```

### 5) Health checks (with expected responses)

```bash
curl http://localhost:8000/api/qdrant/health
curl http://localhost:5173/api/qdrant/health
```

Expected shape:
```json
{"status":"healthy","qdrant_running":true,"collections":["findly"],"collection_count":1}
```

---

## Optional: Run Frontend Locally

If you prefer local Node dev instead of Docker frontend:
```bash
cd frontend
npm install      # first time only
npm run dev
```
The frontend is configured to use `/api` + Vite proxy, so local frontend still connects to Docker backend on `localhost:8000`.

---

## Troubleshooting

- If search returns 500 due vector mismatch after updates, rebuild and reset:
  ```bash
  cd backend_2
  docker compose up -d --build
  curl -X POST http://localhost:8000/api/reset-all
  ```
- Verify host path mount:
  - Mac: `HOST_USERS_PATH=/Users`
  - Windows: `HOST_USERS_PATH=C:/Users`
- `docker compose ps` may show `qdrant` as `unhealthy` on some Docker Desktop setups even when API/search still work.
  Use `curl http://localhost:8000/api/qdrant/health` as the source of truth.
