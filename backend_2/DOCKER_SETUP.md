# FindLy Docker Setup (Full Stack)

This branch runs frontend + backend together from `backend_2/docker-compose.yml`.

## TL;DR (30 seconds)

```bash
cd backend_2
cp .env.mac.example .env   # Windows: copy .env.windows.example .env
docker compose up -d --build
```

Then open `http://localhost:5173`.

## Services

- `frontend` (Vite dev server, port `5173`)
- `app` (FastAPI, port `8000`)
- `embedding-api` (FastAPI, host port `5001` -> container `5000`)
- `queue-indexer` (background worker)
- `redis` (port `6379`)
- `qdrant` (port `6333`)

## Quick Start

### 1) Create `.env` (required)

Mac:
```bash
cd backend_2
cp .env.mac.example .env
```

Windows (PowerShell or CMD):
```bash
cd backend_2
copy .env.windows.example .env
```

`HOST_USERS_PATH` is required and must match your OS:
- Mac: `/Users`
- Windows: `C:/Users`

### 2) Start everything

```bash
cd backend_2
docker compose up -d --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

### 3) Stop everything

```bash
cd backend_2
docker compose down
```

## Logs & Health Checks

```bash
cd backend_2
docker compose ps
docker compose logs -f app
docker compose logs -f frontend
docker compose logs -f queue-indexer
```

```bash
curl http://localhost:8000/api/qdrant/health
curl http://localhost:5001/health
```

Expected responses:
```json
{"status":"healthy","qdrant_running":true,"collections":["findly"],"collection_count":1}
```
```json
{"message":"ready"}
```

Path rule:
- Replace `<YOUR_USER>` in examples with your actual username.
- Example host path in API payload: `/host/home/<YOUR_USER>/Documents`

## Common Issues

### `HOST_USERS_PATH is required`

Create/update `backend_2/.env` and set:
- Mac: `HOST_USERS_PATH=/Users`
- Windows: `HOST_USERS_PATH=C:/Users`

### `qdrant` shows `unhealthy` in `docker compose ps`

On some Docker Desktop environments, Qdrant healthcheck status can be noisy.
If these pass, treat the service as usable:
```bash
curl http://localhost:8000/api/qdrant/health
curl http://localhost:5173/api/qdrant/health
```

### Frontend can open, but API calls fail

Check app container:
```bash
cd backend_2
docker compose ps app
docker compose logs --tail=100 app
```

### After major updates, search returns 500

Rebuild and reset collection:
```bash
cd backend_2
docker compose up -d --build
curl -X POST http://localhost:8000/api/reset-all
```
