#!/bin/bash
cd /app/backend
export PYTHONPATH="/app/backend"
export PYTHONUNBUFFERED="1"

echo "=== Backend Debug Info ==="
echo "DATABASE_URL: $DATABASE_URL"
echo "SPACE_ID: $SPACE_ID"
echo "PYTHONPATH: $PYTHONPATH"
echo "Python: $(python --version)"
echo "Uvicorn: $(python -c 'import uvicorn; print(uvicorn.__version__)' 2>&1)"
echo "Working dir: $(pwd)"
echo "Files in /app/backend/app/:"
ls -la /app/backend/app/ 2>&1 | head -20
echo "=== Starting backend ==="

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level debug 2>&1
EXIT_CODE=$?
echo "=== Backend exited with code $EXIT_CODE ==="
exit $EXIT_CODE
