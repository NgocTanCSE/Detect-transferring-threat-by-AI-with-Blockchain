#!/bin/bash
set -e

echo "=== Blockchain AI Sentinel Startup ==="

export PYTHONPATH="/app/backend"
export PYTHONUNBUFFERED="1"

mkdir -p /data /database /var/log/supervisor

# Database setup
if [ -n "$SPACE_ID" ]; then
    echo "HF Spaces mode detected"
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL="sqlite:////data/blockchain_local.db"
    fi
    if [ "$RESET_DB" = "1" ]; then
        rm -f /data/blockchain_local.db*
    fi
    if [ -f "/app/backend/migrate_persistent_storage.py" ]; then
        cd /app/backend && python migrate_persistent_storage.py 2>/dev/null || true
    fi
fi

cd /app/backend

if [[ "$DATABASE_URL" == postgresql://* ]] || [[ "$DATABASE_URL" == postgres://* ]]; then
    echo "PostgreSQL mode"
    python bootstrap_supabase.py --once 2>/dev/null || echo "Bootstrap skipped"
    python -c "from app.core.database import ensure_schema; ensure_schema()" 2>/dev/null || echo "Schema check skipped"
else
    echo "SQLite mode: $DATABASE_URL"
    python seed_wallets.py 2>/dev/null || echo "Seed skipped"
fi

echo "=== Starting services ==="

# Start backend
cd /app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8000/ > /dev/null 2>&1; then
        echo "Backend is ready"
        break
    fi
    sleep 1
done

# Start frontend
cd /app/frontend
HOSTNAME=0.0.0.0 PORT=7860 BACKEND_URL=http://127.0.0.1:8000 NODE_ENV=production node server.js &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

# Start scanner
cd /app/backend
python scanner.py &
SCANNER_PID=$!
echo "Scanner started (PID: $SCANNER_PID)"

echo "=== All services started ==="
echo "Backend: http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:7860"

# Trap signals for graceful shutdown
trap "kill $BACKEND_PID $FRONTEND_PID $SCANNER_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for any process to exit
wait -n $BACKEND_PID $FRONTEND_PID $SCANNER_PID
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE, shutting down..."
kill $BACKEND_PID $FRONTEND_PID $SCANNER_PID 2>/dev/null
exit $EXIT_CODE
