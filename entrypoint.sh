#!/bin/bash

# Exit on error
set -e

echo "Starting entrypoint script..."

# Ensure local backend package imports (app.*) resolve first.
export PYTHONPATH="/app/backend:${PYTHONPATH}"

# Ensure /data directory exists for persistent storage
mkdir -p /data

# Resolve database mode on HF Spaces:
# - If DATABASE_URL points to Postgres, keep it (Supabase/remote mode)
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
        echo "Running persistent storage migration..."
        cd /app/backend
        python migrate_persistent_storage.py || echo "Migration completed (no old data found)"
    fi
else
    echo "Not on HF Spaces, using default database configuration"
fi

# If DATABASE_URL points to Postgres, attempt remote bootstrap and migrations.
if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
    echo "Using PostgreSQL. Attempting database bootstrap..."
    cd /app/backend
    python bootstrap_supabase.py || echo "Bootstrap failed (DB might not be ready yet), continuing..."
    echo "Attempting migrations..."
    python migrate.py || echo "Migration failed (DB might not be ready yet), continuing..."
else
    echo "Using local SQLite database at /data/blockchain_local.db. Attempting seed..."
    cd /app/backend
    if ! python seed_wallets.py; then
        echo "Seed failed. Performing hard SQLite cleanup and retry once..."
        rm -f /data/blockchain_local.db
        rm -f /data/blockchain_local.db-wal
        rm -f /data/blockchain_local.db-shm
        rm -f /data/blockchain_local.db-journal

        if ! python seed_wallets.py; then
            echo "Seed failed after retry. Exiting to avoid running with broken database."
            exit 1
        fi
    fi
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

