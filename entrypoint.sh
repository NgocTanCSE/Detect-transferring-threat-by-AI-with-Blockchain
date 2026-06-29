#!/bin/bash
set -x

echo "=============================="
echo "STEP 1: Environment"
echo "=============================="
echo "PWD=$(pwd)"
echo "DATABASE_URL=$DATABASE_URL"
echo "SPACE_ID=$SPACE_ID"
echo "PATH=$PATH"
echo "node=$(which node 2>&1 || echo 'NOT FOUND')"
echo "python=$(which python 2>&1)"
echo "pip=$(pip list 2>/dev/null | head -5)"

echo "=============================="
echo "STEP 2: Database seed"
echo "=============================="
export PYTHONPATH="/app/backend"
export PYTHONUNBUFFERED="1"

cd /app/backend

if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="sqlite:////data/blockchain_local.db"
fi
echo "DATABASE_URL=$DATABASE_URL"

# Check for corrupted database and repair
DB_FILE="/data/blockchain_local.db"
if [ -f "$DB_FILE" ]; then
    INTEGRITY=$(python -c "
import sqlite3
try:
    conn = sqlite3.connect('$DB_FILE')
    result = conn.execute('PRAGMA integrity_check').fetchone()
    conn.close()
    print(result[0])
except Exception as e:
    print(f'ERROR: {e}')
" 2>&1)
    echo "DB integrity: $INTEGRITY"
    
    if [ "$INTEGRITY" != "ok" ]; then
        echo "Database corrupted! Attempting repair..."
        python -c "
import sqlite3, shutil, os
db_path = '$DB_FILE'
backup_path = db_path + '.backup'
try:
    conn = sqlite3.connect(db_path)
    conn.backup(sqlite3.connect(backup_path))
    conn.close()
    os.remove(db_path)
    conn2 = sqlite3.connect(backup_path)
    conn2.execute('VACUUM')
    shutil.copy2(backup_path, db_path)
    conn2.close()
    os.remove(backup_path)
    print('Repair completed')
except Exception as e:
    print(f'Repair failed: {e}')
    print('Resetting database...')
    os.remove(db_path)
" 2>&1
    fi
fi

# Handle RESET_DB
if [ "$RESET_DB" = "1" ]; then
    echo "RESET_DB=1 detected. Removing database..."
    rm -f /data/blockchain_local.db /data/blockchain_local.db-wal /data/blockchain_local.db-shm
fi

python seed_wallets.py 2>&1 || echo "SEED FAILED (continuing anyway)"
python seed_demo_wallets.py 2>&1 || echo "DEMO WALLETS SEED FAILED"
python seed_demo_transactions.py 2>&1 || echo "DEMO TRANSACTIONS SEED FAILED"
python seed_model_registry.py 2>&1 || echo "MODEL REGISTRY SEED FAILED"
python seed_feature_store.py 2>&1 || echo "FEATURE STORE SEED FAILED"
python seed_system_admin_data.py 2>&1 || echo "SYSTEM ADMIN SEED FAILED"
python seed_security_data.py 2>&1 || echo "SECURITY DATA SEED FAILED"
python seed_compliance_data.py 2>&1 || echo "COMPLIANCE DATA SEED FAILED"

echo "=============================="
echo "STEP 3: Test backend import"
echo "=============================="
python -c "
import traceback
try:
    from app.main import app
    print('IMPORT SUCCESS')
except Exception as e:
    print('IMPORT FAILED:')
    traceback.print_exc()
" 2>&1

echo "=============================="
echo "STEP 4: Start backend"
echo "=============================="
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 2>&1 &
BPID=$!
echo "Backend PID=$BPID"

echo "=============================="
echo "STEP 5: Wait for backend"
echo "=============================="
READY=0
for i in $(seq 1 40); do
    if curl -sf http://127.0.0.1:8000/ > /dev/null 2>&1; then
        echo "Backend ready after ${i}s"
        READY=1
        break
    fi
    sleep 1
done

if [ "$READY" -eq 0 ]; then
    echo "BACKEND FAILED TO START after 40s"
    echo "Checking if process still alive..."
    kill -0 $BPID 2>/dev/null && echo "Process $BPID alive" || echo "Process $BPID DEAD"
    wait $BPID 2>/dev/null
    echo "Backend exit code: $?"
fi

echo "=============================="
echo "STEP 6: Start frontend"
echo "=============================="
cd /app/frontend
ls server.js 2>&1 || echo "server.js NOT FOUND"
ls node_modules 2>&1 | head -3 || echo "node_modules NOT FOUND"

HOSTNAME=0.0.0.0 PORT=7860 BACKEND_URL=http://127.0.0.1:8000 NODE_ENV=production node server.js 2>&1 &
FPID=$!
echo "Frontend PID=$FPID"

echo "=============================="
echo "STEP 7: Start scanner"
echo "=============================="
cd /app/backend
python scanner.py 2>&1 &
SPID=$!
echo "Scanner PID=$SPID"

echo "=============================="
echo "STEP 8: Start demo traffic"
echo "=============================="
cd /app/backend
python demo-scripts/sim_generate_traffic.py 2>&1 &
DTPID=$!
echo "Demo Traffic PID=$DTPID"

echo "=============================="
echo "ALL STARTED: backend=$BPID frontend=$FPID scanner=$SPID demo-traffic=$DTPID"
echo "=============================="

trap "kill $BPID $FPID $SPID $DTPID 2>/dev/null; exit 0" SIGTERM SIGINT
wait
