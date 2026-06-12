"""
Migration script to add missing columns to existing database
Run this inside the backend container or connect to database directly
"""

import psycopg2

from app.core.config import DATABASE_URL


def _table_exists(cur, table_name: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = %s
        LIMIT 1
        """,
        (table_name,)
    )
    return cur.fetchone() is not None

def run_migration():
    if not DATABASE_URL.startswith(("postgresql://", "postgres://")):
        print("ℹ️  Non-Postgres DATABASE_URL detected; skipping migration script.")
        return

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    try:
        print("🔄 Starting migration...")

        if not _table_exists(cur, "wallets"):
            print("⚠️  Table 'wallets' does not exist yet. Skipping legacy wallet column migration.")
            conn.commit()
            return

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
