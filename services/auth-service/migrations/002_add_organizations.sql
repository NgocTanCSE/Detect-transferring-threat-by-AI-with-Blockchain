/**
 * Migration 002: Add Organizations and Multi-tenancy support
 */

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations (slug);

-- Update users table to support organizations and UUID
-- Note: Changing existing ID from SERIAL to UUID is complex in production, 
-- but for this project we'll add a new uuid column and keep id for now, 
-- or we can recreate the table if no critical data exists.
-- For now, let's just add organization_id.

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (organization_id);

-- Update wallets table to support organizations
-- We need to ensure wallets table exists first (it's created by analytics-service or manually)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL UNIQUE,
    label VARCHAR(255),
    entity_type VARCHAR(50) DEFAULT 'Unknown',
    organization_id UUID REFERENCES organizations(id),
    account_status VARCHAR(20) DEFAULT 'active',
    risk_score FLOAT DEFAULT 0.0,
    risk_category VARCHAR(50),
    total_transactions BIGINT DEFAULT 0,
    total_value_sent NUMERIC(78, 0) DEFAULT 0,
    total_value_received NUMERIC(78, 0) DEFAULT 0,
    first_seen_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    chain_id VARCHAR(50) DEFAULT 'ethereum',
    flagged_at TIMESTAMP WITH TIME ZONE,
    flagged_by VARCHAR(255),
    notes TEXT,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_org_id ON wallets (organization_id);

-- Create usage_logs table for tracking and billing
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_org_id ON usage_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs (timestamp);
