#!/bin/bash

# Image Validation & Repair Script
# Überprüft und repariert imageUrl-Einträge nach einem Restore

set -e

UPLOADS_DIR="/app/uploads"
DATA_DIR="/app/data"
DB_PATH="$DATA_DIR/bekleidung.db"

echo "=========================================="
echo "Image Validation & Repair Tool"
echo "=========================================="
echo ""

if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Check if uploads directory exists
if [ ! -d "$UPLOADS_DIR" ]; then
    echo "Error: Uploads directory not found at $UPLOADS_DIR"
    exit 1
fi

echo "Database: $DB_PATH"
echo "Uploads: $UPLOADS_DIR"
echo ""

# Function to check if file exists
check_file() {
    local filepath=$1
    # Remove leading slash for local path check
    local localpath="${filepath#/}"
    
    if [ -f "$UPLOADS_DIR/$localpath" ]; then
        return 0
    else
        return 1
    fi
}

echo "1. Finding all clothing types with imageUrl..."
CLOTHING_TYPES=$(sqlite3 "$DB_PATH" "SELECT id, name, imageUrl FROM clothing_types WHERE imageUrl IS NOT NULL AND imageUrl != '';")

if [ -z "$CLOTHING_TYPES" ]; then
    echo "   No clothing types with images found."
    exit 0
fi

MISSING_COUNT=0
FOUND_COUNT=0

echo "$CLOTHING_TYPES" | while IFS='|' read -r id name imageUrl; do
    if check_file "$imageUrl"; then
        echo "   ✓ $name - $(basename $imageUrl)"
        ((FOUND_COUNT++))
    else
        echo "   ✗ MISSING: $name - $imageUrl"
        ((MISSING_COUNT++))
    fi
done

echo ""
echo "2. Checking uploads directory structure..."
echo ""

# List all image files that exist
echo "Files in uploads directory:"
find "$UPLOADS_DIR" -type f 2>/dev/null | while read file; do
    rel_path="${file#$UPLOADS_DIR/}"
    echo "   - $rel_path"
done

echo ""
echo "3. Finding orphaned images (in filesystem but not in DB)..."

DB_IMAGES=$(sqlite3 "$DB_PATH" "SELECT imageUrl FROM clothing_types WHERE imageUrl IS NOT NULL UNION SELECT imageUrl FROM clothing_items WHERE imageUrl IS NOT NULL;")

find "$UPLOADS_DIR" -type f 2>/dev/null | while read file; do
    rel_path="/${file#$UPLOADS_DIR/}"
    
    # Check if this file is referenced in DB
    if echo "$DB_IMAGES" | grep -q "$(basename $file)"; then
        true
    else
        echo "   Orphaned: $rel_path"
    fi
done

echo ""
echo "4. Rebuilding directory structure if needed..."

mkdir -p "$UPLOADS_DIR/clothing-images"
mkdir -p "$UPLOADS_DIR/protocols"

# If images are in root of uploads, move them to clothing-images
if [ -f "$UPLOADS_DIR"/*.jpg ] || [ -f "$UPLOADS_DIR"/*.png ] || [ -f "$UPLOADS_DIR"/*.jpeg ] 2>/dev/null; then
    echo "   Found images in root uploads/, moving to clothing-images/..."
    find "$UPLOADS_DIR" -maxdepth 1 -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" \) -exec mv {} "$UPLOADS_DIR/clothing-images/" \; 2>/dev/null || true
    echo "   Done."
fi

echo ""
echo "=========================================="
echo "Validation Complete"
echo "=========================================="
echo ""
echo "If images are still missing after restore:"
echo "1. Check if backup archive contains images:"
echo "   tar -tzf /app/backups/uploads_*.tar.gz | head -20"
echo ""
echo "2. Manually restore from backup:"
echo "   tar -xzf /app/backups/uploads_YYYYMMDD_HHMMSS.tar.gz -C /app/uploads"
echo ""
echo "3. Restart backend:"
echo "   docker-compose restart backend"

