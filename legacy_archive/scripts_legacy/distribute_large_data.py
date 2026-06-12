import psycopg2
import json

import os

# Connection strings
MONOLITH_URL = os.getenv("DATABASE_URL_MAIN", "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main")
MAIN_URL = os.getenv("DATABASE_URL_MAIN", "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main")
ALERTS_URL = os.getenv("DATABASE_URL_ALERTS", "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts")
TRANSFERS_URL = os.getenv("DATABASE_URL_TRANSFERS", "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers")

TABLES_MAIN = [
    'users', 'wallets', 'audit_logs', 'policy_rules', 'model_registry', 
    'feature_store_configs', 'node_endpoints', 'pipeline_metrics', 'notification_events'
]

TABLES_ALERTS = ['alerts']

TABLES_TRANSFERS = [
    'transactions', 'token_transfers', 'blocked_transfers', 
    'user_warnings', 'risk_assessments', 'transaction_cases'
]

def migrate_table(src_conn, dst_conn, table_name):
    print(f"Migrating table: {table_name}...")
    src_cur = src_conn.cursor()
    dst_cur = dst_conn.cursor()
    
    # Check if table exists in source
    src_cur.execute(f"SELECT * FROM {table_name}")
    rows = src_cur.fetchall()
    if not rows:
        print(f"  No data in {table_name}")
        return

    colnames = [desc[0] for desc in src_cur.description]
    
    # Check column compatibility with target
    dst_cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table_name}'")
    dst_cols = {row[0]: row[1] for row in dst_cur.fetchall()}
    
    final_cols = []
    placeholders = []
    
    for col in colnames:
        if col in dst_cols:
            final_cols.append(col)
            # Type casting logic
            if col == 'id' and dst_cols[col] == 'uuid' and any(isinstance(r[colnames.index(col)], int) for r in rows[:10]):
                 # Convert bigint ID to UUID format: 00000000-0000-0000-0000-000000000001
                 placeholders.append("lpad(%s::text, 32, '0')::uuid")
            elif col == 'assigned_to' and dst_cols[col] == 'uuid':
                 placeholders.append("CASE WHEN %s IS NULL THEN NULL ELSE lpad(%s::text, 32, '0')::uuid END")
            else:
                placeholders.append("%s")

    if not final_cols:
        print(f"  No matching columns for {table_name}")
        return

    # Clear target table
    dst_cur.execute(f"TRUNCATE TABLE {table_name} CASCADE;")
    
    # Insert rows
    query = f"INSERT INTO {table_name} ({', '.join(final_cols)}) VALUES ({', '.join(placeholders)})"
    
    for row in rows:
        # Prepare row data (handle multiple %s for CASE)
        final_row = []
        for i, col in enumerate(colnames):
            if col in final_cols:
                val = row[i]
                if col == 'assigned_to' and 'CASE' in placeholders[final_cols.index(col)]:
                    final_row.extend([val, val])
                else:
                    final_row.append(val)
        dst_cur.execute(query, final_row)
    
    dst_conn.commit()
    print(f"  Successfully migrated {len(rows)} rows to {table_name}")

def run_distribution():
    print("Starting data distribution from Monolith to Microservices...")
    
    monolith_conn = psycopg2.connect(MONOLITH_URL)
    main_conn = psycopg2.connect(MAIN_URL)
    alerts_conn = psycopg2.connect(ALERTS_URL)
    transfers_conn = psycopg2.connect(TRANSFERS_URL)
    
    try:
        # Main DB
        for table in TABLES_MAIN:
            try:
                migrate_table(monolith_conn, main_conn, table)
            except Exception as e:
                print(f"  Error migrating {table} to Main: {e}")
                main_conn.rollback()

        # Alerts DB
        for table in TABLES_ALERTS:
            try:
                migrate_table(monolith_conn, alerts_conn, table)
            except Exception as e:
                print(f"  Error migrating {table} to Alerts: {e}")
                alerts_conn.rollback()

        # Transfers DB
        for table in TABLES_TRANSFERS:
            try:
                migrate_table(monolith_conn, transfers_conn, table)
            except Exception as e:
                print(f"  Error migrating {table} to Transfers: {e}")
                transfers_conn.rollback()
                
        print("Data distribution complete!")
        
    finally:
        monolith_conn.close()
        main_conn.close()
        alerts_conn.close()
        transfers_conn.close()

if __name__ == "__main__":
    run_distribution()
