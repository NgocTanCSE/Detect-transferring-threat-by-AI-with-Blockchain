import psycopg2
import os

DB_CONFIGS = {
    'main': os.getenv("DATABASE_URL_MAIN", "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main"),
    'alerts': os.getenv("DATABASE_URL_ALERTS", "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts"),
    'transfers': os.getenv("DATABASE_URL_TRANSFERS", "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers")
}

def split_sql_statements(sql_content):
    # Split by semicolon, but handle function blocks ($$)
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

def run_migration():
    init_path = 'database/init.sql'
    seed_path = 'database/seed_demo_data.sql'
    
    print("Reading SQL files...")
    with open(init_path, 'r', encoding='utf-8') as f:
        init_sql = f.read()
    with open(seed_path, 'r', encoding='utf-8') as f:
        seed_sql = f.read()

    # Pre-migration cleanup: Remove problematic SQL parts
    # PostgreSQL doesn't like VACUUM inside transactions
    init_sql = re.sub(r'VACUUM ANALYZE.*;', '', init_sql, flags=re.IGNORECASE)
    
    connections = {}
    for name, url in DB_CONFIGS.items():
        try:
            connections[name] = psycopg2.connect(url)
            print(f"Connected to {name} DB.")
            # Enable UUID
            with connections[name].cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
                connections[name].commit()
        except Exception as e:
            print(f"Failed to connect to {name} DB: {e}")

    # Run init.sql on ALL databases
    print("Initializing schemas on all databases...")
    init_stmts = split_sql_statements(init_sql)
    for name, conn in connections.items():
        print(f"  -> Initializing {name}...")
        for stmt in init_stmts:
            if not stmt.strip(): continue
            try:
                with conn.cursor() as cur:
                    cur.execute(stmt)
            except Exception as e:
                conn.rollback()
                # Suppress "already exists" errors
                if "already exists" not in str(e).lower():
                    print(f"    [Error in {name}] {str(e).splitlines()[0]}")
        conn.commit()

    # Run seed.sql on ALL databases
    print("Seeding data on all databases...")
    seed_sql = seed_sql.replace('BEGIN;', '').replace('COMMIT;', '')
    seed_stmts = split_sql_statements(seed_sql)
    for name, conn in connections.items():
        print(f"  -> Seeding {name}...")
        for stmt in seed_stmts:
            if not stmt.strip(): continue
            try:
                with conn.cursor() as cur:
                    cur.execute(stmt)
            except Exception as e:
                conn.rollback()
                if "already exists" not in str(e).lower() and "does not exist" not in str(e).lower():
                    print(f"    [Error in {name}] {str(e).splitlines()[0]}")
        conn.commit()

    # Special case: Create policy_rules in main DB for compliance service
    print("Ensuring policy_rules exist in Main DB...")
    policy_sql = """
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
    INSERT INTO policy_rules (rule_name, description, min_risk_score, block_blacklisted, block_suspended, priority)
    VALUES ('Default Security Policy', 'Standard blockchain threat prevention', 85.00, true, true, 1)
    ON CONFLICT (rule_name) DO NOTHING;
    """
    if 'main' in connections:
        with connections['main'].cursor() as cur:
            cur.execute(policy_sql)
            connections['main'].commit()

    for conn in connections.values():
        conn.close()

    print("DONE: Robust migration complete!")

import re
if __name__ == "__main__":
    run_migration()
