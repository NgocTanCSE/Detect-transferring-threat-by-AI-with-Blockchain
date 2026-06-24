-- Migration: align init.sql with SQLAlchemy models and microservice contracts.
-- Run this AFTER init.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE blocked_transfers ADD COLUMN IF NOT EXISTS amount_eth NUMERIC(12, 6);
CREATE INDEX IF NOT EXISTS idx_blocked_chain ON blocked_transfers (chain_id);
CREATE INDEX IF NOT EXISTS idx_blocked_org ON blocked_transfers (organization_id);
CREATE INDEX IF NOT EXISTS idx_blocked_chain_time ON blocked_transfers (chain_id, blocked_at DESC);

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS meta JSONB;
UPDATE alerts SET meta = metadata WHERE meta IS NULL AND metadata IS NOT NULL;
UPDATE alerts SET metadata = meta WHERE metadata IS NULL AND meta IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_chain ON alerts (chain_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts (organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_chain_detected ON alerts (chain_id, detected_at DESC);

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_wallets_org ON wallets (organization_id);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS normalized_risk_score NUMERIC(3, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON transactions (organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_case_status ON transactions (case_status);
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_to ON transactions (assigned_to);
CREATE INDEX IF NOT EXISTS idx_transactions_chain_time ON transactions (chain_id, timestamp DESC);

ALTER TABLE token_transfers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_token_transfers_org ON token_transfers (organization_id);

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    contact_email VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations (slug);
CREATE INDEX IF NOT EXISTS idx_org_api_key ON organizations (api_key);

DO $$
DECLARE
    constraint_record record;
BEGIN
    IF to_regclass('public.users') IS NOT NULL THEN
        FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'users'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%role%'
        LOOP
            EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_record.conname);
        END LOOP;

        ALTER TABLE users
        ADD CONSTRAINT ck_user_role CHECK (
            role IN ('admin', 'analyst', 'user', 'system_admin', 'security_analyst', 'compliance_risk_manager', 'ai_data_engineer', 'operator', 'api_client')
        );
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users (organization_id);

CREATE TABLE IF NOT EXISTS feedback_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) NOT NULL,
    ai_score NUMERIC(5, 2) NOT NULL,
    ai_risk_level VARCHAR(20) NOT NULL,
    ai_model_version VARCHAR(50),
    admin_label VARCHAR(20) NOT NULL,
    admin_category VARCHAR(50),
    admin_notes TEXT,
    admin_username VARCHAR(100) NOT NULL,
    used_for_training BOOLEAN DEFAULT false,
    training_batch_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_wallet ON feedback_labels (wallet_address);
CREATE INDEX IF NOT EXISTS idx_feedback_admin_username ON feedback_labels (admin_username);
CREATE INDEX IF NOT EXISTS idx_feedback_training ON feedback_labels (used_for_training);

ALTER TABLE transaction_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
    IF to_regclass('public.transaction_cases') IS NOT NULL THEN
        ALTER TABLE transaction_cases DROP CONSTRAINT IF EXISTS ck_case_action;
        ALTER TABLE transaction_cases DROP CONSTRAINT IF EXISTS ck_case_state;
        ALTER TABLE transaction_cases ADD CONSTRAINT ck_case_action CHECK (action IN ('ASSIGN', 'CONFIRM_FRAUD', 'DISMISS', 'ESCALATE'));
        ALTER TABLE transaction_cases ADD CONSTRAINT ck_case_state CHECK (state IN ('PENDING', 'VERIFIED', 'FRAUD', 'IGNORED'));
    END IF;
END $$;

ALTER TABLE policy_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
DO $$
BEGIN
    IF to_regclass('public.policy_rules') IS NOT NULL THEN
        ALTER TABLE policy_rules DROP CONSTRAINT IF EXISTS ck_policy_active;
        ALTER TABLE policy_rules ADD CONSTRAINT ck_policy_active CHECK (is_active IN (true, false));
    END IF;
END $$;

ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS notification_metadata JSONB;
UPDATE notification_events SET notification_metadata = meta WHERE notification_metadata IS NULL AND meta IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_metadata ON notification_events USING gin (notification_metadata);

ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS chain VARCHAR(50);
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS throughput_tps NUMERIC(10, 2);
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS ingestion_latency_ms INTEGER;
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS decode_latency_ms INTEGER;
ALTER TABLE pipeline_metrics ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_chain ON pipeline_metrics(chain);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_block_number ON pipeline_metrics(block_number);
CREATE INDEX IF NOT EXISTS idx_pipeline_metrics_inserted_at ON pipeline_metrics(inserted_at DESC);

CREATE TABLE IF NOT EXISTS feature_store_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feature_key VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    expression TEXT,
    owner_user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    artifact_uri VARCHAR(1024) NOT NULL,
    framework VARCHAR(20) NOT NULL DEFAULT 'pkl',
    is_active BOOLEAN DEFAULT false,
    promoted_by UUID REFERENCES users(id),
    promoted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_health_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    availability_pct NUMERIC(5,2) DEFAULT 100.0,
    latency_p95_ms NUMERIC DEFAULT 0.0,
    error_budget_burn NUMERIC DEFAULT 0.0,
    sample_points INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_threat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) NOT NULL,
    threat_type VARCHAR(50) NOT NULL,
    risk_score NUMERIC NOT NULL,
    details JSONB,
    detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_threat_wallet ON ai_threat_logs (wallet_address);
CREATE INDEX IF NOT EXISTS idx_ai_threat_type ON ai_threat_logs (threat_type);
CREATE INDEX IF NOT EXISTS idx_ai_threat_detected ON ai_threat_logs (detected_at DESC);

CREATE TABLE IF NOT EXISTS compliance_kpis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_key VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    category VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_compliance_kpis_key ON compliance_kpis (metric_key);

CREATE TABLE IF NOT EXISTS money_flow_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    inflow_eth NUMERIC DEFAULT 0.0,
    outflow_eth NUMERIC DEFAULT 0.0,
    chain_id VARCHAR(50) DEFAULT 'ethereum',
    wallet_address VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_money_flow_chain_time ON money_flow_snapshots (chain_id, timestamp DESC);

INSERT INTO organizations (id, name, slug, contact_email, api_key, is_active)
VALUES ('11111111-1111-1111-1111-111111111100', 'Blockchain Sentinel', 'blockchain-sentinel', 'admin@blockchain-sentinel.io', 'demo-api-key-12345', true)
ON CONFLICT (slug) DO NOTHING;

UPDATE users SET organization_id = '11111111-1111-1111-1111-111111111100' WHERE organization_id IS NULL;
