-- Seed Node Endpoints for System Admin Dashboard
INSERT INTO node_endpoints (provider_name, chain, endpoint_url, protocol, priority, is_active, health_status, last_checked_at)
VALUES 
('Alchemy', 'ethereum', 'https://eth-mainnet.g.alchemy.com/v2/demo', 'http', 10, true, 'healthy', NOW()),
('Infura', 'ethereum', 'https://mainnet.infura.io/v3/demo', 'http', 20, true, 'healthy', NOW()),
('QuickNode', 'polygon', 'https://polygon-mainnet.quiknode.pro/demo', 'http', 30, true, 'healthy', NOW()),
('Ankr', 'bsc', 'https://rpc.ankr.com/bsc', 'http', 40, true, 'degraded', NOW());

-- Seed Pipeline Metrics
INSERT INTO pipeline_metrics (chain, block_number, throughput_tps, ingestion_latency_ms, decode_latency_ms, inserted_at)
VALUES 
('ethereum', 18000000, 45.5, 120, 180, NOW()),
('ethereum', 18000001, 48.2, 115, 175, NOW() - interval '1 minute'),
('polygon', 50000000, 150.0, 50, 80, NOW()),
('bsc', 35000000, 85.5, 90, 110, NOW());

-- Seed Model Registry
INSERT INTO model_registry (model_name, version, artifact_uri, framework, is_active, promoted_at)
VALUES 
('risk_model', 'v2.1.0', 's3://models/risk_model/v2.1.0.pkl', 'pkl', true, NOW()),
('fraud_detector', 'v1.5.0', 's3://models/fraud/v1.5.0.pkl', 'pkl', true, NOW());
