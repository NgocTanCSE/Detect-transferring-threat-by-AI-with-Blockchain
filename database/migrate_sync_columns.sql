-- Migration: Add missing columns and tables for sync between init.sql and microservices
-- Run this AFTER init.sql

-- 1. Add chain_id to blocked_transfers (used by transfer-service)
ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
CREATE INDEX IF NOT EXISTS idx_blocked_chain ON blocked_transfers (chain_id);

-- 2. Add chain_id to alerts (used by alert-service and backend)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
CREATE INDEX IF NOT EXISTS idx_alerts_chain ON alerts (chain_id);

-- 3. Add organization_id to wallets (used by backend multi-tenant)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 4. Add organization_id to alerts (used by backend multi-tenant)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 5. Add organization_id to blocked_transfers (used by backend)
ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 6. Add organization_id to transactions (used by backend)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 7. Create organizations table (required by gateway auth)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_org_api_key ON organizations (api_key);

-- 8. Add organization_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 9. Rename alerts.metadata to alerts.meta for consistency with alert-service
-- (alert-service uses 'meta', init.sql uses 'metadata')
-- We'll add 'meta' column and copy data, then keep both for compatibility
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS meta JSONB;
UPDATE alerts SET meta = metadata WHERE meta IS NULL AND metadata IS NOT NULL;

COMMENT ON COLUMN alerts.metadata IS 'Legacy column - use meta instead';
COMMENT ON COLUMN alerts.meta IS 'JSONB metadata for alert context (preferred)';

-- 10. Add amount_eth to blocked_transfers for easier querying
ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS amount_eth NUMERIC(12, 6);

-- 11. Add case_status and assigned_to to transactions for compliance workflow
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS normalized_risk_score NUMERIC(5, 2);

-- 12. Create transaction_cases table if not exists (compliance workflow)
CREATE TABLE IF NOT EXISTS transaction_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(66) NOT NULL,
    analyst_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    state VARCHAR(20) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_tx ON transaction_cases (tx_hash);
CREATE INDEX IF NOT EXISTS idx_cases_analyst ON transaction_cases (analyst_id);

-- 13. Create policy_rules table if not exists
CREATE TABLE IF NOT EXISTS policy_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    min_risk_score NUMERIC(5, 2) DEFAULT 80.0,
    block_blacklisted BOOLEAN DEFAULT true,
    block_suspended BOOLEAN DEFAULT true,
    notify_on_block BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(255),
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_policy_name ON policy_rules (rule_name);
CREATE INDEX IF NOT EXISTS idx_policy_active ON policy_rules (is_active);

-- 14. Create notification_events table
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    recipient VARCHAR(255),
    severity VARCHAR(20),
    message TEXT,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Create diagnostic_events table
CREATE TABLE IF NOT EXISTS diagnostic_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO',
    message TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Create pipeline_metrics table
CREATE TABLE IF NOT EXISTS pipeline_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(12, 4),
    tags JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pipeline_name ON pipeline_metrics (metric_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_time ON pipeline_metrics (recorded_at DESC);

-- 17. Create feature_store_configs table
CREATE TABLE IF NOT EXISTS feature_store_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_name VARCHAR(100) UNIQUE NOT NULL,
    feature_type VARCHAR(50) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Create model_registry table
CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'staging',
    metrics JSONB,
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_name, model_version)
);

-- 19. Create system_health_snapshots table
CREATE TABLE IF NOT EXISTS system_health_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cpu_usage NUMERIC(5, 2),
    memory_usage NUMERIC(5, 2),
    disk_usage NUMERIC(5, 2),
    active_connections INTEGER,
    requests_per_minute NUMERIC(10, 2),
    error_rate NUMERIC(5, 4),
    details JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Create compliance_kpis table
CREATE TABLE IF NOT EXISTS compliance_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kpi_name VARCHAR(100) NOT NULL,
    kpi_value NUMERIC(12, 4),
    period_days INTEGER DEFAULT 30,
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Create feedback_labels table
CREATE TABLE IF NOT EXISTS feedback_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash VARCHAR(66),
    wallet_address VARCHAR(255),
    category VARCHAR(50) NOT NULL,
    message TEXT,
    sentiment VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. Seed default organization
INSERT INTO organizations (id, name, slug, api_key, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Blockchain AI Sentinel', 'sentinel', 'bk_live_51Px9X2J2X2X2X2X2X2X2X2X2X2X2X2', true)
ON CONFLICT (slug) DO NOTHING;
