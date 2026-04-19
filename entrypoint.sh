#!/bin/bash

# Exit on error
set -e

echo "Starting entrypoint script..."

# Ensure local backend package imports (app.*) resolve first.
export PYTHONPATH="/app/backend:${PYTHONPATH}"

# If DATABASE_URL is set, attempt to bootstrap and migrate the remote Supabase database.
if [ -n "$DATABASE_URL" ]; then
    echo "DATABASE_URL is set. Attempting database bootstrap..."
    cd /app/backend
    python bootstrap_supabase.py || echo "Bootstrap failed (DB might not be ready yet), continuing..."
    echo "Attempting migrations..."
    python migrate.py || echo "Migration failed (DB might not be ready yet), continuing..."
else
    echo "DATABASE_URL is not set. Skipping bootstrap and migrations."
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
