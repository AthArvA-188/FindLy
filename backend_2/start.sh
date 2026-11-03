#!/bin/bash

# FindLy Backend Docker Startup Script

echo "🚀 FindLy Backend Docker Setup"
echo "================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if already running
if docker-compose ps -q | grep -q . 2>/dev/null; then
    echo "⚠️  Services already running. To restart, run: docker-compose restart"
    docker-compose ps
    exit 0
fi

echo ""
echo "📦 Building images..."
docker-compose build

echo ""
echo "🔧 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Services started successfully!"
echo ""
echo "📍 Available endpoints:"
echo "   Main API:        http://localhost:8000"
echo "   Embedding API:   http://localhost:5000"
echo "   Qdrant:          http://localhost:6333"
echo "   Redis:           localhost:6379"
echo ""
echo "🔗 Quick checks:"
echo "   curl http://localhost:8000/api/qdrant/health       # Check main API"
echo "   curl http://localhost:5000/health                   # Check embedding API"
echo "   curl http://localhost:6333/health                   # Check Qdrant"
echo ""
echo "📚 View logs:"
echo "   docker-compose logs -f app                           # Main API logs"
echo "   docker-compose logs -f embedding-api                # Embedding API logs"
echo "   docker-compose logs -f queue-indexer                # Queue indexer logs"
echo ""
echo "🛑 To stop services:"
echo "   docker-compose down                                 # Stop (keep data)"
echo "   docker-compose down -v                              # Stop (delete data)"
echo ""
