CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";
-- For composite indexes

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (
        role IN ('admin', 'analyst', 'user')
    ),
    wallet_address VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    warning_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);

CREATE INDEX idx_users_email ON users (email);

CREATE INDEX idx_users_wallet ON users (wallet_address);

CREATE INDEX idx_users_role ON users (role);

COMMENT ON
TABLE users IS 'Platform users including admins and regular users';

COMMENT ON COLUMN users.warning_count IS 'Number of times user ignored risk warnings (3 = suspend)';

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    address VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255),
    entity_type VARCHAR(50) DEFAULT 'Unknown',
    account_status VARCHAR(20) DEFAULT 'active' CHECK (
        account_status IN (
            'active',
            'suspended',
            'frozen',
            'under_review'
        )
    ),
    risk_score NUMERIC(5, 2) DEFAULT 0.00 CHECK (
        risk_score >= 0
        AND risk_score <= 100
    ),
    risk_category VARCHAR(50),
    total_transactions BIGINT DEFAULT 0,
    total_value_sent NUMERIC(78, 0) DEFAULT 0,
    total_value_received NUMERIC(78, 0) DEFAULT 0,
    first_seen_at TIMESTAMP
    WITH
        TIME ZONE,
        last_activity_at TIMESTAMP
    WITH
        TIME ZONE,
        flagged_at TIMESTAMP
    WITH
        TIME ZONE,
        flagged_by VARCHAR(255),
        notes TEXT,
        chain_id VARCHAR(50) DEFAULT 'ethereum',
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_address ON wallets USING hash (address);

CREATE INDEX idx_wallets_risk_score ON wallets (risk_score DESC);

CREATE INDEX idx_wallets_entity_type ON wallets (entity_type);

CREATE INDEX idx_wallets_status ON wallets (account_status);

CREATE INDEX idx_wallets_last_activity ON wallets (last_activity_at DESC);

CREATE INDEX idx_wallets_risk_category ON wallets (risk_category);

CREATE INDEX idx_wallets_chain_id ON wallets (chain_id);

COMMENT ON
TABLE wallets IS 'Ethereum wallet addresses with risk metadata and activity statistics';

COMMENT ON COLUMN wallets.risk_score IS 'AI-calculated risk score from 0 to 100';

COMMENT ON COLUMN wallets.account_status IS 'active=normal, suspended=temp block, frozen=permanent block, under_review=investigating';

CREATE TABLE IF NOT EXISTS transactions (
    id UUID NOT NULL DEFAULT uuid_generate_v4 (),
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66),
    transaction_index INTEGER,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255),
    value NUMERIC(78, 0) DEFAULT 0,
    gas_price NUMERIC(78, 0),
    gas_used BIGINT,
    gas_limit BIGINT,
    nonce BIGINT,
    input_data TEXT,
    status SMALLINT DEFAULT 1 CHECK (status IN (0, 1)),
    is_flagged BOOLEAN DEFAULT false,
    flag_reason VARCHAR(100),
    chain_id VARCHAR(50) DEFAULT 'ethereum',
    contract_address VARCHAR(255),
    timestamp TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, timestamp)
)
PARTITION BY
    RANGE (timestamp);

-- Create partitions for transaction data (by month)
CREATE TABLE IF NOT EXISTS transactions_2024_12 PARTITION OF transactions FOR
VALUES
FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS transactions_2025_01 PARTITION OF transactions FOR
VALUES
FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS transactions_2025_02 PARTITION OF transactions FOR
VALUES
FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS transactions_default PARTITION OF transactions DEFAULT;

-- Indexes on main table and partitions
CREATE INDEX idx_transactions_hash ON transactions (tx_hash);

CREATE INDEX idx_transactions_from ON transactions (from_address);

CREATE INDEX idx_transactions_to ON transactions (to_address);

CREATE INDEX idx_transactions_block ON transactions (block_number DESC);

CREATE INDEX idx_transactions_timestamp ON transactions (timestamp DESC);

CREATE INDEX idx_transactions_value ON transactions (value DESC)
WHERE
    value > 0;

CREATE INDEX idx_transactions_status ON transactions (status);

CREATE INDEX idx_transactions_chain_id ON transactions (chain_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_transactions_from_to ON transactions (from_address, to_address);

CREATE INDEX idx_transactions_from_time ON transactions (from_address, timestamp DESC);

COMMENT ON
TABLE transactions IS 'Ethereum blockchain transactions with full technical details';

COMMENT ON COLUMN transactions.status IS '1 = Success, 0 = Failed';

COMMENT ON COLUMN transactions.input_data IS 'Method call data for smart contract interactions';

CREATE TABLE IF NOT EXISTS token_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER NOT NULL,
    token_address VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20),
    token_name VARCHAR(100),
    token_decimals SMALLINT DEFAULT 18,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    value NUMERIC(78, 0) NOT NULL,
    value_decimal NUMERIC(38, 18),
    transfer_type VARCHAR(20) DEFAULT 'ERC20',
    timestamp TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
        -- Note: FK to transactions removed - PostgreSQL doesn't support FK to partitioned tables
);

CREATE INDEX idx_token_transfers_hash ON token_transfers (transaction_hash);

CREATE INDEX idx_token_transfers_from ON token_transfers (from_address);

CREATE INDEX idx_token_transfers_to ON token_transfers (to_address);

CREATE INDEX idx_token_transfers_token ON token_transfers (token_address);

CREATE INDEX idx_token_transfers_symbol ON token_transfers (token_symbol);

CREATE INDEX idx_token_transfers_timestamp ON token_transfers (timestamp DESC);

CREATE INDEX idx_token_transfers_value ON token_transfers (value_decimal DESC);

COMMENT ON
TABLE token_transfers IS 'ERC20 and ERC721 token transfer events';

COMMENT ON COLUMN token_transfers.transfer_type IS 'ERC20, ERC721, or ERC1155';

CREATE TABLE IF NOT EXISTS blocked_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    sender_address VARCHAR(255) NOT NULL,
    receiver_address VARCHAR(255) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    risk_score NUMERIC(5, 2),
    block_reason VARCHAR(100) NOT NULL,
    user_warning_count INTEGER DEFAULT 0,
    sender_user_id UUID REFERENCES users (id),
    blocked_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blocked_sender ON blocked_transfers (sender_address);

CREATE INDEX idx_blocked_receiver ON blocked_transfers (receiver_address);

CREATE INDEX idx_blocked_time ON blocked_transfers (blocked_at DESC);

COMMENT ON
TABLE blocked_transfers IS 'History of all blocked transaction attempts for audit';

CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES users (id),
    wallet_address VARCHAR(255) NOT NULL,
    target_address VARCHAR(255) NOT NULL,
    warning_type VARCHAR(50) NOT NULL,
    risk_score NUMERIC(5, 2),
    user_action VARCHAR(20) CHECK (
        user_action IN (
            'ignored',
            'cancelled',
            'reported'
        )
    ),
    warning_number INTEGER NOT NULL,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_warnings_user ON user_warnings (user_id);

CREATE INDEX idx_warnings_wallet ON user_warnings (wallet_address);

CREATE INDEX idx_warnings_time ON user_warnings (created_at DESC);

COMMENT ON
TABLE user_warnings IS 'Tracks when users ignore risk warnings (3 strikes = suspension)';

CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wallet_id UUID NOT NULL,
    score NUMERIC(5, 2) NOT NULL CHECK (
        score >= 0
        AND score <= 100
    ),
    risk_level VARCHAR(20) NOT NULL CHECK (
        risk_level IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        )
    ),
    details JSONB,
    model_version VARCHAR(50),
    feature_count INTEGER,
    confidence_score NUMERIC(5, 2),
    assessed_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_wallet_assessment FOREIGN KEY (wallet_id) REFERENCES wallets (id) ON DELETE CASCADE
);

CREATE INDEX idx_risk_assessments_wallet ON risk_assessments (wallet_id);

CREATE INDEX idx_risk_assessments_score ON risk_assessments (score DESC);

CREATE INDEX idx_risk_assessments_level ON risk_assessments (risk_level);

CREATE INDEX idx_risk_assessments_time ON risk_assessments (assessed_at DESC);

CREATE INDEX idx_risk_assessments_details ON risk_assessments USING gin (details);

COMMENT ON
TABLE risk_assessments IS 'Historical AI-powered risk assessment records';

CREATE TABLE IF NOT EXISTS blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    address VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    source VARCHAR(255),
    description TEXT,
    severity VARCHAR(20) DEFAULT 'HIGH' CHECK (
        severity IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        )
    ),
    is_active BOOLEAN DEFAULT true,
    reported_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP
    WITH
        TIME ZONE,
        expires_at TIMESTAMP
    WITH
        TIME ZONE
);

CREATE INDEX idx_blacklist_address ON blacklist USING hash (address);

CREATE INDEX idx_blacklist_category ON blacklist (category);

CREATE INDEX idx_blacklist_severity ON blacklist (severity);

CREATE INDEX idx_blacklist_active ON blacklist (is_active)
WHERE
    is_active = true;

COMMENT ON
TABLE blacklist IS 'Known malicious addresses from various threat intelligence sources';

CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wallet_address VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (
        severity IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        )
    ),
    message TEXT NOT NULL,
    risk_score NUMERIC(5, 2),
    metadata JSONB,
    detected_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        acknowledged BOOLEAN DEFAULT false,
        acknowledged_at TIMESTAMP
    WITH
        TIME ZONE,
        acknowledged_by VARCHAR(255)
);

CREATE INDEX idx_alerts_wallet ON alerts (wallet_address);

CREATE INDEX idx_alerts_type ON alerts (alert_type);

CREATE INDEX idx_alerts_severity ON alerts (severity);

CREATE INDEX idx_alerts_detected ON alerts (detected_at DESC);

CREATE INDEX idx_alerts_acknowledged ON alerts (acknowledged)
WHERE
    acknowledged = false;

COMMENT ON
TABLE alerts IS 'Real-time security alerts generated by autonomous scanner service';

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    user_identifier VARCHAR(255),
    ip_address INET,
    details JSONB,
    timestamp TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_action ON audit_logs (action_type);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id);

CREATE INDEX idx_audit_time ON audit_logs (timestamp DESC);

COMMENT ON
TABLE audit_logs IS 'System-wide audit trail for compliance and forensics';

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
WHERE
    w.risk_score >= 70
GROUP BY
    w.id,
    w.address,
    w.risk_score,
    w.entity_type,
    w.total_transactions,
    w.last_activity_at;

CREATE UNIQUE INDEX idx_high_risk_wallets_addr ON high_risk_wallets (address);

COMMENT ON MATERIALIZED VIEW high_risk_wallets IS 'Pre-aggregated high-risk wallets for dashboard performance';

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

-- Insert platform users (2 fixed role accounts: admin + analyst)
INSERT INTO
    users (
        username,
        email,
        password_hash,
        role,
        wallet_address,
        is_active,
        warning_count
    )
VALUES (
        'admin_security',
        'admin@blockchain-sentinel.io',
        'admin123',
        'admin',
        '0x0000000000000000000000000000000000000001',
        true,
        0
    ),
    (
        'linh_analyst',
        'linh.analyst@blockchain-sentinel.io',
        'analyst123',
        'analyst',
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        true,
        0
    ) ON CONFLICT (email) DO NOTHING;

-- Insert wallets linked to the fixed role accounts
INSERT INTO
    wallets (
        address,
        label,
        entity_type,
        account_status,
        risk_score,
        risk_category,
        total_transactions,
        first_seen_at,
        last_activity_at,
        notes
    )
VALUES (
        '0x0000000000000000000000000000000000000001',
        'Security Admin Wallet',
        'System',
        'active',
        0.00,
        NULL,
        0,
        NOW(),
        NOW(),
        'Admin role seed account wallet'
    ),
    (
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        'Linh Analyst Wallet',
        'Individual',
        'active',
        5.00,
        NULL,
        0,
        NOW(),
        NOW(),
        'Analyst role seed account wallet'
    ) ON CONFLICT (address) DO NOTHING;

-- Insert real threat blacklist (useful for initial detection)
INSERT INTO
    blacklist (
        address,
        category,
        source,
        description,
        severity,
        is_active
    )
VALUES (
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        'Heist',
        'OFAC SDN List',
        'Lazarus Group - DPRK state-sponsored hackers',
        'CRITICAL',
        true
    ),
    (
        '0x4f3a120e72c76c22ae802d129f599bfdbc31cb81',
        'Heist',
        'FBI IC3',
        'Ronin Network hack perpetrator - $625M stolen',
        'CRITICAL',
        true
    ),
    (
        '0x722122df12d4e14e13ac3b6895a86e84145b6967',
        'Mixer',
        'OFAC',
        'Tornado Cash Router Contract - Sanctioned mixer',
        'CRITICAL',
        true
    ) ON CONFLICT (address) DO NOTHING;

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
