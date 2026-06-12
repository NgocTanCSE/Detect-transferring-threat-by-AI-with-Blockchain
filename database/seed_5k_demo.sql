-- =============================================================
-- Seed ~5000+ demo records for Blockchain Sentinel Dashboard
-- =============================================================

-- Each section is its own transaction so one failure doesn't block the rest.

-- Helper
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================== 1. WALLETS (~200 extra) =====================
INSERT INTO wallets (id, address, risk_score, account_status, chain_id, total_transactions, total_value_sent, total_value_received, first_seen_at, last_activity_at, created_at)
SELECT
    uuid_generate_v4(),
    '0x' || lpad(to_hex(n), 40, '0'),
    round((random() * 100)::numeric, 2),
    (ARRAY['active','active','active','under_review','frozen','suspended'])[floor(random()*6)+1],
    (ARRAY['ethereum','ethereum','bsc'])[floor(random()*3)+1],
    floor(random() * 500 + 10)::bigint,
    (floor(random() * 200 * 1e18))::numeric,
    (floor(random() * 300 * 1e18))::numeric,
    NOW() - (random() * interval '180 days'),
    NOW() - (random() * interval '7 days'),
    NOW() - (random() * interval '180 days')
FROM generate_series(2000, 2199) AS n
ON CONFLICT DO NOTHING;

-- ===================== 2. BLACKLIST (~100 extra) =====================
INSERT INTO blacklist (id, address, category, source, description, severity, is_active, reported_at)
SELECT
    uuid_generate_v4(),
    '0xdead' || lpad(to_hex(n + 5000), 36, '0'),
    (ARRAY['sanctions','fraud','phishing','mixing_service','stolen_funds'])[floor(random()*5)+1],
    (ARRAY['OFAC','Chainalysis','Internal-Scan','Etherscan-Flag','Community-Report'])[floor(random()*5)+1],
    'Auto-flagged suspicious address #' || n,
    (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[floor(random()*4)+1],
    random() < 0.85,
    NOW() - (random() * interval '180 days')
FROM generate_series(1, 100) AS n
ON CONFLICT DO NOTHING;

-- ===================== 3. TRANSACTIONS (~2000) =====================
INSERT INTO transactions (id, tx_hash, block_number, from_address, to_address, value, gas_price, gas_used, status, chain_id, timestamp, created_at, normalized_risk_score, case_status)
SELECT
    uuid_generate_v4(),
    '0x' || md5(random()::text || n::text || clock_timestamp()::text),
    18000000 + n,
    '0x' || lpad(to_hex(floor(random()*1200)::int), 40, '0'),
    '0x' || lpad(to_hex(floor(random()*1200)::int + 200), 40, '0'),
    (floor(random() * 50 * 1e18))::numeric(78,0),
    (floor(random() * 80 + 10) * 1e9)::numeric(78,0),
    floor(random() * 50000 + 21000)::bigint,
    CASE WHEN random() < 0.97 THEN 1 ELSE 0 END,
    (ARRAY['ethereum','ethereum','ethereum','bsc','bsc'])[floor(random()*5)+1],
    NOW() - ((n * 0.7) * interval '1 minute'),
    NOW() - ((n * 0.7) * interval '1 minute'),
    round((random() * 0.95)::numeric, 2),
    (ARRAY['PENDING','PENDING','VERIFIED','FRAUD','IGNORED'])[floor(random()*5)+1]
FROM generate_series(1, 2000) AS n;

-- ===================== 4. ALERTS (~800) =====================
INSERT INTO alerts (id, wallet_address, alert_type, severity, message, risk_score, detected_at, acknowledged, chain_id)
SELECT
    uuid_generate_v4(),
    '0x' || lpad(to_hex(floor(random()*1200)::int), 40, '0'),
    (ARRAY[
        'HIGH_RISK_DETECTION','UNUSUAL_VOLUME','RAPID_MOVEMENT',
        'BLACKLIST_INTERACTION','MIXER_DETECTED','FLASH_LOAN',
        'SANDWICH_ATTACK','WASH_TRADING','BRIDGE_EXPLOIT'
    ])[floor(random()*9)+1],
    (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[floor(random()*4)+1],
    (ARRAY[
        'Suspicious high-value transfer detected from flagged wallet',
        'Unusual transaction volume spike in the last 30 minutes',
        'Rapid fund movement through multiple hops detected',
        'Interaction with known blacklisted address detected',
        'Potential mixer service usage identified',
        'Flash loan attack pattern identified in transaction chain',
        'Sandwich attack detected targeting DEX swap',
        'Wash trading pattern identified between related wallets',
        'Cross-chain bridge exploit attempt detected'
    ])[floor(random()*9)+1],
    round((random() * 60 + 40)::numeric, 2),
    NOW() - (random() * interval '30 days'),
    random() < 0.3,
    (ARRAY['ethereum','ethereum','bsc'])[floor(random()*3)+1]
FROM generate_series(1, 800) AS n;

-- ===================== 5. BLOCKED TRANSFERS (~500) =====================
INSERT INTO blocked_transfers (id, sender_address, receiver_address, amount, risk_score, block_reason, user_warning_count, blocked_at, chain_id)
SELECT
    uuid_generate_v4(),
    '0x' || lpad(to_hex(floor(random()*1200)::int), 40, '0'),
    '0x' || lpad(to_hex(floor(random()*1200)::int + 200), 40, '0'),
    (floor(random() * 100 * 1e18))::numeric(78,0),
    round((random() * 30 + 70)::numeric, 2),
    (ARRAY[
        'BLACKLISTED_RECIPIENT','HIGH_RISK_SENDER','VELOCITY_LIMIT',
        'SANCTIONS_MATCH','PATTERN_ANOMALY','MIXER_DESTINATION',
        'AMOUNT_THRESHOLD','UNUSUAL_TIMING'
    ])[floor(random()*8)+1],
    floor(random() * 5)::int,
    NOW() - (random() * interval '30 days'),
    (ARRAY['ethereum','ethereum','bsc'])[floor(random()*3)+1]
FROM generate_series(1, 500) AS n;

-- ===================== 6. MONEY FLOW SNAPSHOTS (30 days × 2 chains = 60) =====================
INSERT INTO money_flow_snapshots (id, timestamp, inflow_eth, outflow_eth, chain_id, created_at)
SELECT
    uuid_generate_v4(),
    (NOW() - (n * interval '1 day')),
    round((random() * 800 + 200)::numeric, 4),
    round((random() * 700 + 150)::numeric, 4),
    chain,
    NOW() - (n * interval '1 day')
FROM generate_series(0, 29) AS n,
     (SELECT unnest(ARRAY['ethereum','bsc']) AS chain) AS chains
ON CONFLICT DO NOTHING;

-- ===================== 7. NODE ENDPOINTS (~20) =====================
INSERT INTO node_endpoints (id, provider_name, chain, endpoint_url, protocol, priority, is_active, health_status, last_checked_at, created_at)
VALUES
    (uuid_generate_v4(), 'Alchemy',     'ethereum', 'https://eth-mainnet.g.alchemy.com/v2/key1',   'http', 1, true,  'healthy',   NOW()-interval '2 min', NOW()-interval '30 days'),
    (uuid_generate_v4(), 'Infura',      'ethereum', 'https://mainnet.infura.io/v3/key2',           'http', 2, true,  'healthy',   NOW()-interval '1 min', NOW()-interval '28 days'),
    (uuid_generate_v4(), 'QuickNode',   'ethereum', 'https://eth.quicknode.pro/key3',              'wss',  3, true,  'healthy',   NOW()-interval '3 min', NOW()-interval '25 days'),
    (uuid_generate_v4(), 'Ankr',        'ethereum', 'https://rpc.ankr.com/eth/key4',               'http', 4, true,  'degraded',  NOW()-interval '5 min', NOW()-interval '20 days'),
    (uuid_generate_v4(), 'Chainstack',  'ethereum', 'https://eth-mainnet.core.chainstack.com/key5','http', 5, false, 'unhealthy', NOW()-interval '10 min',NOW()-interval '15 days'),
    (uuid_generate_v4(), 'Alchemy',     'bsc',      'https://bsc-mainnet.g.alchemy.com/v2/key6',   'http', 1, true,  'healthy',   NOW()-interval '2 min', NOW()-interval '30 days'),
    (uuid_generate_v4(), 'QuickNode',   'bsc',      'https://bsc.quicknode.pro/key7',              'wss',  2, true,  'healthy',   NOW()-interval '1 min', NOW()-interval '27 days'),
    (uuid_generate_v4(), 'Ankr',        'bsc',      'https://rpc.ankr.com/bsc/key8',               'http', 3, true,  'healthy',   NOW()-interval '4 min', NOW()-interval '22 days'),
    (uuid_generate_v4(), 'BlockPI',     'bsc',      'https://bsc.blockpi.network/v1/rpc/key9',     'http', 4, true,  'degraded',  NOW()-interval '6 min', NOW()-interval '18 days'),
    (uuid_generate_v4(), 'Moralis',     'bsc',      'https://bsc-mainnet.moralis.io/v1/key10',     'http', 5, false, 'unhealthy', NOW()-interval '15 min',NOW()-interval '10 days'),
    (uuid_generate_v4(), 'GetBlock',    'ethereum', 'https://eth.getblock.io/mainnet/key11',       'http', 6, true,  'healthy',   NOW()-interval '1 min', NOW()-interval '45 days'),
    (uuid_generate_v4(), 'Blast',       'ethereum', 'https://eth-mainnet.blastapi.io/key12',       'http', 7, true,  'healthy',   NOW()-interval '3 min', NOW()-interval '40 days'),
    (uuid_generate_v4(), 'drpc',        'ethereum', 'https://eth.drpc.org/key13',                  'wss',  8, true,  'healthy',   NOW()-interval '2 min', NOW()-interval '35 days'),
    (uuid_generate_v4(), 'Chainstack',  'bsc',      'https://bsc-mainnet.core.chainstack.com/k14', 'http', 6, true,  'healthy',   NOW()-interval '2 min', NOW()-interval '32 days'),
    (uuid_generate_v4(), 'GetBlock',    'bsc',      'https://bsc.getblock.io/mainnet/key15',       'http', 7, true,  'healthy',   NOW()-interval '4 min', NOW()-interval '28 days'),
    (uuid_generate_v4(), 'Blast',       'bsc',      'https://bsc-mainnet.blastapi.io/key16',       'http', 8, false, 'degraded',  NOW()-interval '8 min', NOW()-interval '25 days')
ON CONFLICT DO NOTHING;

-- ===================== 8. DIAGNOSTIC EVENTS (~500) =====================
INSERT INTO diagnostic_events (id, log_type, message, status_code, endpoint, source, timestamp, is_archived)
SELECT
    uuid_generate_v4(),
    (ARRAY['info','info','info','warning','error'])[floor(random()*5)+1],
    (ARRAY[
        'Pipeline batch completed — ' || floor(random()*200+50)::text || ' txns processed',
        'Block sync verified at height #' || (18000000 + n)::text,
        'AI engine inference latency: ' || floor(random()*200+30)::text || 'ms',
        'RPC failover triggered for endpoint #' || floor(random()*10+1)::text,
        'Database connection pool: ' || floor(random()*50+10)::text || ' active / 100 max',
        'WebSocket broadcast to ' || floor(random()*50+5)::text || ' clients',
        'Risk model v2.3 cache refreshed — ' || floor(random()*1000+100)::text || ' entries',
        'API rate limit approaching for org-' || floor(random()*10+1)::text,
        'Memory usage: ' || floor(random()*40+30)::text || '% of allocated',
        'Queue consumer lag: ' || floor(random()*100)::text || ' messages behind'
    ])[floor(random()*10)+1],
    CASE WHEN random() < 0.8 THEN 200
         WHEN random() < 0.9 THEN 408
         ELSE 500 END,
    (ARRAY['/api/v1/scan','/statistics/flow','/api/ops/system/pipeline-metrics',
           '/api/admin/diagnostics/logs','/api/ops/system/slo-metrics',NULL])[floor(random()*6)+1],
    (ARRAY['backend','scanner','ai-engine','event-service','api-gateway'])[floor(random()*5)+1],
    NOW() - (random() * interval '7 days'),
    random() < 0.1
FROM generate_series(1, 500) AS n;

-- ===================== 9. NOTIFICATION EVENTS (~300) =====================
INSERT INTO notification_events (id, channel, recipient, severity, message, status, created_at, sent_at)
SELECT
    uuid_generate_v4(),
    (ARRAY['email','slack','webhook','sms'])[floor(random()*4)+1],
    (ARRAY['admin@sentinel.io','ops-team@sentinel.io','security@sentinel.io',
           '#alerts-channel','#ops-monitoring','https://hooks.example.com/alert'])[floor(random()*6)+1],
    (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[floor(random()*4)+1],
    (ARRAY[
        'High-risk wallet 0x' || lpad(to_hex(floor(random()*999)::int),8,'0') || ' detected with score ' || floor(random()*30+70)::text || '%',
        'Transfer blocked: ' || round((random()*50)::numeric,2)::text || ' ETH to blacklisted address',
        'System health degraded — pipeline latency exceeding SLO',
        'New CRITICAL alert: sandwich attack detected on DEX',
        'Policy rule triggered — review required',
        'Daily risk summary: ' || floor(random()*20+5)::text || ' new high-risk events'
    ])[floor(random()*6)+1],
    (ARRAY['sent','sent','sent','failed','pending'])[floor(random()*5)+1],
    NOW() - (random() * interval '14 days'),
    CASE WHEN random() < 0.85 THEN NOW() - (random() * interval '14 days') ELSE NULL END
FROM generate_series(1, 300) AS n;

-- ===================== 10. PIPELINE METRICS (~500) =====================
INSERT INTO pipeline_metrics (chain, block_number, throughput_tps, ingestion_latency_ms, decode_latency_ms, inserted_at)
SELECT
    (ARRAY['ethereum','bsc'])[floor(random()*2)+1],
    18000000 + n + 5000,
    round((random() * 60 + 15)::numeric, 2),
    floor(random() * 200 + 50)::int,
    floor(random() * 100 + 20)::int,
    NOW() - ((n * 2) * interval '1 minute')
FROM generate_series(1, 500) AS n;

-- ===================== 11. RISK ASSESSMENTS (~400) =====================
INSERT INTO risk_assessments (id, wallet_id, score, risk_level, model_version, feature_count, confidence_score, assessed_at)
SELECT
    uuid_generate_v4(),
    w.id,
    round((random() * 100)::numeric, 2),
    (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[floor(random()*4)+1],
    (ARRAY['v2.1','v2.2','v2.3','v3.0-beta'])[floor(random()*4)+1],
    floor(random() * 30 + 10)::int,
    round((random() * 40 + 60)::numeric, 2),
    NOW() - (random() * interval '30 days')
FROM wallets w
CROSS JOIN generate_series(1, 3) AS rep
ORDER BY random()
LIMIT 400;

-- ===================== 12. POLICY RULES (~10 extra) =====================
INSERT INTO policy_rules (id, rule_name, description, min_risk_score, block_blacklisted, block_suspended, notify_on_block, priority, is_active, created_at)
VALUES
    (uuid_generate_v4(), 'Max Single Transfer',       'Block transfers exceeding 100 ETH to unverified wallets', 75.0, true,  true,  true,  1, true,  NOW()-interval '50 days'),
    (uuid_generate_v4(), 'Rapid Movement Alert',       'Flag wallets moving funds through >5 hops in 1 hour',    60.0, false, false, true,  2, true,  NOW()-interval '45 days'),
    (uuid_generate_v4(), 'Mixer Interaction Block',    'Block any transfer involving known mixer services',       50.0, true,  true,  true,  3, true,  NOW()-interval '40 days'),
    (uuid_generate_v4(), 'Sanctions Compliance',       'Block all interactions with OFAC-sanctioned addresses',   0.0, true,  true,  true,  4, true,  NOW()-interval '60 days'),
    (uuid_generate_v4(), 'Flash Loan Protection',      'Detect and block suspected flash loan attack patterns',  85.0, true,  false, true,  5, true,  NOW()-interval '35 days'),
    (uuid_generate_v4(), 'DEX Manipulation Guard',     'Monitor for sandwich attacks on DEXs',                   70.0, false, false, true,  6, true,  NOW()-interval '30 days'),
    (uuid_generate_v4(), 'Cross-Chain Bridge Monitor', 'Flag large cross-chain transfers for manual review',     65.0, false, false, true,  7, true,  NOW()-interval '25 days'),
    (uuid_generate_v4(), 'Velocity Limit Rule',        'Block if >20 transfers in 10 min from same wallet',     55.0, true,  true,  true,  8, true,  NOW()-interval '20 days'),
    (uuid_generate_v4(), 'Dormant Wallet Activation',  'Alert when dormant wallets (>1yr) suddenly activate',    40.0, false, false, true,  9, true,  NOW()-interval '15 days'),
    (uuid_generate_v4(), 'Whale Movement Tracker',     'Notify on transfers >500 ETH from top-100 wallets',     30.0, false, false, true, 10, true,  NOW()-interval '10 days')
ON CONFLICT DO NOTHING;

-- ===================== REPORT RESULTS =====================
SELECT 'wallets' as tbl, COUNT(*) FROM wallets
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'blocked_transfers', COUNT(*) FROM blocked_transfers
UNION ALL SELECT 'money_flow_snapshots', COUNT(*) FROM money_flow_snapshots
UNION ALL SELECT 'pipeline_metrics', COUNT(*) FROM pipeline_metrics
UNION ALL SELECT 'diagnostic_events', COUNT(*) FROM diagnostic_events
UNION ALL SELECT 'blacklist', COUNT(*) FROM blacklist
UNION ALL SELECT 'node_endpoints', COUNT(*) FROM node_endpoints
UNION ALL SELECT 'notification_events', COUNT(*) FROM notification_events
UNION ALL SELECT 'risk_assessments', COUNT(*) FROM risk_assessments
UNION ALL SELECT 'policy_rules', COUNT(*) FROM policy_rules
ORDER BY tbl;
