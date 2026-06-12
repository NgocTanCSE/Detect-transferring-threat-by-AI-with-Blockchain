-- =============================================
-- COMPREHENSIVE OPERATIONAL DATA SEED
-- Matches the OLD system's data volume
-- =============================================

-- POLICY RULES (10 rules)
INSERT INTO policy_rules (rule_name, description, min_risk_score, block_blacklisted, block_suspended, notify_on_block, priority, is_active)
VALUES 
('HIGH_RISK_BLOCK', 'Block transactions from wallets with risk score >= 90', 90.0, true, true, true, 10, true),
('BLACKLIST_BLOCK', 'Block all transactions involving blacklisted addresses', 0.0, true, false, true, 5, true),
('SUSPENDED_WARN', 'Warn on transactions from suspended accounts', 50.0, false, true, true, 20, true),
('LARGE_TX_REVIEW', 'Flag transactions over 100 ETH for manual review', 60.0, true, true, true, 15, true),
('RAPID_FIRE_DETECT', 'Detect rapid sequential transactions (>10 in 1 minute)', 70.0, true, true, true, 12, true),
('CROSS_CHAIN_MONITOR', 'Monitor cross-chain bridge transactions', 40.0, false, false, true, 30, true),
('NEW_WALLET_CAUTION', 'Extra scrutiny for wallets less than 7 days old', 30.0, false, false, true, 25, true),
('MIXER_DETECTION', 'Detect interactions with known mixing services', 85.0, true, true, true, 8, true),
('WHALE_ALERT', 'Alert on transactions from top 100 wallets by volume', 20.0, false, false, true, 40, true),
('DORMANT_REACTIVATION', 'Flag dormant wallets (>1 year inactive) that resume activity', 55.0, false, false, true, 35, true)
ON CONFLICT (rule_name) DO NOTHING;

-- MODEL REGISTRY (8 models like the old system)
INSERT INTO model_registry (model_name, version, artifact_uri, framework, is_active, promoted_at)
VALUES 
('risk_model', 'v2.1.0', 's3://production-models/risk_model/v2.1.0.pkl', 'pkl', true, NOW() - interval '5 days'),
('fraud_detector', 'v1.5.0', 's3://production-models/fraud_detector/v1.5.0.pkl', 'pkl', true, NOW() - interval '3 days'),
('anomaly_detector', 'v1.2.0', 's3://production-models/anomaly_detector/v1.2.0.onnx', 'onnx', true, NOW() - interval '10 days'),
('graph_analyzer', 'v3.0.1', 's3://production-models/graph_analyzer/v3.0.1.pkl', 'pkl', false, NOW() - interval '20 days'),
('tx_classifier', 'v2.0.0', 's3://production-models/tx_classifier/v2.0.0.pkl', 'pkl', true, NOW() - interval '7 days'),
('money_laundering_detector', 'v1.8.0', 's3://production-models/ml_detector/v1.8.0.pkl', 'pkl', true, NOW() - interval '2 days'),
('scam_predictor', 'v1.3.0', 's3://production-models/scam_predictor/v1.3.0.pkl', 'pkl', false, NOW() - interval '30 days'),
('manipulation_detector', 'v2.2.0', 's3://production-models/manipulation_detector/v2.2.0.onnx', 'onnx', true, NOW() - interval '1 day');

-- NODE ENDPOINTS (120 endpoints like the old system)
DO $$
DECLARE
  providers TEXT[] := ARRAY['Alchemy', 'Infura', 'QuickNode', 'Ankr', 'Lava', 'Blast', 'Bware', 'Chainstack'];
  chains TEXT[] := ARRAY['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc'];
  protocols TEXT[] := ARRAY['http', 'websocket'];
  statuses TEXT[] := ARRAY['healthy', 'healthy', 'healthy', 'degraded', 'down', 'healthy'];
  i INTEGER;
BEGIN
  FOR i IN 1..120 LOOP
    INSERT INTO node_endpoints (provider_name, chain, endpoint_url, protocol, priority, is_active, health_status, last_checked_at)
    VALUES (
      providers[1 + (i % array_length(providers, 1))],
      chains[1 + (i % array_length(chains, 1))],
      'https://' || chains[1 + (i % array_length(chains, 1))] || '-' || i || '.local-mesh.io/rpc',
      protocols[1 + (i % array_length(protocols, 1))],
      10 + (i % 50),
      true,
      statuses[1 + (i % array_length(statuses, 1))],
      NOW() - (i % 60) * interval '1 minute'
    );
  END LOOP;
END $$;

-- PIPELINE METRICS (500 data points)
DO $$
DECLARE
  chains TEXT[] := ARRAY['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc'];
  i INTEGER;
BEGIN
  FOR i IN 1..500 LOOP
    INSERT INTO pipeline_metrics (chain, block_number, throughput_tps, ingestion_latency_ms, decode_latency_ms, inserted_at)
    VALUES (
      chains[1 + (i % array_length(chains, 1))],
      18000000 + i * 11,
      ROUND((42.5 + (i % 12) * 3.1)::numeric, 2),
      150 + (i % 15) * 12,
      200 + (i % 18) * 15,
      NOW() - i * interval '5 minutes'
    );
  END LOOP;
END $$;

-- FEATURE STORE CONFIGS (110 features)
DO $$
DECLARE
  i INTEGER;
  fkey TEXT;
  expr TEXT;
  expressions TEXT[] := ARRAY[
    'SUM(value) / 30',
    'COUNT(DISTINCT counterparty) > 5',
    'risk_score * 1.1',
    'CASE WHEN gas > 50000 THEN 1 ELSE 0 END',
    'LAG(timestamp) OVER (PARTITION BY wallet ORDER BY timestamp)'
  ];
BEGIN
  FOR i IN 1..110 LOOP
    fkey := 'feature_' || lpad(i::text, 3, '0');
    expr := expressions[1 + (i % array_length(expressions, 1))];
    INSERT INTO feature_store_configs (feature_key, enabled, expression)
    VALUES (fkey, i % 5 != 0, expr)
    ON CONFLICT (feature_key) DO NOTHING;
  END LOOP;
END $$;

-- DIAGNOSTIC EVENTS (250 events)
DO $$
DECLARE
  i INTEGER;
  types TEXT[] := ARRAY['INFO', 'ERROR', 'WARNING', 'SUCCESS', 'DEBUG'];
  sources TEXT[] := ARRAY['api', 'scanner', 'backend'];
  msgs TEXT[] := ARRAY[
    'User login successful',
    'Timeout while contacting inference service',
    'Block scan completed',
    'Unauthorized policy update attempt',
    'New suspicious transaction flagged',
    'Node endpoint check status: healthy',
    'Database connection pool exhausted',
    'Broadcasted alerts to active analysts',
    'Ingested raw block data',
    'Model promoted to production'
  ];
BEGIN
  FOR i IN 1..250 LOOP
    INSERT INTO diagnostic_events (id, log_type, message, details, status_code, endpoint, source, is_archived, timestamp)
    VALUES (
      uuid_generate_v4(),
      types[1 + (i % array_length(types, 1))],
      msgs[1 + (i % array_length(msgs, 1))],
      jsonb_build_object('source', sources[1 + (i % array_length(sources, 1))], 'index', i),
      CASE WHEN i % 5 = 1 THEN 500 ELSE 200 END,
      '/api/v1/endpoint/' || i,
      sources[1 + (i % array_length(sources, 1))],
      i % 25 = 0,
      NOW() - i * interval '3 minutes'
    );
  END LOOP;
END $$;

-- NOTIFICATION EVENTS (200 notifications)
DO $$
DECLARE
  i INTEGER;
  channels TEXT[] := ARRAY['email', 'slack', 'webhook', 'sms'];
  severities TEXT[] := ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  statuses TEXT[] := ARRAY['queued', 'sent', 'delivered', 'failed'];
BEGIN
  FOR i IN 1..200 LOOP
    INSERT INTO notification_events (id, channel, recipient, severity, message, status, created_at)
    VALUES (
      uuid_generate_v4(),
      channels[1 + (i % array_length(channels, 1))],
      'analyst_' || (i % 20) || '@security.local',
      severities[1 + (i % array_length(severities, 1))],
      'Alert notification #' || i || ' - Risk level elevated',
      statuses[1 + (i % array_length(statuses, 1))],
      NOW() - i * interval '5 minutes'
    );
  END LOOP;
END $$;

VACUUM ANALYZE;
