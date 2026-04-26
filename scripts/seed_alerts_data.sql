INSERT INTO alerts (id, wallet_address, alert_type, severity, message, risk_score, detected_at, chain_id)
VALUES 
(uuid_generate_v4(), '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'Money Laundering', 'HIGH', 'Large rapid transfers detected', 85.5, NOW(), 'ethereum'),
(uuid_generate_v4(), '0x2142421e3e46808ec1b95184e0d0434dbd7253a4', 'Scam', 'MEDIUM', 'Address reported in community blacklist', 65.0, NOW(), 'ethereum'),
(uuid_generate_v4(), '0xca985303d1d0d20ac23c714ab50dadcc3c9578cb', 'Manipulation', 'HIGH', 'Wash trading pattern detected', 92.0, NOW(), 'ethereum');
