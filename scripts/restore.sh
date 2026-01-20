#!/bin/bash

# Restore Script für Bekleidungsverwaltung
# Stellt ein Backup wieder her (Datenbank + Uploads + Logs)

set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup-date>"
    echo "       Example: ./restore.sh 20240113_153045"
    echo ""
    echo "Available backups:"
    echo "Database backups:"
    ls -lh /app/backups/bekleidung_*.db 2>/dev/null || echo "  No database backups found"
    echo ""
    echo "Uploads backups:"
    ls -lh /app/backups/uploads_*.tar.gz 2>/dev/null || echo "  No uploads backups found"
    exit 1
fi

BACKUP_DATE="$1"
DB_BACKUP="/app/backups/bekleidung_${BACKUP_DATE}.db"
UPLOADS_BACKUP="/app/backups/uploads_${BACKUP_DATE}.tar.gz"
DB_PATH="/app/data/bekleidung.db"
UPLOADS_DIR="/app/uploads"

echo "========================================"
echo "Starting restore for backup: $BACKUP_DATE"
echo "========================================"

# Check if database backup exists
if [ ! -f "$DB_BACKUP" ]; then
    echo "Error: Database backup file not found: $DB_BACKUP"
    exit 1
fi

# Create backup of current database
if [ -f "$DB_PATH" ]; then
    CURRENT_BACKUP="/app/backups/pre_restore_$(date +%Y%m%d_%H%M%S).db"
    echo "Creating safety backup of current database..."
    cp "$DB_PATH" "$CURRENT_BACKUP"
    echo "Safety backup created: $CURRENT_BACKUP"
fi

# Restore database
echo ""
echo "Restoring database..."
cp "$DB_BACKUP" "$DB_PATH"

if [ $? -eq 0 ]; then
    echo "Database restored successfully"
else
    echo "Error: Database restore failed"
    if [ -f "$CURRENT_BACKUP" ]; then
        echo "Restoring previous database..."
        cp "$CURRENT_BACKUP" "$DB_PATH"
    fi
    exit 1
fi

# Restore uploads if backup exists
if [ -f "$UPLOADS_BACKUP" ]; then
    echo ""
    echo "Restoring uploads directory..."
    
    # Create safety backup of current uploads
    if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR)" ]; then
        UPLOADS_SAFETY="/app/backups/uploads_pre_restore_$(date +%Y%m%d_%H%M%S).tar.gz"
        tar -czf "$UPLOADS_SAFETY" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)" 2>/dev/null || true
        echo "Safety backup of uploads created: $UPLOADS_SAFETY"
    fi
    
    # Remove existing uploads to avoid conflicts
    if [ -d "$UPLOADS_DIR" ]; then
        rm -rf "$UPLOADS_DIR"/*
    fi
    
    # Create uploads directory if it doesn't exist
    mkdir -p "$UPLOADS_DIR"
    
    # Extract uploads - handle both tar with directory and tar without
    tar -tzf "$UPLOADS_BACKUP" | head -1 | grep -q "^uploads/" && {
        # Archive contains "uploads/" prefix
        tar -xzf "$UPLOADS_BACKUP" -C "$(dirname $UPLOADS_DIR)" 2>/dev/null || true
    } || {
        # Archive contains only files, extract to uploads dir
        tar -xzf "$UPLOADS_BACKUP" -C "$UPLOADS_DIR" 2>/dev/null || true
    }
    
    echo "Uploads restored successfully"
    
    # List restored files
    echo "Restored uploads structure:"
    find "$UPLOADS_DIR" -type f | head -20
else
    echo ""
    echo "Warning: Uploads backup file not found: $UPLOADS_BACKUP"
    echo "Skipping uploads restore"
fi

echo ""
echo "========================================"
echo "Restore completed successfully at $(date)"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Restart the backend container:"
echo "   docker-compose restart backend"
echo ""
echo "2. Verify the restore:"
echo "   docker-compose logs -f backend"
