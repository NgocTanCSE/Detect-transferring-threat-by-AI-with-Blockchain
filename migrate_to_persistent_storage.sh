#!/bin/bash

# Migration script: Move data to persistent /data bucket and clean up old data
# Usage: bash migrate_to_persistent_storage.sh

set -e

echo "=================================================="
echo "Migration: Local Data → Persistent /data Bucket"
echo "=================================================="

# Ensure /data exists
mkdir -p /data
echo "✓ Created /data directory"

# Find old database files
OLD_DB_PATHS=(
    "./blockchain_local.db"
    "/tmp/blockchain_local.db"
    "/app/backend/blockchain_local.db"
)

NEW_DB_PATH="/data/blockchain_local.db"

echo ""
echo "Searching for old database files..."
for path in "${OLD_DB_PATHS[@]}"; do
    if [ -f "$path" ]; then
        echo "✓ Found: $path ($(du -h $path | cut -f1))"

        # Backup first
        BACKUP_PATH="${path}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$path" "$BACKUP_PATH"
        echo "  → Backed up to: $BACKUP_PATH"

        # Move to persistent storage
        if [ "$path" != "$NEW_DB_PATH" ]; then
            mv "$path" "$NEW_DB_PATH"
            echo "  → Moved to: $NEW_DB_PATH"
        fi
    fi
done

echo ""
echo "✓ Migration complete!"
echo "  New database location: $NEW_DB_PATH"
echo "  This location persists across Space restarts."
echo ""
echo "If you want to reset all data, run:"
echo "  rm $NEW_DB_PATH"
echo "  # Then rebuild the Space"
