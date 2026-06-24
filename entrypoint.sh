#!/bin/bash

# Exit on error only for main operations (not for database setup which is best-effort)
set -e

echo "Starting entrypoint script..."

# Ensure local backend package imports (app.*) resolve first.
export PYTHONPATH="/app/backend:${PYTHONPATH}"
export PYTHONUNBUFFERED="1"

# Ensure /data directory exists for persistent storage
mkdir -p /data

# Create database directory for init.sql
mkdir -p /database

# Resolve database mode on HF Spaces:
# - If DATABASE_URL points to Postgres (from .hf/hf_config.json), keep it
# - Otherwise default to persistent SQLite in /data
if [ -n "$SPACE_ID" ]; then
    echo "Detected HF Spaces environment (SPACE_ID=$SPACE_ID)"

    if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
        echo "HF mode: remote PostgreSQL detected from DATABASE_URL"
    else
        if [ -z "$DATABASE_URL" ]; then
            export DATABASE_URL="sqlite:////data/blockchain_local.db"
            echo "HF mode: DATABASE_URL not provided, defaulting to persistent SQLite"
        else
            echo "HF mode: non-Postgres DATABASE_URL detected, using as provided"
        fi

        echo "DATABASE_URL set to: $DATABASE_URL"

        # Optional one-shot DB reset for persistent HF storage.
        # Set RESET_DB=1 in Space variables, restart once, then unset it.
        if [ "$RESET_DB" = "1" ]; then
            echo "RESET_DB=1 detected. Removing persistent SQLite files in /data"
            rm -f /data/blockchain_local.db
            rm -f /data/blockchain_local.db-wal
            rm -f /data/blockchain_local.db-shm
            rm -f /data/blockchain_local.db-journal
        fi

        # Run migration to move old data to /data if it exists elsewhere
        if [ -f "/app/backend/migrate_persistent_storage.py" ]; then
            echo "Running persistent storage migration..."
            cd /app/backend
            python migrate_persistent_storage.py || echo "Migration completed (no old data found)"
        fi
    fi
else
    echo "Not on HF Spaces, using default database configuration"
fi

# Database bootstrap (best-effort, don't fail on error)
cd /app/backend

if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
    echo "Using PostgreSQL. Attempting database bootstrap..."
    python bootstrap_supabase.py --once || echo "Bootstrap failed (DB might not be ready yet), continuing..."
    echo "Running Alembic migrations..."
    alembic -c /app/backend/alembic.ini upgrade head || echo "Alembic migration failed (DB might not be ready yet), continuing..."
    echo "Ensuring future partitions..."
    python -c "from app.services.partition_manager import ensure_future_partitions; from app.core.database import SessionLocal; db = SessionLocal(); print(f'Created {ensure_future_partitions(db)} partitions')" || echo "Partition creation skipped"
else
    echo "Using local SQLite database at $DATABASE_URL. Attempting seed..."
    if ! python seed_wallets.py; then
        echo "Seed failed. Will continue anyway - database may already exist..."
    fi
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

