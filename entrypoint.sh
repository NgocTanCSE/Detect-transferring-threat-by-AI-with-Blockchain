#!/bin/bash

# Exit on error
set -e

echo "Starting entrypoint script..."

# Wait for DB if needed (optional, handled by app usually)
# If DATABASE_URL is set, attempt to run migrations
if [ -n "$DATABASE_URL" ]; then
    echo "DATABASE_URL is set. Attempting migrations..."
    cd /app/backend
    python migrate.py || echo "Migration failed (DB might not be ready yet), continuing..."
    
    cd /app/backend
    python migrate.py || echo "Migration failed (DB might not be ready yet), continuing..."
    cd /app
    cd /app
else
    echo "DATABASE_URL is not set. Skipping migrations."
fi

echo "Starting Supervisor..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
