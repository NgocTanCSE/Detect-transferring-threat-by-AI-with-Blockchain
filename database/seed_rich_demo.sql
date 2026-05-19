-- Rich demo seed for dashboard diversity.
-- Safe to rerun: deterministic IDs + ON CONFLICT guards.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure columns used by dashboard/case flows exist.
ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS normalized_risk_score NUMERIC(3, 2);

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS case_status VARCHAR(20) DEFAULT 'PENDING';

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS assigned_to UUID;

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS transactions
ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(100);

ALTER TABLE IF EXISTS alerts ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE IF EXISTS alerts
ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS alerts
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS alerts
ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(255);

-- -----------------------------------------------------------------------------
-- Users (add analysts/admin for assignment and governance actions)
-- -----------------------------------------------------------------------------
INSERT INTO
    users (
        id,
        username,
        email,
        password_hash,
        role,
        wallet_address,
        is_active,
        warning_count
    )
VALUES (
        '11111111-1111-1111-1111-111111111101',
        'linh_analyst',
        'linh.analyst@local',
        '$2a$10$LC.LYgG1EAl3viM0P4A/9OacH.9lxv/SLdAZSI4NHYv8eb0mKOykS',
        'analyst',
        NULL,
        true,
        0
    ),
    (
        '11111111-1111-1111-1111-111111111102',
        'khanh_analyst',
        'khanh.analyst@local',
        '$2a$10$LC.LYgG1EAl3viM0P4A/9OacH.9lxv/SLdAZSI4NHYv8eb0mKOykS',
        'analyst',
        NULL,
        true,
        0
    ),
    (
        '11111111-1111-1111-1111-111111111103',
        'compliance_admin',
        'compliance.admin@local',
        '$2a$10$LC.LYgG1EAl3viM0P4A/9OacH.9lxv/SLdAZSI4NHYv8eb0mKOykS',
        'admin',
        NULL,
        true,
        0
    ) ON CONFLICT (username) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Wallets (broader risk distribution)
-- -----------------------------------------------------------------------------
INSERT INTO
    wallets (
        id,
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
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
        '0x1111111111111111111111111111111111111111',
        'CeFi Treasury A',
        'Exchange',
        'active',
        18.50,
        NULL,
        0,
        NOW() - INTERVAL '220 days',
        NOW() - INTERVAL '2 days',
        'High volume but stable behavior'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
        '0x2222222222222222222222222222222222222222',
        'OTC Desk B',
        'Broker',
        'active',
        41.20,
        'layering',
        0,
        NOW() - INTERVAL '190 days',
        NOW() - INTERVAL '4 days',
        'Periodic bursty settlement'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
        '0x3333333333333333333333333333333333333333',
        'Bridge Router X',
        'Bridge',
        'under_review',
        67.80,
        'manipulation',
        0,
        NOW() - INTERVAL '150 days',
        NOW() - INTERVAL '18 hours',
        'Clustered cross-chain routing'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004',
        '0x4444444444444444444444444444444444444444',
        'Mixer Ingress M1',
        'Unknown',
        'suspended',
        88.40,
        'money_laundering',
        0,
        NOW() - INTERVAL '120 days',
        NOW() - INTERVAL '6 hours',
        'Frequent equal-size transfers'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005',
        '0x5555555555555555555555555555555555555555',
        'Scam Collector S1',
        'Unknown',
        'frozen',
        97.10,
        'scam',
        0,
        NOW() - INTERVAL '95 days',
        NOW() - INTERVAL '90 minutes',
        'Linked to phishing campaign'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0006',
        '0x6666666666666666666666666666666666666666',
        'DAO Ops Wallet',
        'DAO',
        'active',
        22.30,
        NULL,
        0,
        NOW() - INTERVAL '300 days',
        NOW() - INTERVAL '1 day',
        'Governance payouts'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0007',
        '0x7777777777777777777777777777777777777777',
        'Arb Bot Cluster',
        'Trading',
        'under_review',
        71.60,
        'manipulation',
        0,
        NOW() - INTERVAL '85 days',
        NOW() - INTERVAL '2 hours',
        'Potential wash trading loop'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0008',
        '0x8888888888888888888888888888888888888888',
        'Vendor Settlement',
        'Merchant',
        'active',
        12.70,
        NULL,
        0,
        NOW() - INTERVAL '260 days',
        NOW() - INTERVAL '3 days',
        'Recurring B2B payments'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0009',
        '0x9999999999999999999999999999999999999999',
        'Sanctioned Proxy',
        'Unknown',
        'frozen',
        99.00,
        'sanctions',
        0,
        NOW() - INTERVAL '60 days',
        NOW() - INTERVAL '40 minutes',
        'Potential sanctions evasion'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0010',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'Gaming Treasury',
        'Gaming',
        'active',
        28.90,
        NULL,
        0,
        NOW() - INTERVAL '140 days',
        NOW() - INTERVAL '7 hours',
        'NFT and token payouts'
    ) ON CONFLICT (address) DO
UPDATE
SET
    label = EXCLUDED.label,
    entity_type = EXCLUDED.entity_type,
    account_status = EXCLUDED.account_status,
    risk_score = EXCLUDED.risk_score,
    risk_category = EXCLUDED.risk_category,
    last_activity_at = EXCLUDED.last_activity_at,
    notes = EXCLUDED.notes,
    updated_at = NOW();

-- -----------------------------------------------------------------------------
-- Transactions (diverse statuses, risk, assignment)
-- -----------------------------------------------------------------------------
INSERT INTO
    transactions (
        id,
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        input_data,
        status,
        normalized_risk_score,
        case_status,
        assigned_to,
        is_flagged,
        flag_reason,
        timestamp,
        created_at,
        updated_at
    )
VALUES (
        '22222222-2222-2222-2222-222222220001',
        '0xaaa0000000000000000000000000000000000000000000000000000000000001',
        19800011,
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '1200000000000000000',
        22000000000,
        21000,
        '0x',
        1,
        0.22,
        'VERIFIED',
        NULL,
        false,
        NULL,
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '11 days'
    ),
    (
        '22222222-2222-2222-2222-222222220002',
        '0xaaa0000000000000000000000000000000000000000000000000000000000002',
        19800103,
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '3100000000000000000',
        24000000000,
        21000,
        '0x',
        1,
        0.61,
        'PENDING',
        '11111111-1111-1111-1111-111111111101',
        true,
        'Rapid hop pattern',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '9 days'
    ),
    (
        '22222222-2222-2222-2222-222222220003',
        '0xaaa0000000000000000000000000000000000000000000000000000000000003',
        19800198,
        '0x3333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444',
        '2500000000000000000',
        21000000000,
        21000,
        '0x',
        1,
        0.83,
        'FRAUD',
        '11111111-1111-1111-1111-111111111101',
        true,
        'Mixer adjacency',
        NOW() - INTERVAL '9 days',
        NOW() - INTERVAL '9 days',
        NOW() - INTERVAL '8 days'
    ),
    (
        '22222222-2222-2222-2222-222222220004',
        '0xaaa0000000000000000000000000000000000000000000000000000000000004',
        19800322,
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '7000000000000000000',
        25000000000,
        21000,
        '0x',
        1,
        0.95,
        'FRAUD',
        '11111111-1111-1111-1111-111111111102',
        true,
        'Scam payout chain',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '7 days'
    ),
    (
        '22222222-2222-2222-2222-222222220005',
        '0xaaa0000000000000000000000000000000000000000000000000000000000005',
        19800511,
        '0x6666666666666666666666666666666666666666',
        '0x8888888888888888888888888888888888888888',
        '900000000000000000',
        21000000000,
        21000,
        '0x',
        1,
        0.19,
        'VERIFIED',
        NULL,
        false,
        NULL,
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '7 days'
    ),
    (
        '22222222-2222-2222-2222-222222220006',
        '0xaaa0000000000000000000000000000000000000000000000000000000000006',
        19800644,
        '0x7777777777777777777777777777777777777777',
        '0x3333333333333333333333333333333333333333',
        '4200000000000000000',
        26000000000,
        21000,
        '0x',
        1,
        0.78,
        'PENDING',
        '11111111-1111-1111-1111-111111111102',
        true,
        'Wash-loop candidate',
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '5 days'
    ),
    (
        '22222222-2222-2222-2222-222222220007',
        '0xaaa0000000000000000000000000000000000000000000000000000000000007',
        19800710,
        '0x9999999999999999999999999999999999999999',
        '0x2222222222222222222222222222222222222222',
        '5600000000000000000',
        27000000000,
        21000,
        '0x',
        1,
        0.91,
        'FRAUD',
        '11111111-1111-1111-1111-111111111101',
        true,
        'Sanctioned source',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '4 days'
    ),
    (
        '22222222-2222-2222-2222-222222220008',
        '0xaaa0000000000000000000000000000000000000000000000000000000000008',
        19800801,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x1111111111111111111111111111111111111111',
        '1500000000000000000',
        23000000000,
        21000,
        '0x',
        1,
        0.33,
        'VERIFIED',
        NULL,
        false,
        NULL,
        NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '4 days',
        NOW() - INTERVAL '3 days'
    ),
    (
        '22222222-2222-2222-2222-222222220009',
        '0xaaa0000000000000000000000000000000000000000000000000000000000009',
        19800919,
        '0x5555555555555555555555555555555555555555',
        '0x4444444444444444444444444444444444444444',
        '8000000000000000000',
        28000000000,
        21000,
        '0x',
        1,
        0.97,
        'FRAUD',
        '11111111-1111-1111-1111-111111111102',
        true,
        'Known scam cluster',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        '22222222-2222-2222-2222-222222220010',
        '0xaaa0000000000000000000000000000000000000000000000000000000000010',
        19801002,
        '0x2222222222222222222222222222222222222222',
        '0x8888888888888888888888888888888888888888',
        '500000000000000000',
        22000000000,
        21000,
        '0x',
        1,
        0.47,
        'IGNORED',
        NULL,
        false,
        NULL,
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '36 hours'
    ),
    (
        '22222222-2222-2222-2222-222222220011',
        '0xaaa0000000000000000000000000000000000000000000000000000000000011',
        19801084,
        '0x3333333333333333333333333333333333333333',
        '0x9999999999999999999999999999999999999999',
        '2600000000000000000',
        24000000000,
        21000,
        '0x',
        1,
        0.88,
        'PENDING',
        NULL,
        true,
        'Risk threshold breach',
        NOW() - INTERVAL '28 hours',
        NOW() - INTERVAL '28 hours',
        NOW() - INTERVAL '26 hours'
    ),
    (
        '22222222-2222-2222-2222-222222220012',
        '0xaaa0000000000000000000000000000000000000000000000000000000000012',
        19801137,
        '0x7777777777777777777777777777777777777777',
        '0x5555555555555555555555555555555555555555',
        '1900000000000000000',
        25000000000,
        21000,
        '0x',
        1,
        0.81,
        'PENDING',
        NULL,
        true,
        'Escalation candidate',
        NOW() - INTERVAL '14 hours',
        NOW() - INTERVAL '14 hours',
        NOW() - INTERVAL '12 hours'
    ) ON CONFLICT (id, timestamp) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Alerts
-- -----------------------------------------------------------------------------
INSERT INTO
    alerts (
        id,
        wallet_address,
        alert_type,
        severity,
        message,
        risk_score,
        metadata,
        detected_at,
        acknowledged,
        acknowledged_at,
        acknowledged_by
    )
VALUES (
        '33333333-3333-3333-3333-333333330001',
        '0x4444444444444444444444444444444444444444',
        'MIXER_INTERACTION',
        'HIGH',
        'Wallet interacted with known mixer ingress route',
        87.2,
        '{"source":"scanner","rule":"mixer_pattern"}',
        NOW() - INTERVAL '3 days',
        false,
        NULL,
        NULL
    ),
    (
        '33333333-3333-3333-3333-333333330002',
        '0x5555555555555555555555555555555555555555',
        'SCAM_CLUSTER',
        'CRITICAL',
        'Address linked to active phishing cluster',
        98.1,
        '{"source":"threat_intel","campaign":"phish-042"}',
        NOW() - INTERVAL '2 days',
        false,
        NULL,
        NULL
    ),
    (
        '33333333-3333-3333-3333-333333330003',
        '0x7777777777777777777777777777777777777777',
        'WASH_TRADING',
        'HIGH',
        'Abnormal reciprocal transfers detected',
        79.8,
        '{"source":"ai_engine","pattern":"cycle"}',
        NOW() - INTERVAL '30 hours',
        true,
        NOW() - INTERVAL '24 hours',
        'linh_analyst'
    ),
    (
        '33333333-3333-3333-3333-333333330004',
        '0x9999999999999999999999999999999999999999',
        'SANCTIONS_HIT',
        'CRITICAL',
        'Potential sanctioned wallet interaction',
        96.7,
        '{"source":"ofac","list":"sdn"}',
        NOW() - INTERVAL '20 hours',
        false,
        NULL,
        NULL
    ),
    (
        '33333333-3333-3333-3333-333333330005',
        '0x2222222222222222222222222222222222222222',
        'LAYERING_PATTERN',
        'MEDIUM',
        'Burst forwarding pattern over short intervals',
        62.4,
        '{"source":"heuristic"}',
        NOW() - INTERVAL '16 hours',
        true,
        NOW() - INTERVAL '15 hours',
        'khanh_analyst'
    ),
    (
        '33333333-3333-3333-3333-333333330006',
        '0x3333333333333333333333333333333333333333',
        'UNUSUAL_FLOW',
        'MEDIUM',
        'Flow velocity above baseline',
        58.0,
        '{"source":"statistics"}',
        NOW() - INTERVAL '12 hours',
        false,
        NULL,
        NULL
    ),
    (
        '33333333-3333-3333-3333-333333330007',
        '0x1111111111111111111111111111111111111111',
        'COUNTERPARTY_RISK',
        'LOW',
        'Counterparty risk slightly elevated',
        31.4,
        '{"source":"risk_model"}',
        NOW() - INTERVAL '8 hours',
        true,
        NOW() - INTERVAL '7 hours',
        'system'
    ),
    (
        '33333333-3333-3333-3333-333333330008',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'TOKEN_BEHAVIOR',
        'LOW',
        'Token movement pattern changed from baseline',
        24.9,
        '{"source":"feature_store"}',
        NOW() - INTERVAL '4 hours',
        false,
        NULL,
        NULL
    ) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Blocked transfers
-- -----------------------------------------------------------------------------
INSERT INTO
    blocked_transfers (
        id,
        sender_address,
        receiver_address,
        amount,
        risk_score,
        block_reason,
        user_warning_count,
        sender_user_id,
        blocked_at
    )
VALUES (
        '44444444-4444-4444-4444-444444440001',
        '0x5555555555555555555555555555555555555555',
        '0x4444444444444444444444444444444444444444',
        '8000000000000000000',
        97.4,
        'Scam cluster payout blocked',
        0,
        NULL,
        NOW() - INTERVAL '3 days'
    ),
    (
        '44444444-4444-4444-4444-444444440002',
        '0x9999999999999999999999999999999999999999',
        '0x2222222222222222222222222222222222222222',
        '5600000000000000000',
        94.1,
        'Sanctions screening failed',
        0,
        NULL,
        NOW() - INTERVAL '2 days'
    ),
    (
        '44444444-4444-4444-4444-444444440003',
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '7000000000000000000',
        90.6,
        'Mixer-linked route denied',
        1,
        NULL,
        NOW() - INTERVAL '36 hours'
    ),
    (
        '44444444-4444-4444-4444-444444440004',
        '0x7777777777777777777777777777777777777777',
        '0x3333333333333333333333333333333333333333',
        '4200000000000000000',
        82.7,
        'Wash-loop prevention rule',
        0,
        NULL,
        NOW() - INTERVAL '18 hours'
    ),
    (
        '44444444-4444-4444-4444-444444440005',
        '0x3333333333333333333333333333333333333333',
        '0x9999999999999999999999999999999999999999',
        '2600000000000000000',
        88.9,
        'Policy threshold + blacklist match',
        0,
        NULL,
        NOW() - INTERVAL '11 hours'
    ) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Case management timeline
-- -----------------------------------------------------------------------------
INSERT INTO
    transaction_cases (
        id,
        tx_hash,
        analyst_id,
        action,
        state,
        note,
        created_at,
        updated_at
    )
VALUES (
        '55555555-5555-5555-5555-555555550001',
        '0xaaa0000000000000000000000000000000000000000000000000000000000003',
        '11111111-1111-1111-1111-111111111101',
        'ASSIGN',
        'PENDING',
        'Assigned for mixer investigation',
        NOW() - INTERVAL '8 days',
        NOW() - INTERVAL '8 days'
    ),
    (
        '55555555-5555-5555-5555-555555550002',
        '0xaaa0000000000000000000000000000000000000000000000000000000000003',
        '11111111-1111-1111-1111-111111111101',
        'CONFIRM_FRAUD',
        'FRAUD',
        'Confirmed after pattern correlation',
        NOW() - INTERVAL '7 days',
        NOW() - INTERVAL '7 days'
    ),
    (
        '55555555-5555-5555-5555-555555550003',
        '0xaaa0000000000000000000000000000000000000000000000000000000000006',
        '11111111-1111-1111-1111-111111111102',
        'ESCALATE',
        'PENDING',
        'Escalated due to network depth > 3',
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
    ),
    (
        '55555555-5555-5555-5555-555555550004',
        '0xaaa0000000000000000000000000000000000000000000000000000000000010',
        '11111111-1111-1111-1111-111111111102',
        'DISMISS',
        'IGNORED',
        'Legitimate business settlement',
        NOW() - INTERVAL '30 hours',
        NOW() - INTERVAL '30 hours'
    ) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Ops/System datasets
-- -----------------------------------------------------------------------------
INSERT INTO
    node_endpoints (
        id,
        provider_name,
        chain,
        endpoint_url,
        protocol,
        priority,
        is_active,
        health_status,
        last_error,
        last_checked_at,
        created_at,
        updated_at
    )
VALUES (
        '66666666-6666-6666-6666-666666660001',
        'Alchemy Main',
        'ethereum',
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'http',
        10,
        true,
        'healthy',
        NULL,
        NOW() - INTERVAL '10 minutes',
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '10 minutes'
    ),
    (
        '66666666-6666-6666-6666-666666660002',
        'Infura Backup',
        'ethereum',
        'https://mainnet.infura.io/v3/demo',
        'http',
        20,
        true,
        'degraded',
        'Intermittent 429',
        NOW() - INTERVAL '12 minutes',
        NOW() - INTERVAL '28 days',
        NOW() - INTERVAL '12 minutes'
    ),
    (
        '66666666-6666-6666-6666-666666660003',
        'QuickNode WS',
        'ethereum',
        'wss://example.quicknode.pro/ws',
        'websocket',
        30,
        true,
        'healthy',
        NULL,
        NOW() - INTERVAL '7 minutes',
        NOW() - INTERVAL '26 days',
        NOW() - INTERVAL '7 minutes'
    ),
    (
        '66666666-6666-6666-6666-666666660004',
        'Archive Node',
        'ethereum',
        'https://archive-node.local/rpc',
        'http',
        40,
        false,
        'down',
        'Maintenance',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '25 days',
        NOW() - INTERVAL '1 hour'
    ) ON CONFLICT (id) DO
UPDATE
SET
    health_status = EXCLUDED.health_status,
    last_error = EXCLUDED.last_error,
    last_checked_at = EXCLUDED.last_checked_at,
    updated_at = NOW();

INSERT INTO
    pipeline_metrics (
        id,
        chain,
        block_number,
        throughput_tps,
        ingestion_latency_ms,
        decode_latency_ms,
        inserted_at
    )
VALUES (
        9001,
        'ethereum',
        19800000,
        12.10,
        420,
        160,
        NOW() - INTERVAL '140 minutes'
    ),
    (
        9002,
        'ethereum',
        19800020,
        11.80,
        410,
        155,
        NOW() - INTERVAL '130 minutes'
    ),
    (
        9003,
        'ethereum',
        19800040,
        13.50,
        500,
        190,
        NOW() - INTERVAL '120 minutes'
    ),
    (
        9004,
        'ethereum',
        19800060,
        10.90,
        560,
        210,
        NOW() - INTERVAL '110 minutes'
    ),
    (
        9005,
        'ethereum',
        19800080,
        12.70,
        470,
        175,
        NOW() - INTERVAL '100 minutes'
    ),
    (
        9006,
        'ethereum',
        19800100,
        14.10,
        390,
        145,
        NOW() - INTERVAL '90 minutes'
    ),
    (
        9007,
        'ethereum',
        19800120,
        13.40,
        430,
        180,
        NOW() - INTERVAL '80 minutes'
    ),
    (
        9008,
        'ethereum',
        19800140,
        12.00,
        510,
        205,
        NOW() - INTERVAL '70 minutes'
    ),
    (
        9009,
        'ethereum',
        19800160,
        11.60,
        540,
        220,
        NOW() - INTERVAL '60 minutes'
    ),
    (
        9010,
        'ethereum',
        19800180,
        13.90,
        405,
        165,
        NOW() - INTERVAL '50 minutes'
    ),
    (
        9011,
        'ethereum',
        19800200,
        14.40,
        380,
        150,
        NOW() - INTERVAL '45 minutes'
    ),
    (
        9012,
        'ethereum',
        19800220,
        12.20,
        460,
        170,
        NOW() - INTERVAL '40 minutes'
    ) ON CONFLICT (id) DO
UPDATE
SET
    throughput_tps = EXCLUDED.throughput_tps,
    ingestion_latency_ms = EXCLUDED.ingestion_latency_ms,
    decode_latency_ms = EXCLUDED.decode_latency_ms,
    inserted_at = EXCLUDED.inserted_at;

-- -----------------------------------------------------------------------------
-- Ops/AI datasets
-- -----------------------------------------------------------------------------
INSERT INTO
    feature_store_configs (
        id,
        feature_key,
        enabled,
        expression,
        owner_user_id,
        created_at,
        updated_at
    )
VALUES (
        '77777777-7777-7777-7777-777777770001',
        'tx_velocity_1h',
        true,
        'count(tx, 1h)',
        '11111111-1111-1111-1111-111111111101',
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        '77777777-7777-7777-7777-777777770002',
        'counterparty_entropy_7d',
        true,
        'entropy(counterparty, 7d)',
        '11111111-1111-1111-1111-111111111102',
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        '77777777-7777-7777-7777-777777770003',
        'mixer_touch_count_30d',
        true,
        'count_if(mixer=true, 30d)',
        '11111111-1111-1111-1111-111111111101',
        NOW() - INTERVAL '19 days',
        NOW() - INTERVAL '1 day'
    ),
    (
        '77777777-7777-7777-7777-777777770004',
        'rapid_round_trip_2h',
        true,
        'cycle_score(2h)',
        '11111111-1111-1111-1111-111111111102',
        NOW() - INTERVAL '19 days',
        NOW() - INTERVAL '1 day'
    ),
    (
        '77777777-7777-7777-7777-777777770005',
        'contract_call_diversity',
        true,
        'uniq(method_id, 7d)',
        '11111111-1111-1111-1111-111111111101',
        NOW() - INTERVAL '18 days',
        NOW() - INTERVAL '12 hours'
    ),
    (
        '77777777-7777-7777-7777-777777770006',
        'nft_flip_ratio',
        false,
        'flip_ratio(nft, 14d)',
        '11111111-1111-1111-1111-111111111102',
        NOW() - INTERVAL '18 days',
        NOW() - INTERVAL '6 hours'
    ) ON CONFLICT (feature_key) DO
UPDATE
SET
    enabled = EXCLUDED.enabled,
    expression = EXCLUDED.expression,
    owner_user_id = EXCLUDED.owner_user_id,
    updated_at = NOW();

INSERT INTO
    model_registry (
        id,
        model_name,
        version,
        artifact_uri,
        framework,
        is_active,
        promoted_by,
        promoted_at,
        created_at
    )
VALUES (
        '88888888-8888-8888-8888-888888880001',
        'risk_rf',
        'v1.0.0',
        's3://models/risk_rf/v1.0.0/model.pkl',
        'pkl',
        false,
        NULL,
        NULL,
        NOW() - INTERVAL '40 days'
    ),
    (
        '88888888-8888-8888-8888-888888880002',
        'risk_rf',
        'v1.2.0',
        's3://models/risk_rf/v1.2.0/model.pkl',
        'pkl',
        true,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '30 days'
    ),
    (
        '88888888-8888-8888-8888-888888880003',
        'graph_gnn',
        'v0.9.1',
        's3://models/graph_gnn/v0.9.1/model.pt',
        'pt',
        false,
        NULL,
        NULL,
        NOW() - INTERVAL '25 days'
    ),
    (
        '88888888-8888-8888-8888-888888880004',
        'graph_gnn',
        'v1.0.0',
        's3://models/graph_gnn/v1.0.0/model.pt',
        'pt',
        true,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '6 days',
        NOW() - INTERVAL '20 days'
    ),
    (
        '88888888-8888-8888-8888-888888880005',
        'anomaly_onnx',
        'v2.1.3',
        's3://models/anomaly_onnx/v2.1.3/model.onnx',
        'onnx',
        false,
        NULL,
        NULL,
        NOW() - INTERVAL '15 days'
    ) ON CONFLICT (id) DO
UPDATE
SET
    is_active = EXCLUDED.is_active,
    promoted_by = EXCLUDED.promoted_by,
    promoted_at = EXCLUDED.promoted_at;

-- -----------------------------------------------------------------------------
-- Governance datasets
-- -----------------------------------------------------------------------------
INSERT INTO
    policy_rules (
        id,
        rule_name,
        description,
        min_risk_score,
        block_blacklisted,
        block_suspended,
        notify_on_block,
        priority,
        is_active,
        created_by,
        created_at,
        updated_at
    )
VALUES (
        '99999999-9999-9999-9999-999999990001',
        'Block blacklisted addresses',
        'Block transfers if sender/receiver appears on blacklist',
        65.0,
        true,
        true,
        true,
        10,
        true,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '21 days',
        NOW() - INTERVAL '3 days'
    ),
    (
        '99999999-9999-9999-9999-999999990002',
        'Freeze high risk > 90',
        'Auto-block when normalized risk is above 0.90',
        90.0,
        true,
        true,
        true,
        20,
        true,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '20 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        '99999999-9999-9999-9999-999999990003',
        'Escalate risk > 80',
        'Require analyst confirmation for risk above threshold',
        80.0,
        false,
        false,
        true,
        30,
        true,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '19 days',
        NOW() - INTERVAL '1 day'
    ),
    (
        '99999999-9999-9999-9999-999999990004',
        'Legacy strict mode',
        'Deprecated strict mode retained for audit',
        70.0,
        true,
        true,
        false,
        90,
        false,
        '11111111-1111-1111-1111-111111111103',
        NOW() - INTERVAL '50 days',
        NOW() - INTERVAL '15 days'
    ) ON CONFLICT (rule_name) DO
UPDATE
SET
    description = EXCLUDED.description,
    min_risk_score = EXCLUDED.min_risk_score,
    block_blacklisted = EXCLUDED.block_blacklisted,
    block_suspended = EXCLUDED.block_suspended,
    notify_on_block = EXCLUDED.notify_on_block,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO
    notification_events (
        id,
        channel,
        recipient,
        severity,
        message,
        status,
        metadata,
        created_at,
        sent_at
    )
VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
        'slack',
        '#soc-ops',
        'HIGH',
        'Mixer adjacency alert escalated',
        'sent',
        '{"ticket":"SOC-312"}',
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '3 days'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
        'email',
        'risk@company.io',
        'CRITICAL',
        'Sanctioned wallet transfer blocked',
        'sent',
        '{"case":"C-7781"}',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
        'telegram',
        '@oncall_analyst',
        'MEDIUM',
        'Case queue exceeded pending threshold',
        'sent',
        '{"pending":12}',
        NOW() - INTERVAL '20 hours',
        NOW() - INTERVAL '20 hours'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0004',
        'webhook',
        'https://ops/hook',
        'HIGH',
        'Policy update requires acknowledgement',
        'failed',
        '{"http_status":500}',
        NOW() - INTERVAL '14 hours',
        NULL
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0005',
        'slack',
        '#compliance',
        'LOW',
        'Weekly audit snapshot generated',
        'sent',
        '{"report":"weekly"}',
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '6 hours'
    ) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Audit logs for reporting completeness
-- -----------------------------------------------------------------------------
INSERT INTO
    audit_logs (
        id,
        action_type,
        entity_type,
        entity_id,
        user_identifier,
        details,
        timestamp
    )
VALUES (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
        'CASE_ASSIGN',
        'transaction',
        NULL,
        'linh_analyst',
        '{"tx_hash":"0xaaa...0003"}',
        NOW() - INTERVAL '8 days'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002',
        'CASE_ESCALATE',
        'transaction',
        NULL,
        'khanh_analyst',
        '{"tx_hash":"0xaaa...0006"}',
        NOW() - INTERVAL '5 days'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0003',
        'CASE_CONFIRM_FRAUD',
        'transaction',
        NULL,
        'linh_analyst',
        '{"tx_hash":"0xaaa...0003"}',
        NOW() - INTERVAL '7 days'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0004',
        'CASE_DISMISS',
        'transaction',
        NULL,
        'khanh_analyst',
        '{"tx_hash":"0xaaa...0010"}',
        NOW() - INTERVAL '30 hours'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0005',
        'POLICY_RULE_CREATE',
        'policy_rule',
        NULL,
        'compliance_admin',
        '{"rule":"Block blacklisted addresses"}',
        NOW() - INTERVAL '21 days'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0006',
        'POLICY_RULE_UPDATE',
        'policy_rule',
        NULL,
        'compliance_admin',
        '{"rule":"Escalate risk > 80"}',
        NOW() - INTERVAL '1 day'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0007',
        'NOTIFICATION_TEST_SEND',
        'notification_event',
        NULL,
        'linh_analyst',
        '{"channel":"slack"}',
        NOW() - INTERVAL '12 hours'
    ) ON CONFLICT (id) DO NOTHING;

-- Add blacklist diversity if missing.
INSERT INTO
    blacklist (
        id,
        address,
        category,
        source,
        description,
        severity,
        is_active,
        reported_at
    )
VALUES (
        'cccccccc-cccc-cccc-cccc-cccccccc0001',
        '0x1212121212121212121212121212121212121212',
        'Ransomware',
        'Chainalysis',
        'Associated with ransomware off-ramp',
        'CRITICAL',
        true,
        NOW() - INTERVAL '50 days'
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccc0002',
        '0x3434343434343434343434343434343434343434',
        'Mixer',
        'TRM Labs',
        'Mixer forwarding wallet',
        'HIGH',
        true,
        NOW() - INTERVAL '35 days'
    ),
    (
        'cccccccc-cccc-cccc-cccc-cccccccc0003',
        '0x5656565656565656565656565656565656565656',
        'Scam',
        'Internal',
        'Drainer campaign sink wallet',
        'CRITICAL',
        true,
        NOW() - INTERVAL '14 days'
    ) ON CONFLICT (address) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Bulk dataset expansion (Option 1): richer and larger demo data
-- -----------------------------------------------------------------------------

INSERT INTO
    transactions (
        id,
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        input_data,
        status,
        normalized_risk_score,
        case_status,
        assigned_to,
        is_flagged,
        flag_reason,
        timestamp,
        created_at,
        updated_at
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-tx-' || i::text),
    '0x' || lpad(to_hex(1000000 + i), 64, '0'),
    19802000 + i,
    (ARRAY[
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '0x6666666666666666666666666666666666666666',
        '0x7777777777777777777777777777777777777777',
        '0x8888888888888888888888888888888888888888',
        '0x9999999999999999999999999999999999999999',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ])[1 + ((i - 1) % 10)],
    (ARRAY[
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '0x6666666666666666666666666666666666666666',
        '0x7777777777777777777777777777777777777777',
        '0x8888888888888888888888888888888888888888',
        '0x9999999999999999999999999999999999999999',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
    ])[1 + ((i - 1) % 10)],
    ((5 + (i % 25))::numeric * 100000000000000000::numeric),
    20000000000::bigint + ((i % 11) * 1000000000::bigint),
    21000 + ((i % 7) * 900),
    '0x',
    1,
    least(round((0.05 + ((i % 100)::numeric / 100)), 2), 0.99),
    CASE
        WHEN i % 11 = 0 THEN 'FRAUD'
        WHEN i % 9 = 0 THEN 'IGNORED'
        WHEN i % 4 = 0 THEN 'VERIFIED'
        ELSE 'PENDING'
    END,
    CASE
        WHEN i % 5 = 0 THEN '11111111-1111-1111-1111-111111111101'::uuid
        WHEN i % 7 = 0 THEN '11111111-1111-1111-1111-111111111102'::uuid
        ELSE NULL
    END,
    (i % 3 = 0),
    CASE
        WHEN i % 11 = 0 THEN 'Fraud pattern confidence high'
        WHEN i % 8 = 0 THEN 'Velocity threshold exceeded'
        WHEN i % 6 = 0 THEN 'Counterparty risk cluster'
        ELSE NULL
    END,
    NOW() - ((260 - i) * INTERVAL '20 minutes'),
    NOW() - ((260 - i) * INTERVAL '20 minutes'),
    NOW() - ((260 - i) * INTERVAL '18 minutes')
FROM generate_series(1, 240) AS g(i)
ON CONFLICT (id, timestamp) DO NOTHING;

INSERT INTO
    alerts (
        id,
        wallet_address,
        alert_type,
        severity,
        message,
        risk_score,
        metadata,
        detected_at,
        acknowledged,
        acknowledged_at,
        acknowledged_by
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-alert-' || i::text),
    (ARRAY[
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '0x6666666666666666666666666666666666666666',
        '0x7777777777777777777777777777777777777777',
        '0x8888888888888888888888888888888888888888',
        '0x9999999999999999999999999999999999999999',
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ])[1 + ((i - 1) % 10)],
    (ARRAY['UNUSUAL_FLOW', 'LAYERING_PATTERN', 'WASH_TRADING', 'SANCTIONS_HIT', 'MIXER_INTERACTION'])[1 + ((i - 1) % 5)],
    (ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])[1 + ((i - 1) % 4)],
    'Automated detection event #' || i::text,
    round((25 + (i % 75))::numeric, 2),
    jsonb_build_object('seed', 'bulk', 'batch', 1, 'sequence', i),
    NOW() - ((120 - i) * INTERVAL '45 minutes'),
    (i % 4 = 0),
    CASE WHEN i % 4 = 0 THEN NOW() - ((120 - i) * INTERVAL '40 minutes') ELSE NULL END,
    CASE WHEN i % 8 = 0 THEN 'linh_analyst' WHEN i % 12 = 0 THEN 'khanh_analyst' ELSE NULL END
FROM generate_series(1, 48) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    blocked_transfers (
        id,
        sender_address,
        receiver_address,
        amount,
        risk_score,
        block_reason,
        user_warning_count,
        sender_user_id,
        blocked_at
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-blocked-' || i::text),
    (ARRAY[
        '0x4444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555',
        '0x7777777777777777777777777777777777777777',
        '0x9999999999999999999999999999999999999999'
    ])[1 + ((i - 1) % 4)],
    (ARRAY[
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333',
        '0x6666666666666666666666666666666666666666',
        '0x8888888888888888888888888888888888888888'
    ])[1 + ((i - 1) % 4)],
    ((10 + (i % 30))::numeric * 100000000000000000::numeric),
    round((70 + (i % 28))::numeric, 2),
    (ARRAY['Policy threshold breach', 'Blacklist match', 'Suspended account', 'Anomaly cluster'])[1 + ((i - 1) % 4)],
    (i % 3),
    NULL,
    NOW() - ((72 - i) * INTERVAL '1 hour')
FROM generate_series(1, 24) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    transaction_cases (
        id,
        tx_hash,
        analyst_id,
        action,
        state,
        note,
        created_at,
        updated_at
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-case-' || i::text),
    '0x' || lpad(to_hex(1000000 + i), 64, '0'),
    CASE
        WHEN i % 2 = 0 THEN '11111111-1111-1111-1111-111111111101'::uuid
        ELSE '11111111-1111-1111-1111-111111111102'::uuid
    END,
    (ARRAY['ASSIGN', 'ESCALATE', 'CONFIRM_FRAUD', 'DISMISS'])[1 + ((i - 1) % 4)],
    (ARRAY['PENDING', 'PENDING', 'FRAUD', 'IGNORED'])[1 + ((i - 1) % 4)],
    'Bulk case timeline event #' || i::text,
    NOW() - ((100 - i) * INTERVAL '50 minutes'),
    NOW() - ((100 - i) * INTERVAL '45 minutes')
FROM generate_series(1, 80) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    notification_events (
        id,
        channel,
        recipient,
        severity,
        message,
        status,
        metadata,
        created_at,
        sent_at
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-notification-' || i::text),
    (ARRAY['slack', 'email', 'telegram', 'webhook'])[1 + ((i - 1) % 4)],
    (ARRAY['#soc-ops', 'risk@company.io', '@oncall_analyst', 'https://ops/hook'])[1 + ((i - 1) % 4)],
    (ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])[1 + ((i - 1) % 4)],
    'Notification test stream #' || i::text,
    CASE WHEN i % 7 = 0 THEN 'failed' ELSE 'sent' END,
    jsonb_build_object('seed', 'bulk', 'sequence', i),
    NOW() - ((96 - i) * INTERVAL '1 hour'),
    CASE WHEN i % 7 = 0 THEN NULL ELSE NOW() - ((96 - i) * INTERVAL '55 minutes') END
FROM generate_series(1, 24) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO
    pipeline_metrics (
        id,
        chain,
        block_number,
        throughput_tps,
        ingestion_latency_ms,
        decode_latency_ms,
        inserted_at
    )
SELECT
    12000 + i,
    'ethereum',
    19810000 + i,
    round((9 + (i % 8) + ((i % 3) * 0.25))::numeric, 2),
    350 + (i % 240),
    120 + (i % 140),
    NOW() - ((100 - i) * INTERVAL '8 minutes')
FROM generate_series(1, 96) AS g(i)
ON CONFLICT (id) DO UPDATE
SET
    throughput_tps = EXCLUDED.throughput_tps,
    ingestion_latency_ms = EXCLUDED.ingestion_latency_ms,
    decode_latency_ms = EXCLUDED.decode_latency_ms,
    inserted_at = EXCLUDED.inserted_at;

INSERT INTO
    audit_logs (
        id,
        action_type,
        entity_type,
        entity_id,
        user_identifier,
        details,
        timestamp
    )
SELECT
    uuid_generate_v5(uuid_ns_url(), 'bulk-audit-' || i::text),
    (ARRAY[
        'CASE_ASSIGN',
        'CASE_ESCALATE',
        'CASE_CONFIRM_FRAUD',
        'CASE_DISMISS',
        'POLICY_RULE_UPDATE',
        'NOTIFICATION_TEST_SEND'
    ])[1 + ((i - 1) % 6)],
    'transaction',
    NULL,
    CASE WHEN i % 2 = 0 THEN 'linh_analyst' ELSE 'khanh_analyst' END,
    jsonb_build_object('seed', 'bulk', 'sequence', i),
    NOW() - ((90 - i) * INTERVAL '1 hour')
FROM generate_series(1, 42) AS g(i)
ON CONFLICT (id) DO NOTHING;

COMMIT;
