#!/bin/bash

# Health Check Script
# Prüft ob alle Services laufen

set -e

echo "================================"
echo "Bekleidungsverwaltung Health Check"
echo "================================"
echo ""

# Check Docker
echo "1. Checking Docker..."
if command -v docker &> /dev/null; then
    echo "   ✓ Docker installed"
else
    echo "   ✗ Docker not found"
    exit 1
fi

# Check Docker Compose
echo "2. Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    echo "   ✓ Docker Compose installed"
else
    echo "   ✗ Docker Compose not found"
    exit 1
fi

# Check if containers are running
echo "3. Checking containers..."
BACKEND_STATUS=$(docker-compose ps -q backend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not running")
FRONTEND_STATUS=$(docker-compose ps -q frontend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not running")

if [ "$BACKEND_STATUS" = "running" ]; then
    echo "   ✓ Backend running"
else
    echo "   ✗ Backend not running (Status: $BACKEND_STATUS)"
fi

if [ "$FRONTEND_STATUS" = "running" ]; then
    echo "   ✓ Frontend running"
else
    echo "   ✗ Frontend not running (Status: $FRONTEND_STATUS)"
fi

# Check API Health
echo "4. Checking API..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✓ API healthy (HTTP $HTTP_STATUS)"
else
    echo "   ✗ API not responding (HTTP $HTTP_STATUS)"
fi

# Check Frontend
echo "5. Checking Frontend..."
FRONTEND_HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")

if [ "$FRONTEND_HTTP" = "200" ]; then
    echo "   ✓ Frontend accessible (HTTP $FRONTEND_HTTP)"
else
    echo "   ✗ Frontend not accessible (HTTP $FRONTEND_HTTP)"
fi

# Check Database
echo "6. Checking Database..."
if [ -f "./data/bekleidung.db" ]; then
    DB_SIZE=$(du -h ./data/bekleidung.db | cut -f1)
    echo "   ✓ Database exists (Size: $DB_SIZE)"
else
    echo "   ✗ Database not found"
fi

# Check Disk Space
echo "7. Checking Disk Space..."
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    echo "   ✓ Disk space OK (${DISK_USAGE}% used)"
else
    echo "   ⚠ Low disk space (${DISK_USAGE}% used)"
fi

# Last Backup
echo "8. Checking Last Backup..."
LAST_BACKUP=$(find ./backups -name "bekleidung_*.db" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -f2- -d" ")
if [ -n "$LAST_BACKUP" ]; then
    BACKUP_DATE=$(date -r "$LAST_BACKUP" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")
    echo "   ✓ Last backup: $BACKUP_DATE"
else
    echo "   ⚠ No backups found"
fi

echo ""
echo "================================"
echo "Health check completed"
echo "================================"
