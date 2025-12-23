"""
Migration script to add missing columns to existing database
Run this inside the backend container or connect to database directly
"""

import psycopg2
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/blockchain_db")

def run_migration():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        print("🔄 Starting migration...")

        # Add account_status column
        print("Adding account_status column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'wallets' AND column_name = 'account_status'
                ) THEN
                    ALTER TABLE wallets
                    ADD COLUMN account_status VARCHAR(20) DEFAULT 'active'
                    CHECK (account_status IN ('active', 'suspended', 'frozen', 'under_review'));

                    CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets (account_status);
                END IF;
            END $$;
        """)

        # Add risk_category column
        print("Adding risk_category column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'wallets' AND column_name = 'risk_category'
                ) THEN
                    ALTER TABLE wallets
                    ADD COLUMN risk_category VARCHAR(50);

                    CREATE INDEX IF NOT EXISTS idx_wallets_risk_category ON wallets (risk_category);
                END IF;
            END $$;
        """)

        # Add flagged_at column
        print("Adding flagged_at column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'wallets' AND column_name = 'flagged_at'
                ) THEN
                    ALTER TABLE wallets
                    ADD COLUMN flagged_at TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
        """)

        # Add flagged_by column
        print("Adding flagged_by column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'wallets' AND column_name = 'flagged_by'
                ) THEN
                    ALTER TABLE wallets
                    ADD COLUMN flagged_by VARCHAR(255);
                END IF;
            END $$;
        """)

        # Add notes column
        print("Adding notes column...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'wallets' AND column_name = 'notes'
                ) THEN
                    ALTER TABLE wallets
                    ADD COLUMN notes TEXT;
                END IF;
            END $$;
        """)

        conn.commit()
        print("✅ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
