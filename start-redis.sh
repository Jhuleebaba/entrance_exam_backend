#!/bin/bash

echo "🚀 Starting Redis for Exam System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Redis container is already running
if docker ps --format '{{.Names}}' | grep -q "exam-redis"; then
    echo "ℹ️  Redis container is already running"
    echo "📊 Redis status:"
    docker exec exam-redis redis-cli ping
else
    echo "🐳 Starting Redis container..."
    docker-compose -f docker-compose.redis.yml up -d
    
    # Wait for Redis to be ready
    echo "⏳ Waiting for Redis to be ready..."
    sleep 3
    
    # Check Redis health
    for i in {1..10}; do
        if docker exec exam-redis redis-cli ping > /dev/null 2>&1; then
            echo "✅ Redis is ready!"
            break
        else
            echo "⏳ Still waiting for Redis... (attempt $i/10)"
            sleep 2
        fi
    done
fi

echo ""
echo "📋 Redis Connection Info:"
echo "   Host: localhost"
echo "   Port: 6379"
echo "   URL: redis://localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: docker logs exam-redis"
echo "   Stop Redis: docker-compose -f docker-compose.redis.yml down"
echo "   Redis CLI: docker exec -it exam-redis redis-cli"
echo ""
echo "🎯 Redis is ready for your exam system!" 