#!/bin/bash

# Backup Script für Bekleidungsverwaltung
# Führt täglich automatische Backups durch (Datenbank + Uploads + Logs)

set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/app/backups"
DB_PATH="/app/data/bekleidung.db"
UPLOADS_DIR="/app/uploads"
LOGS_DIR="/app/logs"
RETENTION_DAYS=30

echo "Starting backup at $(date)"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# 1. Backup database
echo "Backing up database..."
BACKUP_FILE="$BACKUP_DIR/bekleidung_$DATE.db"
sqlite3 "$DB_PATH" ".backup $BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Database backup created: $BACKUP_FILE"
    
    # Optimize backup
    sqlite3 "$BACKUP_FILE" "VACUUM;"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Database backup size: $SIZE"
else
    echo "Error: Database backup failed"
    exit 1
fi

# 2. Backup uploads (clothing images + company logo + protocols)
if [ -d "$UPLOADS_DIR" ]; then
    echo "Backing up uploads directory..."
    UPLOADS_BACKUP="$BACKUP_DIR/uploads_$DATE.tar.gz"
    # Include all subdirectories with proper structure
    tar -czf "$UPLOADS_BACKUP" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)" 2>/dev/null || {
        # Fallback: at least backup the content
        tar -czf "$UPLOADS_BACKUP" -C "$UPLOADS_DIR" . 2>/dev/null || true
    }
    
    if [ -f "$UPLOADS_BACKUP" ]; then
        SIZE=$(du -h "$UPLOADS_BACKUP" | cut -f1)
        echo "Uploads backup created: $SIZE"
    else
        echo "Warning: Uploads backup creation failed"
    fi
else
    echo "Warning: Uploads directory not found at $UPLOADS_DIR"
fi

# 3. Backup logs
if [ -d "$LOGS_DIR" ] && [ "$(ls -A $LOGS_DIR)" ]; then
    echo "Backing up logs directory..."
    LOGS_BACKUP="$BACKUP_DIR/logs_$DATE.tar.gz"
    tar -czf "$LOGS_BACKUP" -C "$LOGS_DIR" . 2>/dev/null || true
    
    if [ -f "$LOGS_BACKUP" ]; then
        SIZE=$(du -h "$LOGS_BACKUP" | cut -f1)
        echo "Logs backup created: $SIZE"
    fi
else
    echo "Info: No logs to backup"
fi

# 4. Delete old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -maxdepth 1 -type f -mtime +$RETENTION_DAYS -delete

# Count remaining backups
DB_BACKUP_COUNT=$(find "$BACKUP_DIR" -name "bekleidung_*.db" | wc -l)
UPLOADS_BACKUP_COUNT=$(find "$BACKUP_DIR" -name "uploads_*.tar.gz" | wc -l)

echo "Database backups: $DB_BACKUP_COUNT"
echo "Uploads backups: $UPLOADS_BACKUP_COUNT"
echo "Backup completed successfully at $(date)"
