#!/bin/bash

# Exit on error
set -e

echo "Starting entrypoint script..."

# Ensure local backend package imports (app.*) resolve first.
export PYTHONPATH="/app/backend:${PYTHONPATH}"

# Ensure /data directory exists for persistent storage
mkdir -p /data

# Force DATABASE_URL to persistent storage on HF Spaces
if [ -n "$SPACE_ID" ]; then
    echo "Detected HF Spaces environment (SPACE_ID=$SPACE_ID)"
    export DATABASE_URL="sqlite:////data/blockchain_local.db"
    echo "DATABASE_URL set to: $DATABASE_URL"

    # Optional one-shot DB reset for persistent HF storage.
    # Set RESET_DB=1 in Space variables, restart once, then unset it.
    if [ "$RESET_DB" = "1" ]; then
        echo "RESET_DB=1 detected. Removing persistent database at /data/blockchain_local.db"
        rm -f /data/blockchain_local.db
    fi

    # Run migration to move old data to /data if it exists elsewhere
    echo "Running persistent storage migration..."
    cd /app/backend
    python migrate_persistent_storage.py || echo "Migration completed (no old data found)"
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
    python seed_wallets.py || echo "Local demo seed failed, continuing..."
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf

