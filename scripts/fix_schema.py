import psycopg2
import os

DB_CONFIGS = {
    'main': "postgresql://blockchain:blockchain123@localhost:5432/blockchain_main",
    'alerts': "postgresql://blockchain:blockchain123@localhost:5433/blockchain_alerts",
    'transfers': "postgresql://blockchain:blockchain123@localhost:5434/blockchain_transfers"
}

def fix_alerts():
    print("Fixing alerts schema...")
    conn = psycopg2.connect(DB_CONFIGS['alerts'])
    cur = conn.cursor()
    try:
        # Check if chain_id exists, if not add it
        cur.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';")
        # Check if meta exists, if not add it
        cur.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS meta JSONB;")
        # Check if metadata exists (legacy), if not add it
        cur.execute("ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB;")
        # Ensure ID is BIGINT if alert-service expects it (it seems it does from previous \d)
        # Actually, let's keep it as UUID if possible, but alert-service might fail.
        # Let's check alert-service src/index.js for how it inserts.
        conn.commit()
    except Exception as e:
        print(f"Error fixing alerts: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def fix_main():
    print("Fixing main schema...")
    conn = psycopg2.connect(DB_CONFIGS['main'])
    cur = conn.cursor()
    try:
        cur.execute("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';")
        conn.commit()
    except Exception as e:
        print(f"Error fixing main: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    fix_alerts()
    fix_main()
    print("DONE: Schema fixes applied.")
