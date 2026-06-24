#!/bin/bash
cd /app/backend
export PYTHONPATH="/app/backend"
export PYTHONUNBUFFERED="1"

echo "=========================================="
echo "BACKEND STARTUP DEBUG"
echo "=========================================="
echo "Time: $(date)"
echo "PWD: $(pwd)"
echo "DATABASE_URL: ${DATABASE_URL:-NOT SET}"
echo "SPACE_ID: ${SPACE_ID:-NOT SET}"
echo "Python: $(python --version 2>&1)"
echo "Uvicorn: $(python -c 'import uvicorn; print(uvicorn.__version__)' 2>&1)"
echo "=========================================="
echo "Testing imports..."
python -c "
try:
    from app.main import app
    print('app.main import: OK')
except Exception as e:
    print(f'app.main import FAILED: {e}')
    import traceback
    traceback.print_exc()
" 2>&1
echo "=========================================="
echo "Starting uvicorn..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level debug 2>&1
echo "=========================================="
echo "Uvicorn exited with code: $?"
