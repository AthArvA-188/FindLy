# 🚀 FindLy Backend Docker - Complete Walkthrough

## What We've Created

You now have a complete Docker-based deployment for FindLy with:
- ✅ Redis (caching & queue)
- ✅ Qdrant (vector database)
- ✅ Embedding API (CLIP model)
- ✅ Queue Indexer (background worker)
- ✅ FastAPI Main Application

## 📁 Files Created

```
backend_2/
├── requirements.txt          # All Python dependencies
├── docker-compose.yml        # Orchestration for all services
├── Dockerfile.app           # FastAPI application container
├── Dockerfile.embedding     # CLIP embedding service container
├── Dockerfile.indexer       # Queue indexer worker container
├── .env.example             # Environment variables template
├── .dockerignore            # Files to ignore in Docker build
├── start.sh                 # Quick startup script
├── DOCKER_SETUP.md          # Detailed Docker guide
└── WALKTHROUGH.md           # This file
```

## 🎯 Step-by-Step Guide

### Step 1: Install Prerequisites

```bash
# Check Docker version (need Docker 20.10+)
docker --version

# Check Docker Compose version (need 1.29+)
docker-compose --version

# If not installed:
# Follow: https://docs.docker.com/get-docker/
# Follow: https://docs.docker.com/compose/install/
```

### Step 2: Navigate to Backend Directory

```bash
cd /home/srj/FindLy/backend_2

# Verify files are in place
ls -la | grep -E "(requirements|docker-compose|Dockerfile|start.sh)"
```

### Step 3: Start Services (Option A - Easy Way)

```bash
# Make start script executable (already done)
chmod +x start.sh

# Run the convenient startup script
./start.sh

# This will:
# 1. Build Docker images
# 2. Start all containers
# 3. Wait for health checks
# 4. Show status and endpoints
```

### Step 3: Start Services (Option B - Manual Way)

```bash
# Build all images
docker-compose build

# Start all services in detached mode
docker-compose up -d

# Check status
docker-compose ps

# You should see:
# NAME                    STATUS
# findly-app              Up (healthy)
# findly-embedding-api    Up (healthy)
# findly-queue-indexer    Up (running)
# findly-qdrant           Up (healthy)
# findly-redis            Up (healthy)
```

### Step 4: Verify All Services Are Running

```bash
# Check main API
curl http://localhost:8000/api/qdrant/health
# Expected response: {"status": "healthy", "qdrant_running": true, ...}

# Check embedding API
curl http://localhost:5000/health
# Expected response: {"message": "ready"}

# Check Qdrant
curl http://localhost:6333/health
# Expected response: qdrant is healthy

# Check Redis
docker-compose exec redis redis-cli ping
# Expected response: PONG
```

### Step 5: Test the Complete Pipeline

```bash
# 1. First, reset everything to clean state
curl -X POST http://localhost:8000/api/reset-all
# Response: {"status": "success", "message": "All systems reset successfully", ...}

# 2. Check initial state
curl http://localhost:8000/api/qdrant/collection-info
# Response should show 0 points

# 3. Index a file
curl -X POST http://localhost:8000/api/index-files \
  -H "Content-Type: application/json" \
  -d '{
    "file_paths": ["/etc/hostname"]
  }'
# Response: Shows file indexed with status

# 4. Check Redis queue (should have message)
docker-compose exec redis redis-cli LLEN index_queue
# Response: 1 (one message in queue)

# 5. Watch queue indexer process the file
docker-compose logs -f queue-indexer
# Wait 10-30 seconds, you'll see:
# - File read
# - Chunks created
# - Embeddings generated
# - Points upserted to Qdrant

# 6. Check if points were added to Qdrant
curl "http://localhost:8000/api/qdrant/collection-info"
# Response should show increased points_count

# 7. Get sample points from Qdrant
curl "http://localhost:8000/api/qdrant/points?limit=5"
# Response: Shows indexed chunks with scores

# 8. Search for content
curl -X POST http://localhost:8000/api/search-pc \
  -H "Content-Type: multipart/form-data" \
  -F "text=hostname" \
  -F "search_for=text-to-text"
# Response: Returns relevant chunks with similarity scores
```

### Step 6: Monitor the System

```bash
# View all logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs -f app                 # Main API
docker-compose logs -f queue-indexer       # File processor
docker-compose logs -f embedding-api       # Embedding service
docker-compose logs -f qdrant              # Vector database
docker-compose logs -f redis               # Cache

# Last 50 lines of specific service
docker-compose logs --tail=50 app

# Watch resource usage
docker stats findly-app findly-redis findly-qdrant
```

## 🔧 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    End User / Client                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │   FastAPI App (8000)   │
            │   - File indexing      │
            │   - Directory browsing │
            │   - Semantic search    │
            │   - Collection mgmt    │
            └────────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐     ┌─────────┐
    │ Redis  │     │ Qdrant  │     │Embedding│
    │ (6379) │     │ (6333)  │     │ (5000)  │
    └────────┘     └─────────┘     └─────────┘
         ▲               ▲              ▲
         │               │              │
         └───────────────┼──────────────┘
                         │
                    ┌────▼──────┐
                    │   Queue   │
                    │ Indexer   │
                    │(Background)
                    └───────────┘

Workflow:
1. User submits files via API
2. API sends messages to Redis queue
3. Queue indexer reads messages
4. Indexer reads files and chunks text
5. Indexer calls Embedding API for vectors
6. Indexer stores vectors in Qdrant
7. Search queries Qdrant for similar content
8. Results include similarity scores
```

## 📊 Data Flow Example: Index a File

```
User POST /api/index-files with file_path
    ↓
FastAPI validates and generates MD5 hash
    ↓
Stores metadata in indexed_files.json
    ↓
Stores hash in Redis for quick lookup
    ↓
Sends JSON message to Redis queue:
{
  "file_path": "/path/to/file.txt",
  "kind": "text",
  "hash": "abc123..."
}
    ↓
Queue Indexer receives message
    ↓
Reads file content
    ↓
Chunks text into 5-word segments with overlap
    ↓
For each chunk, calls Embedding API
    ↓
Gets vector embedding (512 dimensions)
    ↓
Creates point with payload and vector
    ↓
Upserts point to Qdrant collection
    ↓
✅ File is now searchable!
```

## 🔍 Search Data Flow

```
User POST /api/search-pc with query text
    ↓
Get text embedding from Embedding API
    ↓
Query Qdrant with embedding vector
    ↓
Qdrant returns similar points with scores
    ↓
Format results with:
  - similarity_score (0.0 - 1.0)
  - file_path
  - chunk text
  - chunk metadata
    ↓
Return to user
```

## ⚙️ Configuration Walkthrough

### requirements.txt
Lists all Python packages needed:
- **FastAPI/Uvicorn**: Web framework
- **Redis**: Cache and queue client
- **Qdrant-client**: Vector DB client
- **PyMuPDF**: PDF reading
- **Torch/Transformers**: CLIP model
- **Pillow/Numpy**: Image processing

### docker-compose.yml
Defines all services:

```yaml
services:
  redis:           # Port 6379 - queue storage
  qdrant:          # Port 6333 - vector database
  embedding-api:   # Port 5000 - CLIP service
  queue-indexer:   # No port - background worker
  app:             # Port 8000 - main API
```

### Dockerfiles
Each has specific dependencies:
- **Dockerfile.app**: FastAPI and dependencies
- **Dockerfile.embedding**: PyTorch and Transformers (larger)
- **Dockerfile.indexer**: Same as app + PDF support

## 🚨 Troubleshooting

### Issue: "Services already running"
```bash
# Solution: Stop first or use different project name
docker-compose down
docker-compose up -d
```

### Issue: Port already in use
```bash
# Find what's using port 8000
lsof -i :8000

# In docker-compose.yml, change ports:
# From: "8000:8000"
# To:   "8001:8000"
```

### Issue: Out of memory
```bash
# Allocate more Docker resources
# Docker Desktop → Preferences → Resources → Memory

# Or reduce limits
docker-compose down
docker system prune -a
docker-compose build --no-cache
```

### Issue: Embedding API slow on first run
```bash
# Normal - it downloads ~350MB CLIP model
# Watch progress:
docker-compose logs -f embedding-api

# Takes 2-5 minutes first time only
# Cached afterwards
```

### Issue: Queue indexer not processing files
```bash
# Check logs
docker-compose logs queue-indexer

# Check if Redis queue has messages
docker-compose exec redis redis-cli LLEN index_queue

# Check Qdrant connection
curl http://localhost:6333/health
```

## 📚 Common Commands

```bash
# Build and start
docker-compose build
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs

# Stop (keep data)
docker-compose down

# Stop (delete data)
docker-compose down -v

# Restart specific service
docker-compose restart app

# Run command in container
docker-compose exec app python config.py
docker-compose exec redis redis-cli DBSIZE

# View specific logs
docker-compose logs app
docker-compose logs -f --tail=50 queue-indexer
```

## 🎓 Learning Paths

### Beginner: Just run it
```bash
./start.sh
# Done! Everything is running
```

### Intermediate: Understand the flow
1. Read DOCKER_SETUP.md
2. Watch logs while indexing a file
3. Check Qdrant collection with API
4. Try different search queries

### Advanced: Customize and extend
1. Modify config.py for different settings
2. Add new embedding models
3. Extend search functionality
4. Set up persistent storage
5. Deploy to production

## ✅ Success Checklist

- [ ] All services show "healthy" in `docker-compose ps`
- [ ] `curl http://localhost:8000/api/qdrant/health` returns healthy status
- [ ] Can index a file and see it in `/api/qdrant/points`
- [ ] Search returns results with scores
- [ ] Queue indexer processes files without errors
- [ ] Qdrant shows increasing point count
- [ ] No persistent error messages in logs

## 🎉 Working System!

You now have a **complete, containerized FindLy backend** with:

✅ File indexing (single files, multiple files, directories)
✅ Semantic search (text-to-text, text-to-image, image-to-text, image-to-image)
✅ Vector similarity with scoring
✅ Redis queue-based async processing
✅ Qdrant vector database
✅ CLIP embeddings for text and images
✅ Built-in debugging endpoints
✅ System reset capability

## 📞 Next Steps

1. **Frontend Integration**: Connect to the React frontend in `/home/srj/FindLy/frontend`
2. **Add More Models**: Extend embedding_helper.py with different embedding models
3. **Production Deployment**: Use docker-compose with environment variables
4. **Add Authentication**: Implement API key authentication
5. **Database Cleanup**: Periodic cleanup of old indexed data

## 🔗 Useful Resources

- Docker Docs: https://docs.docker.com
- Qdrant Docs: https://qdrant.tech/documentation/
- FastAPI Docs: http://localhost:8000/docs (when running)
- CLIP Model: https://openai.com/research/learning-transferable-models/

---

**You're all set!** 🚀 Your FindLy backend is ready to index and search!
