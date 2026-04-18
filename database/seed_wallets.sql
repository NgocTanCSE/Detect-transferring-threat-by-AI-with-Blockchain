-- ==========================================
-- Seed Script: Test Wallets with Real Data
-- Creates test wallets with actual ETH balances
-- ==========================================

-- Clear existing test data (optional)
-- DELETE FROM blocked_transfers WHERE sender_address IN ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e');
-- DELETE FROM transactions WHERE from_address IN ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e') OR to_address IN ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e');
-- DELETE FROM wallets WHERE address IN ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e');

-- Insert test wallets with proper UUIDs
INSERT INTO wallets (
    id, address, label, entity_type, account_status, risk_score, risk_category,
    total_transactions, total_value_sent, total_value_received, first_seen_at, last_activity_at,
    created_at, updated_at
) VALUES
-- Wallet 1: Clean user account with 10 ETH
(
    '550e8400-e29b-41d4-a716-446655440001'::UUID,
    '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08',
    'Alice User Account',
    'User',
    'active',
    15.5,
    NULL,
    5,
    1000000000000000000,  -- 1 ETH sent
    11000000000000000000, -- 11 ETH received
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Wallet 2: Moderately risky account
(
    '550e8400-e29b-41d4-a716-446655440002'::UUID,
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    'Bob Suspected Account',
    'User',
    'active',
    62.3,
    'manipulation',
    12,
    3500000000000000000, -- 3.5 ETH sent
    5200000000000000000, -- 5.2 ETH received
    CURRENT_TIMESTAMP - INTERVAL '60 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Wallet 3: Clean account with more activity
(
    '550e8400-e29b-41d4-a716-446655440003'::UUID,
    '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e',
    'Charlie Trading Account',
    'User',
    'active',
    28.7,
    NULL,
    22,
    8500000000000000000,  -- 8.5 ETH sent
    15000000000000000000, -- 15 ETH received
    CURRENT_TIMESTAMP - INTERVAL '90 days',
    CURRENT_TIMESTAMP - INTERVAL '4 hours',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Wallet 4: Blacklisted account
(
    '550e8400-e29b-41d4-a716-446655440004'::UUID,
    '0xDead1000000000000000000000000000000Dead',
    'Scam Wallet',
    'Unknown',
    'frozen',
    99.8,
    'scam',
    145,
    95000000000000000000, -- 95 ETH sent
    2000000000000000000,  -- 2 ETH received
    CURRENT_TIMESTAMP - INTERVAL '200 days',
    CURRENT_TIMESTAMP - INTERVAL '7 days',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (address) DO NOTHING;

-- Insert test transactions to create real ETH balances
-- Transaction 1: Genesis transfer to Alice (10 ETH)
INSERT INTO transactions (
    id, tx_hash, block_number, timestamp, from_address, to_address,
    value, gas_price, gas_used, input_data, status, created_at
) VALUES (
    '650e8400-e29b-41d4-a716-446655440001'::UUID,
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    18000000,
    CURRENT_TIMESTAMP - INTERVAL '30 days',
    '0x0000000000000000000000000000000000000000',
    '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08',
    10000000000000000000, -- 10 ETH
    20000000000,
    21000,
    '0x',
    1,
    CURRENT_TIMESTAMP - INTERVAL '30 days'
)
ON CONFLICT DO NOTHING;

-- Transaction 2: Alice sends 1 ETH to Bob
INSERT INTO transactions (
    id, tx_hash, block_number, timestamp, from_address, to_address,
    value, gas_price, gas_used, input_data, status, created_at
) VALUES (
    '650e8400-e29b-41d4-a716-446655440002'::UUID,
    '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    18000100,
    CURRENT_TIMESTAMP - INTERVAL '29 days',
    '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08',
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    1000000000000000000, -- 1 ETH
    20000000000,
    21000,
    '0x',
    1,
    CURRENT_TIMESTAMP - INTERVAL '29 days'
)
ON CONFLICT DO NOTHING;

-- Transaction 3: Genesis transfer to Bob (5.2 ETH)
INSERT INTO transactions (
    id, tx_hash, block_number, timestamp, from_address, to_address,
    value, gas_price, gas_used, input_data, status, created_at
) VALUES (
    '650e8400-e29b-41d4-a716-446655440003'::UUID,
    '0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    18000200,
    CURRENT_TIMESTAMP - INTERVAL '28 days',
    '0x0000000000000000000000000000000000000000',
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    5200000000000000000, -- 5.2 ETH
    20000000000,
    21000,
    '0x',
    1,
    CURRENT_TIMESTAMP - INTERVAL '28 days'
)
ON CONFLICT DO NOTHING;

-- Transaction 4: Genesis transfer to Charlie (15 ETH)
INSERT INTO transactions (
    id, tx_hash, block_number, timestamp, from_address, to_address,
    value, gas_price, gas_used, input_data, status, created_at
) VALUES (
    '650e8400-e29b-41d4-a716-446655440004'::UUID,
    '0x4234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    18000300,
    CURRENT_TIMESTAMP - INTERVAL '90 days',
    '0x0000000000000000000000000000000000000000',
    '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e',
    15000000000000000000, -- 15 ETH
    20000000000,
    21000,
    '0x',
    1,
    CURRENT_TIMESTAMP - INTERVAL '90 days'
)
ON CONFLICT DO NOTHING;

-- Transaction 5: Charlie receives 3.5 ETH more
INSERT INTO transactions (
    id, tx_hash, block_number, timestamp, from_address, to_address,
    value, gas_price, gas_used, input_data, status, created_at
) VALUES (
    '650e8400-e29b-41d4-a716-446655440005'::UUID,
    '0x5234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    18000400,
    CURRENT_TIMESTAMP - INTERVAL '60 days',
    '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e',
    3500000000000000000, -- 3.5 ETH
    20000000000,
    21000,
    '0x',
    1,
    CURRENT_TIMESTAMP - INTERVAL '60 days'
)
ON CONFLICT DO NOTHING;

-- Add blacklist entry for scam wallet
INSERT INTO blacklist (address, category, source, severity, is_active, reported_at)
VALUES (
    '0xDead1000000000000000000000000000000Dead',
    'scam',
    'Internal Detection',
    'CRITICAL',
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (address) DO NOTHING;

-- Summary: Test Wallet Balances
-- Alice: 10 ETH (received) - 1 ETH (sent) = 9 ETH available
-- Bob: 5.2 ETH (received) + 1 ETH (received from Alice) - 3.5 ETH (sent) = 2.7 ETH available
-- Charlie: 15 ETH (received) + 3.5 ETH (received) - 8.5 ETH (sent) = 10 ETH available
-- Scam Wallet: Frozen account, blacklisted

COMMIT;

-- Query to verify balances
SELECT
    w.address,
    w.label,
    w.account_status,
    w.risk_score,
    COALESCE(SUM(CASE WHEN t.to_address = w.address THEN t.value ELSE 0 END), 0)::BIGINT as total_received,
    COALESCE(SUM(CASE WHEN t.from_address = w.address THEN t.value ELSE 0 END), 0)::BIGINT as total_sent,
    (COALESCE(SUM(CASE WHEN t.to_address = w.address THEN t.value ELSE 0 END), 0) -
     COALESCE(SUM(CASE WHEN t.from_address = w.address THEN t.value ELSE 0 END), 0))::BIGINT as balance_wei,
    ((COALESCE(SUM(CASE WHEN t.to_address = w.address THEN t.value ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.from_address = w.address THEN t.value ELSE 0 END), 0))::NUMERIC / 1e18)::DECIMAL(20,4) as balance_eth
FROM wallets w
LEFT JOIN transactions t ON (t.from_address = w.address OR t.to_address = w.address)
WHERE w.address IN ('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', '0x9f8c5e6F5e6E1e1E1e1e1e1e1e1e1e1e1e1e1e1e', '0xDead1000000000000000000000000000000Dead')
GROUP BY w.id, w.address, w.label, w.account_status, w.risk_score
ORDER BY w.address;
