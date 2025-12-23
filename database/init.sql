-- ==========================================
-- Blockchain Sentinel - Production Database Schema
-- PostgreSQL 15+ Optimized for Real-time Fraud Detection
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- ==========================================
-- 1. Users Table (System Users with Roles)
-- Stores admin and user accounts for the platform
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'analyst', 'user')),
    wallet_address VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    warning_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_wallet ON users (wallet_address);
CREATE INDEX idx_users_role ON users (role);

COMMENT ON TABLE users IS 'Platform users including admins and regular users';
COMMENT ON COLUMN users.warning_count IS 'Number of times user ignored risk warnings (3 = suspend)';

-- ==========================================
-- 2. Wallets Table (Monitored Wallet Addresses)
-- Stores Ethereum wallet addresses and metadata
-- ==========================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255),
    entity_type VARCHAR(50) DEFAULT 'Unknown',
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'frozen', 'under_review')),
    risk_score NUMERIC(5,2) DEFAULT 0.00 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_category VARCHAR(50),
    total_transactions BIGINT DEFAULT 0,
    total_value_sent NUMERIC(78,0) DEFAULT 0,
    total_value_received NUMERIC(78,0) DEFAULT 0,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    flagged_at TIMESTAMP WITH TIME ZONE,
    flagged_by VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_address ON wallets USING hash (address);
CREATE INDEX idx_wallets_risk_score ON wallets (risk_score DESC);
CREATE INDEX idx_wallets_entity_type ON wallets (entity_type);
CREATE INDEX idx_wallets_status ON wallets (account_status);
CREATE INDEX idx_wallets_last_activity ON wallets (last_activity_at DESC);
CREATE INDEX idx_wallets_risk_category ON wallets (risk_category);

COMMENT ON TABLE wallets IS 'Ethereum wallet addresses with risk metadata and activity statistics';
COMMENT ON COLUMN wallets.risk_score IS 'AI-calculated risk score from 0 to 100';
COMMENT ON COLUMN wallets.account_status IS 'active=normal, suspended=temp block, frozen=permanent block, under_review=investigating';

-- ==========================================
-- 3. Transactions Table (Enhanced)
-- Stores detailed blockchain transactions
-- ==========================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66),
    transaction_index INTEGER,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255),
    value NUMERIC(78,0) DEFAULT 0,
    gas_price NUMERIC(78,0),
    gas_used BIGINT,
    gas_limit BIGINT,
    nonce BIGINT,
    input_data TEXT,
    status SMALLINT DEFAULT 1 CHECK (status IN (0, 1)),
    is_flagged BOOLEAN DEFAULT false,
    flag_reason VARCHAR(100),
    contract_address VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for transaction data (by month)
CREATE TABLE IF NOT EXISTS transactions_2024_12 PARTITION OF transactions
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS transactions_2025_01 PARTITION OF transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS transactions_2025_02 PARTITION OF transactions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS transactions_default PARTITION OF transactions DEFAULT;

-- Indexes on main table and partitions
CREATE INDEX idx_transactions_hash ON transactions (tx_hash);
CREATE INDEX idx_transactions_from ON transactions (from_address);
CREATE INDEX idx_transactions_to ON transactions (to_address);
CREATE INDEX idx_transactions_block ON transactions (block_number DESC);
CREATE INDEX idx_transactions_timestamp ON transactions (timestamp DESC);
CREATE INDEX idx_transactions_value ON transactions (value DESC) WHERE value > 0;
CREATE INDEX idx_transactions_status ON transactions (status);

-- Composite indexes for common query patterns
CREATE INDEX idx_transactions_from_to ON transactions (from_address, to_address);
CREATE INDEX idx_transactions_from_time ON transactions (from_address, timestamp DESC);

COMMENT ON TABLE transactions IS 'Ethereum blockchain transactions with full technical details';
COMMENT ON COLUMN transactions.status IS '1 = Success, 0 = Failed';
COMMENT ON COLUMN transactions.input_data IS 'Method call data for smart contract interactions';

-- ==========================================
-- 3. Token Transfers Table (NEW)
-- Stores ERC20/ERC721 token transfers
-- ==========================================
CREATE TABLE IF NOT EXISTS token_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20),
    token_name VARCHAR(100),
    token_decimals SMALLINT DEFAULT 18,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    value NUMERIC(78,0) NOT NULL,
    value_decimal NUMERIC(38,18),
    transfer_type VARCHAR(20) DEFAULT 'ERC20',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    -- Note: FK to transactions removed - PostgreSQL doesn't support FK to partitioned tables
);

CREATE INDEX idx_token_transfers_hash ON token_transfers (transaction_hash);
CREATE INDEX idx_token_transfers_from ON token_transfers (from_address);
CREATE INDEX idx_token_transfers_to ON token_transfers (to_address);
CREATE INDEX idx_token_transfers_token ON token_transfers (token_address);
CREATE INDEX idx_token_transfers_symbol ON token_transfers (token_symbol);
CREATE INDEX idx_token_transfers_timestamp ON token_transfers (timestamp DESC);
CREATE INDEX idx_token_transfers_value ON token_transfers (value_decimal DESC);

COMMENT ON TABLE token_transfers IS 'ERC20 and ERC721 token transfer events';
COMMENT ON COLUMN token_transfers.transfer_type IS 'ERC20, ERC721, or ERC1155';

-- ==========================================
-- 5. Blocked Transfers Table (NEW)
-- Records all blocked transaction attempts
-- ==========================================
CREATE TABLE IF NOT EXISTS blocked_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_address VARCHAR(255) NOT NULL,
    receiver_address VARCHAR(255) NOT NULL,
    amount NUMERIC(78,0) NOT NULL,
    risk_score NUMERIC(5,2),
    block_reason VARCHAR(100) NOT NULL,
    user_warning_count INTEGER DEFAULT 0,
    sender_user_id UUID REFERENCES users(id),
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocked_sender ON blocked_transfers (sender_address);
CREATE INDEX idx_blocked_receiver ON blocked_transfers (receiver_address);
CREATE INDEX idx_blocked_time ON blocked_transfers (blocked_at DESC);

COMMENT ON TABLE blocked_transfers IS 'History of all blocked transaction attempts for audit';

-- ==========================================
-- 6. User Warnings Table (NEW)
-- Tracks user warnings for ignoring risk alerts
-- ==========================================
CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    wallet_address VARCHAR(255) NOT NULL,
    target_address VARCHAR(255) NOT NULL,
    warning_type VARCHAR(50) NOT NULL,
    risk_score NUMERIC(5,2),
    user_action VARCHAR(20) CHECK (user_action IN ('ignored', 'cancelled', 'reported')),
    warning_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_warnings_user ON user_warnings (user_id);
CREATE INDEX idx_warnings_wallet ON user_warnings (wallet_address);
CREATE INDEX idx_warnings_time ON user_warnings (created_at DESC);

COMMENT ON TABLE user_warnings IS 'Tracks when users ignore risk warnings (3 strikes = suspension)';

-- ==========================================
-- 7. Risk Assessments Table
-- Historical AI risk analysis records
-- ==========================================
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    details JSONB,
    model_version VARCHAR(50),
    feature_count INTEGER,
    confidence_score NUMERIC(5,2),
    assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_assessment FOREIGN KEY (wallet_id)
        REFERENCES wallets(id) ON DELETE CASCADE
);

CREATE INDEX idx_risk_assessments_wallet ON risk_assessments (wallet_id);
CREATE INDEX idx_risk_assessments_score ON risk_assessments (score DESC);
CREATE INDEX idx_risk_assessments_level ON risk_assessments (risk_level);
CREATE INDEX idx_risk_assessments_time ON risk_assessments (assessed_at DESC);
CREATE INDEX idx_risk_assessments_details ON risk_assessments USING gin (details);

COMMENT ON TABLE risk_assessments IS 'Historical AI-powered risk assessment records';

-- ==========================================
-- 5. Blacklist Table
-- Known malicious or sanctioned addresses
-- ==========================================
CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    source VARCHAR(255),
    description TEXT,
    severity VARCHAR(20) DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    is_active BOOLEAN DEFAULT true,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_blacklist_address ON blacklist USING hash (address);
CREATE INDEX idx_blacklist_category ON blacklist (category);
CREATE INDEX idx_blacklist_severity ON blacklist (severity);
CREATE INDEX idx_blacklist_active ON blacklist (is_active) WHERE is_active = true;

COMMENT ON TABLE blacklist IS 'Known malicious addresses from various threat intelligence sources';

-- ==========================================
-- 6. Alerts Table
-- Real-time security alerts from scanner
-- ==========================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    message TEXT NOT NULL,
    risk_score NUMERIC(5,2),
    metadata JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255)
);

CREATE INDEX idx_alerts_wallet ON alerts (wallet_address);
CREATE INDEX idx_alerts_type ON alerts (alert_type);
CREATE INDEX idx_alerts_severity ON alerts (severity);
CREATE INDEX idx_alerts_detected ON alerts (detected_at DESC);
CREATE INDEX idx_alerts_acknowledged ON alerts (acknowledged) WHERE acknowledged = false;

COMMENT ON TABLE alerts IS 'Real-time security alerts generated by autonomous scanner service';

-- ==========================================
-- 7. Audit Log Table (NEW)
-- Track all system actions for compliance
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    user_identifier VARCHAR(255),
    ip_address INET,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_action ON audit_logs (action_type);
CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_time ON audit_logs (timestamp DESC);

COMMENT ON TABLE audit_logs IS 'System-wide audit trail for compliance and forensics';

-- ==========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ==========================================

-- High-risk wallets aggregated view
CREATE MATERIALIZED VIEW IF NOT EXISTS high_risk_wallets AS
SELECT
    w.address,
    w.risk_score,
    w.entity_type,
    w.total_transactions,
    w.last_activity_at,
    COUNT(DISTINCT a.id) as alert_count,
    MAX(a.severity) as max_alert_severity
FROM wallets w
LEFT JOIN alerts a ON w.address = a.wallet_address
WHERE w.risk_score >= 70
GROUP BY w.id, w.address, w.risk_score, w.entity_type, w.total_transactions, w.last_activity_at;

CREATE UNIQUE INDEX idx_high_risk_wallets_addr ON high_risk_wallets (address);

COMMENT ON MATERIALIZED VIEW high_risk_wallets IS 'Pre-aggregated high-risk wallets for dashboard performance';

-- ==========================================
-- TRIGGERS FOR AUTO-UPDATE
-- ==========================================

-- Update wallet statistics on transaction insert
CREATE OR REPLACE FUNCTION update_wallet_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sender stats
    UPDATE wallets
    SET
        total_transactions = total_transactions + 1,
        total_value_sent = total_value_sent + NEW.value,
        last_activity_at = NEW.timestamp,
        updated_at = CURRENT_TIMESTAMP
    WHERE address = NEW.from_address;

    -- Update receiver stats
    IF NEW.to_address IS NOT NULL THEN
        UPDATE wallets
        SET
            total_transactions = total_transactions + 1,
            total_value_received = total_value_received + NEW.value,
            last_activity_at = NEW.timestamp,
            updated_at = CURRENT_TIMESTAMP
        WHERE address = NEW.to_address;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_wallet_stats
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_stats();

-- ==========================================
-- MAINTENANCE PROCEDURES
-- ==========================================

-- Refresh materialized view (run via cron)
CREATE OR REPLACE FUNCTION refresh_high_risk_wallets()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY high_risk_wallets;
END;
$$ LANGUAGE plpgsql;

-- Archive old alerts (retention: 90 days)
CREATE OR REPLACE FUNCTION archive_old_alerts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM alerts
    WHERE detected_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
    AND acknowledged = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Suspend user after 3 warnings
CREATE OR REPLACE FUNCTION suspend_user_on_warnings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.warning_count >= 3 THEN
        -- Update associated wallet to suspended
        UPDATE wallets
        SET account_status = 'suspended',
            flagged_at = CURRENT_TIMESTAMP,
            flagged_by = 'SYSTEM_AUTO_SUSPEND'
        WHERE address = NEW.wallet_address;

        -- Create alert for admin
        INSERT INTO alerts (wallet_address, alert_type, severity, message, risk_score)
        VALUES (NEW.wallet_address, 'USER_SUSPENDED', 'HIGH',
                'User account suspended after 3 ignored risk warnings',
                80.00);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suspend_user_on_warnings
AFTER UPDATE OF warning_count ON users
FOR EACH ROW
WHEN (NEW.warning_count >= 3 AND OLD.warning_count < 3)
EXECUTE FUNCTION suspend_user_on_warnings();

COMMENT ON FUNCTION archive_old_alerts IS 'Archives acknowledged alerts older than 90 days';

-- ==========================================
-- REALISTIC SEED DATA FOR DEMO
-- Following real Ethereum address format
-- ==========================================

-- Insert platform users (2 regular users + 1 admin)
INSERT INTO users (username, email, password_hash, role, wallet_address, is_active, warning_count) VALUES
('alice_nguyen', 'alice.nguyen@gmail.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.9HvD6s1qWq1q1q', 'user', '0x742d35cc6634c0532925a3b844bc454e4438f44e', true, 0),
('bob_tran', 'bob.tran@outlook.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.9HvD6s1qWq1q1q', 'user', '0x8ba1f109551bd432803012645ac136ddd64dba72', true, 0),
('admin_security', 'admin@blockchain-sentinel.io', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.9HvD6s1qWq1q1q', 'admin', '0x0000000000000000000000000000000000000001', true, 0)
ON CONFLICT (email) DO NOTHING;

-- Insert demo wallets with realistic data
-- 2 Regular User Wallets
INSERT INTO wallets (address, label, entity_type, account_status, risk_score, risk_category, total_transactions, first_seen_at, last_activity_at, notes) VALUES
('0x742d35cc6634c0532925a3b844bc454e4438f44e', 'Alice Personal Wallet', 'Individual', 'active', 5.00, NULL, 127, '2023-03-15 08:30:00+00', NOW() - INTERVAL '2 hours', 'Regular user, consistent trading patterns'),
('0x8ba1f109551bd432803012645ac136ddd64dba72', 'Bob Trading Account', 'Individual', 'active', 12.00, NULL, 89, '2023-06-22 14:15:00+00', NOW() - INTERVAL '5 hours', 'Active trader, verified identity')
ON CONFLICT (address) DO NOTHING;

-- 2 Hacker Wallets (Known threats)
INSERT INTO wallets (address, label, entity_type, account_status, risk_score, risk_category, total_transactions, first_seen_at, last_activity_at, flagged_at, notes) VALUES
('0x098b716b8aaf21512996dc57eb0615e2383e2f96', 'Lazarus Group Wallet', 'Hacker', 'frozen', 99.00, 'scam', 2341, '2022-01-10 00:00:00+00', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '30 days', 'OFAC sanctioned - North Korea linked'),
('0x4f3a120e72c76c22ae802d129f599bfdbc31cb81', 'Ronin Bridge Exploiter', 'Hacker', 'frozen', 98.00, 'scam', 156, '2022-03-23 00:00:00+00', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '60 days', 'Linked to $625M Ronin Network hack')
ON CONFLICT (address) DO NOTHING;

-- 10 Money Laundering Wallets (Realistic layering patterns)
INSERT INTO wallets (address, label, entity_type, account_status, risk_score, risk_category, total_transactions, first_seen_at, last_activity_at, flagged_at, notes) VALUES
('0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', 'Layer 1 - Structuring Hub', 'Suspicious', 'suspended', 92.00, 'money_laundering', 1523, '2024-01-15 10:30:00+00', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '7 days', 'Detected structuring pattern: multiple $9,900 transfers'),
('0x7f367cc41522ce07553e823bf3be79a889debe1b', 'Layer 2 - Distribution Node', 'Suspicious', 'suspended', 88.00, 'money_laundering', 847, '2024-02-20 16:45:00+00', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '5 days', 'Connected to Tornado Cash mixer'),
('0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff', 'Layer 3 - Integration Point', 'Suspicious', 'under_review', 85.00, 'money_laundering', 234, '2024-03-05 09:20:00+00', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '2 days', 'Final integration step before CEX'),
('0x2fc617e933a52713247ce25730f6695920b3befe', 'Smurfing Wallet A', 'Suspicious', 'suspended', 90.00, 'money_laundering', 1876, '2024-01-08 11:00:00+00', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '10 days', 'High volume small transactions pattern'),
('0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', 'Binance Cold → Mixer Route', 'Suspicious', 'under_review', 78.00, 'money_laundering', 543, '2024-04-12 22:30:00+00', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '3 days', 'Unusual withdrawal patterns from exchange'),
('0x4b0f1812e5df2a09796481ff14017e6005508003', 'Chain Hopping Node', 'Suspicious', 'suspended', 87.00, 'money_laundering', 312, '2024-02-28 13:15:00+00', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 days', 'Cross-chain bridge abuse detected'),
('0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3', 'Peeling Chain Wallet', 'Suspicious', 'under_review', 82.00, 'money_laundering', 2134, '2024-03-18 07:45:00+00', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '1 day', 'Classic peeling chain pattern'),
('0x6b175474e89094c44da98b954eedeac495271d0f', 'DAI Layering Wallet', 'Suspicious', 'suspended', 84.00, 'money_laundering', 678, '2024-01-25 19:00:00+00', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '8 days', 'Stablecoin layering through DEXs'),
('0x7a250d5630b4cf539739df2c5dacb4c659f2488d', 'Uniswap Mixer Abuse', 'Suspicious', 'under_review', 76.00, 'money_laundering', 4521, '2024-04-01 00:00:00+00', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '12 hours', 'Using DEX swaps to obscure trail'),
('0x8aff5ca996f77487a4f04f1ce905bf3d27455580', 'Final Consolidation Wallet', 'Suspicious', 'suspended', 91.00, 'money_laundering', 89, '2024-05-10 15:30:00+00', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '6 days', 'Funds consolidated before fiat off-ramp')
ON CONFLICT (address) DO NOTHING;

-- 2 Market Manipulation Wallets (Wash trading, pump & dump)
INSERT INTO wallets (address, label, entity_type, account_status, risk_score, risk_category, total_transactions, first_seen_at, last_activity_at, flagged_at, notes) VALUES
('0x9bf4001d307dfd62b26a2f1307ee0c0307632d59', 'Wash Trader Alpha', 'Manipulator', 'suspended', 94.00, 'manipulation', 15678, '2024-02-14 08:00:00+00', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '3 days', 'Self-trading loop detected: A→B→C→A pattern'),
('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'Pump & Dump Operator', 'Manipulator', 'frozen', 96.00, 'manipulation', 8934, '2024-03-01 12:00:00+00', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 days', 'Coordinated pump scheme on low-cap tokens')
ON CONFLICT (address) DO NOTHING;

-- Exchange and legitimate high-volume wallets (for context)
INSERT INTO wallets (address, label, entity_type, account_status, risk_score, risk_category, total_transactions, first_seen_at, last_activity_at, notes) VALUES
('0xdfd5293d8e347dfe59e90efd55b2956a1343963d', 'Binance Hot Wallet 8', 'Exchange', 'active', 8.00, NULL, 2456789, '2020-01-01 00:00:00+00', NOW() - INTERVAL '1 minute', 'Verified Binance hot wallet'),
('0x28c6c06298d514db089934071355e5743bf21d60', 'Binance Hot Wallet 14', 'Exchange', 'active', 6.00, NULL, 1876543, '2020-06-15 00:00:00+00', NOW() - INTERVAL '2 minutes', 'Verified Binance hot wallet'),
('0x21a31ee1afc51d94c2efccaa2092ad1028285549', 'Bybit Cold Wallet', 'Exchange', 'active', 4.00, NULL, 234567, '2021-03-20 00:00:00+00', NOW() - INTERVAL '30 minutes', 'Verified Bybit cold storage')
ON CONFLICT (address) DO NOTHING;

-- Insert realistic transactions between wallets
INSERT INTO transactions (tx_hash, from_address, to_address, value, block_number, gas_price, gas_used, nonce, status, timestamp) VALUES
-- Normal user transactions
('0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123401', '0x742d35cc6634c0532925a3b844bc454e4438f44e', '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', 2500000000000000000, 18500000, 30000000000, 21000, 1, 1, NOW() - INTERVAL '2 days'),
('0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123402', '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', '0x742d35cc6634c0532925a3b844bc454e4438f44e', 100000000000000000000, 18500100, 25000000000, 21000, 5, 1, NOW() - INTERVAL '1 day'),
('0xa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123403', '0x8ba1f109551bd432803012645ac136ddd64dba72', '0x742d35cc6634c0532925a3b844bc454e4438f44e', 5000000000000000000, 18500200, 20000000000, 21000, 10, 1, NOW() - INTERVAL '5 hours'),

-- Money laundering pattern (structuring - amounts just under $10k)
('0xlaunder01234567890abcdef1234567890abcdef1234567890abcdef12340101', '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', '0x7f367cc41522ce07553e823bf3be79a889debe1b', 2800000000000000000, 18600001, 30000000000, 21000, 1, 1, NOW() - INTERVAL '6 hours'),
('0xlaunder01234567890abcdef1234567890abcdef1234567890abcdef12340102', '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', '0x7f367cc41522ce07553e823bf3be79a889debe1b', 2750000000000000000, 18600002, 30000000000, 21000, 2, 1, NOW() - INTERVAL '5 hours 55 minutes'),
('0xlaunder01234567890abcdef1234567890abcdef1234567890abcdef12340103', '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', '0x7f367cc41522ce07553e823bf3be79a889debe1b', 2820000000000000000, 18600003, 30000000000, 21000, 3, 1, NOW() - INTERVAL '5 hours 50 minutes'),
('0xlaunder01234567890abcdef1234567890abcdef1234567890abcdef12340104', '0x7f367cc41522ce07553e823bf3be79a889debe1b', '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff', 8000000000000000000, 18600100, 28000000000, 21000, 1, 1, NOW() - INTERVAL '4 hours'),

-- Wash trading pattern (circular transactions)
('0xwash0123456789abcdef1234567890abcdef1234567890abcdef1234560001', '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59', '0x742d35cc6634c0532925a3b844bc454e4438f44e', 50000000000000000000, 18700001, 35000000000, 21000, 100, 1, NOW() - INTERVAL '2 hours'),
('0xwash0123456789abcdef1234567890abcdef1234567890abcdef1234560002', '0x742d35cc6634c0532925a3b844bc454e4438f44e', '0x8ba1f109551bd432803012645ac136ddd64dba72', 50000000000000000000, 18700002, 35000000000, 21000, 128, 1, NOW() - INTERVAL '1 hour 58 minutes'),
('0xwash0123456789abcdef1234567890abcdef1234567890abcdef1234560003', '0x8ba1f109551bd432803012645ac136ddd64dba72', '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59', 49500000000000000000, 18700003, 35000000000, 21000, 90, 1, NOW() - INTERVAL '1 hour 55 minutes'),

-- Hacker transactions to mixer
('0xhacker123456789abcdef1234567890abcdef1234567890abcdef12345600a1', '0x098b716b8aaf21512996dc57eb0615e2383e2f96', '0x722122df12d4e14e13ac3b6895a86e84145b6967', 100000000000000000000, 18800001, 50000000000, 21000, 500, 1, NOW() - INTERVAL '12 hours')
ON CONFLICT (tx_hash) DO NOTHING;

-- Insert blacklist entries (Known bad actors)
INSERT INTO blacklist (address, category, source, description, severity, is_active) VALUES
('0x098b716b8aaf21512996dc57eb0615e2383e2f96', 'Heist', 'OFAC SDN List', 'Lazarus Group - DPRK state-sponsored hackers linked to multiple bridge exploits', 'CRITICAL', true),
('0x4f3a120e72c76c22ae802d129f599bfdbc31cb81', 'Heist', 'FBI IC3', 'Ronin Network hack perpetrator - $625M stolen', 'CRITICAL', true),
('0x722122df12d4e14e13ac3b6895a86e84145b6967', 'Mixer', 'OFAC', 'Tornado Cash Router Contract - Sanctioned mixer', 'CRITICAL', true),
('0xdd4c48c0b24039969fc16d1cdf626eab821d3384', 'Mixer', 'OFAC', 'Tornado Cash 100 ETH Pool', 'CRITICAL', true),
('0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', 'Mixer', 'OFAC', 'Tornado Cash 10 ETH Pool', 'HIGH', true),
('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'Manipulation', 'Internal Detection', 'Coordinated pump scheme operator - multiple rug pulls', 'HIGH', true),
('0x9bf4001d307dfd62b26a2f1307ee0c0307632d59', 'Manipulation', 'Internal Detection', 'Wash trading bot - self-dealing detected', 'HIGH', true)
ON CONFLICT (address) DO NOTHING;

-- Insert risk assessments
INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version)
SELECT id, 99.00, 'CRITICAL', '{"reasons": ["OFAC Sanctioned", "Linked to state-sponsored hacking", "Multiple bridge exploits"], "detection_modules": {"scam": true, "money_laundering": true, "manipulation": false}}', 'Multi-Agent-v2.0'
FROM wallets WHERE address = '0x098b716b8aaf21512996dc57eb0615e2383e2f96';

INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version)
SELECT id, 92.00, 'CRITICAL', '{"reasons": ["Structuring pattern detected", "5+ transactions within 1 hour", "Similar amounts under reporting threshold"], "detection_modules": {"scam": false, "money_laundering": true, "manipulation": false}}', 'Multi-Agent-v2.0'
FROM wallets WHERE address = '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a';

INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version)
SELECT id, 94.00, 'CRITICAL', '{"reasons": ["Circular transaction pattern", "Self-dealing loop A→B→C→A", "High frequency trading bot behavior"], "detection_modules": {"scam": false, "money_laundering": false, "manipulation": true}}', 'Multi-Agent-v2.0'
FROM wallets WHERE address = '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59';

INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version)
SELECT id, 5.00, 'LOW', '{"reasons": ["Verified individual", "Consistent trading patterns", "No suspicious activity"], "detection_modules": {"scam": false, "money_laundering": false, "manipulation": false}}', 'Multi-Agent-v2.0'
FROM wallets WHERE address = '0x742d35cc6634c0532925a3b844bc454e4438f44e';

-- Insert sample alerts from scanner
INSERT INTO alerts (wallet_address, alert_type, severity, message, risk_score, metadata) VALUES
('0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', 'STRUCTURING_DETECTED', 'CRITICAL', 'Detected 5 transactions of similar amounts within 1 hour - potential structuring activity', 92.00, '{"pattern": "structuring", "tx_count": 5, "time_window_minutes": 60, "avg_amount_eth": 2.79}'),
('0x7f367cc41522ce07553e823bf3be79a889debe1b', 'MIXER_INTERACTION', 'HIGH', 'Wallet received funds from known Tornado Cash user', 88.00, '{"source_type": "mixer_connected", "hops_from_mixer": 1}'),
('0x9bf4001d307dfd62b26a2f1307ee0c0307632d59', 'WASH_TRADING', 'CRITICAL', 'Circular transaction pattern detected: funds returned to origin within 5 minutes', 94.00, '{"pattern": "cycle", "cycle_time_seconds": 180, "cycle_wallets": ["0x742d35cc", "0x8ba1f109"]}'),
('0x098b716b8aaf21512996dc57eb0615e2383e2f96', 'BLACKLIST_MATCH', 'CRITICAL', 'Address matches OFAC SDN List - Lazarus Group', 99.00, '{"source": "OFAC", "entity": "Lazarus Group", "country": "DPRK"}'),
('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'PUMP_DUMP_DETECTED', 'HIGH', 'Coordinated price manipulation detected across 3 token pairs', 96.00, '{"pattern": "pump_and_dump", "affected_tokens": ["SCAM1", "RUGME", "FAKE99"]}')
ON CONFLICT DO NOTHING;

-- Insert sample blocked transfers (demo audit trail)
INSERT INTO blocked_transfers (sender_address, receiver_address, amount, risk_score, block_reason, user_warning_count) VALUES
('0x742d35cc6634c0532925a3b844bc454e4438f44e', '0x098b716b8aaf21512996dc57eb0615e2383e2f96', 5000000000000000000, 99.00, 'blacklisted', 0),
('0x8ba1f109551bd432803012645ac136ddd64dba72', '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a', 10000000000000000000, 92.00, 'high_risk_score', 1)
ON CONFLICT DO NOTHING;
-- ==========================================
-- VACUUM AND ANALYZE (Performance)
-- ==========================================
VACUUM ANALYZE users;
VACUUM ANALYZE wallets;
VACUUM ANALYZE transactions;
VACUUM ANALYZE token_transfers;
VACUUM ANALYZE risk_assessments;
VACUUM ANALYZE blacklist;
VACUUM ANALYZE alerts;
VACUUM ANALYZE blocked_transfers;
VACUUM ANALYZE user_warnings;
VACUUM ANALYZE audit_logs;
