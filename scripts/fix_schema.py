import psycopg2

DB_URLS = {
    "main": "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main",
    "alerts": "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts",
    "transfers": "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers",
}

def fix_transfers_schema():
    print("Fixing Transactions schema in Transfers DB...")
    conn = psycopg2.connect(DB_URLS["transfers"])
    cur = conn.cursor()
    try:
        # Add missing columns to transactions
        cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS normalized_risk_score NUMERIC(3,2);")
        cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) DEFAULT 'PENDING';")
        cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to UUID;")
        cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();")
        
        # Add risk_category to wallets if missing
        cur.execute("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);")
        
        conn.commit()
        print("Successfully updated Transactions schema.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

def fix_alerts_schema():
    print("Fixing Alerts schema...")
    conn = psycopg2.connect(DB_URLS["alerts"])
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';")
        cur.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB;")
        conn.commit()
        print("Successfully updated Alerts schema.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    fix_transfers_schema()
    fix_alerts_schema()
