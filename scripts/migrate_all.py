import psycopg2
import os
import re

DB_CONFIGS = {
    'main': os.getenv("DATABASE_URL_MAIN", "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"),
    'alerts': os.getenv("DATABASE_URL_ALERTS", "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts"),
    'transfers': os.getenv("DATABASE_URL_TRANSFERS", "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers")
}

TABLE_MAPPING = {
    'users': 'main',
    'wallets': 'main',
    'blocked_transfers': 'main',
    'risk_assessments': 'main',
    'blacklist': 'main',
    'audit_logs': 'main',
    'user_warnings': 'main',
    'policy_rules': 'main',
    'alerts': 'alerts',
    'transactions': 'transfers',
    'token_transfers': 'transfers'
}

def split_sql_statements(sql_content):
    # Basic split by semicolon, but careful with functions/triggers
    statements = []
    current = []
    in_function = False
    
    for line in sql_content.split('\n'):
        current.append(line)
        if '$$' in line:
            in_function = not in_function
        if not in_function and ';' in line:
            statements.append('\n'.join(current))
            current = []
    return statements

def get_target_db(statement):
    statement_lower = statement.lower()
    for table, db in TABLE_MAPPING.items():
        if f' {table} ' in statement_lower or f' {table}(' in statement_lower or f'into {table}' in statement_lower or f'from {table}' in statement_lower:
            return db
    return 'main' # Default to main if unknown

def run_migration():
    init_path = 'database/init.sql'
    seed_path = 'database/seed_demo_data.sql'
    
    print("Reading SQL files...")
    with open(init_path, 'r', encoding='utf-8') as f:
        init_sql = f.read()
    with open(seed_path, 'r', encoding='utf-8') as f:
        seed_sql = f.read()

    # We also need to create policy_rules table since it's missing in init.sql
    policy_table_sql = """
    CREATE TABLE IF NOT EXISTS policy_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        rule_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        min_risk_score NUMERIC(5, 2) DEFAULT 80.00,
        block_blacklisted BOOLEAN DEFAULT true,
        block_suspended BOOLEAN DEFAULT true,
        notify_on_block BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """

    connections = {}
    for name, url in DB_CONFIGS.items():
        try:
            connections[name] = psycopg2.connect(url)
            print(f"Connected to {name} DB.")
            # Ensure UUID extension is installed
            with connections[name].cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
                connections[name].commit()
        except Exception as e:
            print(f"Failed to connect to {name} DB: {e}")

    # 1. Run Schema
    print("Running Schema Migration...")
    
    # Optional: Drop tables to ensure clean schema alignment
    tables_to_drop = list(TABLE_MAPPING.keys())
    for target_db in ['main', 'alerts', 'transfers']:
        if target_db in connections:
            with connections[target_db].cursor() as cur:
                for table in tables_to_drop:
                    if TABLE_MAPPING[table] == target_db:
                        cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
            connections[target_db].commit()

    for stmt in split_sql_statements(init_sql):
        target = get_target_db(stmt)
        if target in connections:
            try:
                with connections[target].cursor() as cur:
                    cur.execute(stmt)
            except Exception as e:
                connections[target].rollback()
                print(f"Error in {target} schema stmt: {e}")

    # Run policy_rules schema in main
    if 'main' in connections:
        with connections['main'].cursor() as cur:
            cur.execute(policy_table_sql)

    # 2. Run Seed
    print("Running Seed Migration...")
    # Seed files use BEGIN/COMMIT, we should remove them to handle manually
    seed_sql = seed_sql.replace('BEGIN;', '').replace('COMMIT;', '')
    for stmt in split_sql_statements(seed_sql):
        if not stmt.strip(): continue
        target = get_target_db(stmt)
        if target in connections:
            try:
                with connections[target].cursor() as cur:
                    cur.execute(stmt)
            except Exception as e:
                connections[target].rollback()
                print(f"Error in {target} seed stmt: {e}")

    for conn in connections.values():
        conn.commit()
        conn.close()

    print("DONE: Migration and Seeding complete!")

if __name__ == "__main__":
    run_migration()
