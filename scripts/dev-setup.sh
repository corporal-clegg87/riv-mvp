#!/bin/bash

# Development Environment Setup Script
# This script sets up the local development environment for RIV MVP

set -e

echo '🚀 Setting up RIV MVP development environment...'

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo '❌ Docker is not running. Please start Docker and try again.'
    exit 1
fi

# Check if docker compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo '❌ docker compose is not available. Please ensure Docker Compose V2 is installed.'
    exit 1
fi

echo '📦 Starting development services...'

# Start development services
docker compose -f docker-compose.dev.yml up -d

echo '⏳ Waiting for services to be ready...'

# Wait for Redis to be ready
echo 'Checking Redis connection...'
if ! timeout 30 bash -c 'until docker exec riv-dev-redis redis-cli ping > /dev/null 2>&1; do sleep 1; done'; then
    echo '❌ Redis failed to start or is not responding. Check logs with: docker logs riv-dev-redis'
    exit 1
fi
echo '✅ Redis is ready'

# Wait for MailHog to be ready
echo 'Checking MailHog connection...'
if ! timeout 30 bash -c 'until curl -s http://localhost:8025 > /dev/null 2>&1; do sleep 1; done'; then
    echo '❌ MailHog failed to start or is not responding. Check logs with: docker logs riv-dev-mailhog'
    exit 1
fi
echo '✅ MailHog is ready'

echo '✅ Development services are ready!'
echo ''
echo '📋 Service URLs:'
echo '  Redis: localhost:6379'
echo '  MailHog SMTP: localhost:1025'
echo '  MailHog Web UI: http://localhost:8025'
echo ''
echo '🔧 Next steps:'
echo '  1. Copy .env.local.example to .env.local'
echo '  2. Fill in your environment variables'
echo '  3. Run: npm run dev'
echo ''
echo '🛑 To stop services: docker compose -f docker-compose.dev.yml down'
