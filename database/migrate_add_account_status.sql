-- Migration: Add account_status and risk_category to wallets table
-- Run this if you have existing database without these columns

-- Add account_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wallets' AND column_name = 'account_status'
    ) THEN
        ALTER TABLE wallets
        ADD COLUMN account_status VARCHAR(20) DEFAULT 'active'
        CHECK (account_status IN ('active', 'suspended', 'frozen', 'under_review'));

        CREATE INDEX idx_wallets_status ON wallets (account_status);

        COMMENT ON COLUMN wallets.account_status IS 'active=normal, suspended=temp block, frozen=permanent block, under_review=investigating';
    END IF;
END $$;

-- Add risk_category column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wallets' AND column_name = 'risk_category'
    ) THEN
        ALTER TABLE wallets
        ADD COLUMN risk_category VARCHAR(50);

        CREATE INDEX idx_wallets_risk_category ON wallets (risk_category);

        COMMENT ON COLUMN wallets.risk_category IS 'Category of detected risk: money_laundering, manipulation, scam, hacker, etc.';
    END IF;
END $$;

-- Add flagged_at column if it doesn't exist
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

-- Add flagged_by column if it doesn't exist
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

-- Add notes column if it doesn't exist
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
