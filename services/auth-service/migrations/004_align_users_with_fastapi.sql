/*
  Migration 004: Align users/wallets tables with FastAPI SQLAlchemy models.
  Fixes inconsistencies between Node-initiated schemas and FastAPI models.
  Safe to re-run (uses IF NOT EXISTS / IF EXISTS checks).
*/

-- ============================================================
-- 1. Fix users table
-- ============================================================

-- Make wallet_address UNIQUE (critical for FastAPI model consistency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address_unique
    ON users (wallet_address)
    WHERE wallet_address IS NOT NULL;

-- Make role NOT NULL (FastAPI model: role = Column(String(20), nullable=False))
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- Add last_login_at if missing (safe re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add organization_id with FK if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index on organization_id if missing
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

-- ============================================================
-- 2. Fix updated_at auto-update trigger (PostgreSQL)
--    Adds trigger that sets updated_at = NOW() on row update.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_users_updated_at'
          AND tgrelid = 'users'::regclass
    ) THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Apply trigger to organizations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_organizations_updated_at'
          AND tgrelid = 'organizations'::regclass
    ) THEN
        CREATE TRIGGER trg_organizations_updated_at
            BEFORE UPDATE ON organizations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Apply trigger to wallets table (if it exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'wallets'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_wallets_updated_at'
          AND tgrelid = 'wallets'::regclass
    ) THEN
        CREATE TRIGGER trg_wallets_updated_at
            BEFORE UPDATE ON wallets
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 3. Fix wallets table – add missing columns from FastAPI model
-- ============================================================

-- flagged_by may be missing if created by older migration
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS flagged_by VARCHAR(255);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';

-- ============================================================
-- 4. Fix transactions table – ensure columns match FastAPI model
-- ============================================================

-- If transactions table exists, add missing columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(100);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS normalized_risk_score NUMERIC(3,2);
    END IF;
END $$;

-- ============================================================
-- 5. Ensure indexes for performance parity with FastAPI
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wallets_chain_id ON wallets (chain_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions (tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions (from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions (to_address);
CREATE INDEX IF NOT EXISTS idx_alerts_wallet_address ON alerts (wallet_address);
CREATE INDEX IF NOT EXISTS idx_blocked_transfers_sender ON blocked_transfers (sender_address);
