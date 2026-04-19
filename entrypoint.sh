#!/bin/bash

# Exit on error
set -e

echo "Starting entrypoint script..."

# Ensure local backend package imports (app.*) resolve first.
export PYTHONPATH="/app/backend:${PYTHONPATH}"

# If DATABASE_URL points to Postgres, attempt remote bootstrap and migrations.
if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" == postgres://* || "$DATABASE_URL" == postgresql://* ]]; then
    echo "DATABASE_URL is set. Attempting database bootstrap..."
    cd /app/backend
    python bootstrap_supabase.py || echo "Bootstrap failed (DB might not be ready yet), continuing..."
    echo "Attempting migrations..."
    python migrate.py || echo "Migration failed (DB might not be ready yet), continuing..."
else
    echo "Using local database mode. Attempting local demo seed..."
    cd /app/backend
    python seed_wallets.py || echo "Local demo seed failed, continuing..."
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
