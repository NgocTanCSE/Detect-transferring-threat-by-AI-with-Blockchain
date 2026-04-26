-- ALERTS (150 alerts matching old system volume)
DO $$
DECLARE
  i INTEGER;
  alert_types TEXT[] := ARRAY['Money Laundering', 'Scam', 'Manipulation', 'Phishing', 'Wash Trading', 'Rug Pull', 'Flash Loan Attack'];
  severities TEXT[] := ARRAY['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  messages TEXT[] := ARRAY[
    'Large rapid transfers detected from flagged wallet',
    'Address reported in community blacklist',
    'Wash trading pattern detected in token pair',
    'Suspicious contract interaction from known phishing address',
    'Circular transaction pattern identified',
    'Anomalous fund movement exceeding historical baseline',
    'Multiple small deposits followed by single large withdrawal',
    'Contract interaction with unverified proxy',
    'Cross-chain bridge usage with mixer service',
    'Rapid token swaps across multiple DEXs'
  ];
  addr TEXT;
BEGIN
  FOR i IN 1..150 LOOP
    addr := '0x' || lpad(to_hex(1000000 + i), 40, '0');
    INSERT INTO alerts (id, wallet_address, alert_type, severity, message, risk_score, detected_at, chain_id)
    VALUES (
      uuid_generate_v4(),
      addr,
      alert_types[1 + (i % array_length(alert_types, 1))],
      severities[1 + (i % array_length(severities, 1))],
      messages[1 + (i % array_length(messages, 1))],
      30.0 + (i % 70),
      NOW() - i * interval '20 minutes',
      CASE WHEN i % 3 = 0 THEN 'polygon' WHEN i % 3 = 1 THEN 'bsc' ELSE 'ethereum' END
    );
  END LOOP;
END $$;

VACUUM ANALYZE alerts;
