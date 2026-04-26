-- =====================================================
-- COMPREHENSIVE DEMO DATA FOR BLOCKCHAIN AI PROJECT
-- Run after init.sql to populate realistic test data
-- =====================================================



-- Delete existing demo data (for clean re-seeding)
DELETE FROM blocked_transfers;

DO $$
BEGIN
    IF to_regclass('public.user_warnings') IS NOT NULL THEN
        DELETE FROM user_warnings;
    END IF;
END $$;

DELETE FROM alerts;

DO $$
BEGIN
    IF to_regclass('public.token_transfers') IS NOT NULL THEN
        DELETE FROM token_transfers;
    END IF;
END $$;

DELETE FROM transactions
WHERE
    tx_hash LIKE 'demo_%'
    OR tx_hash LIKE '0xdemo%';

DO $$
BEGIN
    IF to_regclass('public.risk_assessments') IS NOT NULL THEN
        DELETE FROM risk_assessments;
    END IF;
END $$;

-- =====================================================
-- REAL ETHEREUM ADDRESSES (from Etherscan - verified)
-- =====================================================

-- Update users with real-looking addresses
UPDATE users
SET
    wallet_address = '0x742d35cc6634c0532925a3b844bc454e4438f44e'
WHERE
    username = 'alice_nguyen';

UPDATE users
SET
    wallet_address = '0x8ba1f109551bd432803012645ac136ddd64dba72'
WHERE
    username = 'bob_tran';

-- Delete and re-insert wallets with real addresses
DELETE FROM wallets;

-- Regular User Wallets (Low Risk)
INSERT INTO
    wallets (
        address,
        label,
        entity_type,
        account_status,
        risk_score,
        risk_category,
        total_transactions,
        total_value_sent,
        total_value_received,
        first_seen_at,
        last_activity_at,
        notes
    )
VALUES (
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        'Alice Personal Wallet',
        'Individual',
        'active',
        5.00,
        NULL,
        127,
        4500000000000000000,
        5200000000000000000,
        '2023-03-15 08:30:00+00',
        NOW() - INTERVAL '1 hour',
        'Regular user, consistent trading patterns'
    ),
    (
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        'Bob Trading Account',
        'Individual',
        'active',
        12.00,
        NULL,
        89,
        2800000000000000000,
        3100000000000000000,
        '2023-06-22 14:15:00+00',
        NOW() - INTERVAL '2 hours',
        'Active trader, verified identity'
    ),
    (
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        'Vitalik Buterin',
        'Individual',
        'active',
        3.00,
        NULL,
        5240,
        7250000000000000000,
        8800000000000000000,
        '2015-07-30 00:00:00+00',
        NOW() - INTERVAL '30 minutes',
        'Verified public figure'
    ),
    (
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        'Exchange Hot Wallet',
        'Exchange',
        'active',
        8.00,
        NULL,
        892345,
        8900000000000000000,
        9000000000000000000,
        '2018-01-15 00:00:00+00',
        NOW() - INTERVAL '5 minutes',
        'High volume legitimate exchange'
    );

-- Known Hacker Wallets (Critical Risk - Real addresses from public databases)
INSERT INTO
    wallets (
        address,
        label,
        entity_type,
        account_status,
        risk_score,
        risk_category,
        total_transactions,
        first_seen_at,
        last_activity_at,
        flagged_at,
        flagged_by,
        notes
    )
VALUES (
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        'Ronin Bridge Exploiter',
        'Hacker',
        'frozen',
        99.00,
        'scam',
        2341,
        '2022-03-23 00:00:00+00',
        NOW() - INTERVAL '12 hours',
        NOW() - INTERVAL '30 days',
        'OFAC',
        'OFAC sanctioned - $625M Ronin Network hack'
    ),
    (
        '0x53b6936513e738f44fb50d2b9476730c0ab3bfc1',
        'Lazarus Group Wallet 1',
        'Hacker',
        'frozen',
        98.00,
        'scam',
        156,
        '2022-01-10 00:00:00+00',
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '60 days',
        'FBI',
        'North Korea state-sponsored hacking group'
    ),
    (
        '0x8589427373d6d84e98730d7795d8f6f8731fda16',
        'Tornado Cash Depositor',
        'Mixer',
        'frozen',
        95.00,
        'money_laundering',
        4521,
        '2020-05-15 00:00:00+00',
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '90 days',
        'OFAC',
        'OFAC sanctioned mixer usage'
    );

-- Money Laundering Wallets (High Risk - Suspicious patterns)
INSERT INTO
    wallets (
        address,
        label,
        entity_type,
        account_status,
        risk_score,
        risk_category,
        total_transactions,
        first_seen_at,
        last_activity_at,
        flagged_at,
        flagged_by,
        notes
    )
VALUES (
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        'Structuring Hub Alpha',
        'Suspicious',
        'suspended',
        92.00,
        'money_laundering',
        1523,
        '2024-01-15 10:30:00+00',
        NOW() - INTERVAL '3 hours',
        NOW() - INTERVAL '7 days',
        'AI_SCANNER',
        'Detected structuring pattern: multiple $9,900 transfers'
    ),
    (
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        'Layering Node Beta',
        'Suspicious',
        'suspended',
        88.00,
        'money_laundering',
        847,
        '2024-02-20 16:45:00+00',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '5 days',
        'AI_SCANNER',
        'Connected to sanctioned mixer'
    ),
    (
        '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
        'Integration Point Gamma',
        'Suspicious',
        'under_review',
        85.00,
        'money_laundering',
        234,
        '2024-03-05 09:20:00+00',
        NOW() - INTERVAL '30 minutes',
        NOW() - INTERVAL '2 days',
        'AI_SCANNER',
        'Final integration step before CEX deposit'
    ),
    (
        '0x2fc617e933a52713247ce25730f6695920b3befe',
        'Smurfing Wallet A',
        'Suspicious',
        'suspended',
        90.00,
        'money_laundering',
        1876,
        '2024-01-08 11:00:00+00',
        NOW() - INTERVAL '4 hours',
        NOW() - INTERVAL '10 days',
        'AI_SCANNER',
        'High volume small transactions pattern'
    ),
    (
        '0x4b0f1812e5df2a09796481ff14017e6005508003',
        'Chain Hopping Node',
        'Suspicious',
        'suspended',
        87.00,
        'money_laundering',
        312,
        '2024-02-28 13:15:00+00',
        NOW() - INTERVAL '2 hours',
        NOW() - INTERVAL '4 days',
        'AI_SCANNER',
        'Cross-chain bridge abuse detected'
    ),
    (
        '0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3',
        'Peeling Chain Wallet',
        'Suspicious',
        'under_review',
        82.00,
        'money_laundering',
        2134,
        '2024-03-18 07:45:00+00',
        NOW() - INTERVAL '45 minutes',
        NOW() - INTERVAL '1 day',
        'AI_SCANNER',
        'Classic peeling chain pattern'
    );

-- Market Manipulation Wallets
INSERT INTO
    wallets (
        address,
        label,
        entity_type,
        account_status,
        risk_score,
        risk_category,
        total_transactions,
        first_seen_at,
        last_activity_at,
        flagged_at,
        flagged_by,
        notes
    )
VALUES (
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        'Wash Trader Alpha',
        'Manipulator',
        'suspended',
        94.00,
        'manipulation',
        15678,
        '2024-02-14 08:00:00+00',
        NOW() - INTERVAL '15 minutes',
        NOW() - INTERVAL '3 days',
        'AI_SCANNER',
        'Self-trading loop detected: A→B→C→A pattern'
    ),
    (
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        'Pump Dump Operator',
        'Manipulator',
        'frozen',
        96.00,
        'manipulation',
        8934,
        '2024-03-01 12:00:00+00',
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '15 days',
        'SEC_REPORT',
        'Coordinated pump scheme on low-cap tokens'
    );

-- =====================================================
-- TRANSACTIONS (Last 7 days of realistic activity)
-- =====================================================

-- Day 7 (7 days ago) - Money laundering activity
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_001',
        19500000,
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        8900000000000000000,
        20000000000,
        21000,
        NOW() - INTERVAL '7 days' + INTERVAL '2 hours',
        1,
        true,
        'structuring'
    ),
    (
        'demo_tx_002',
        19500010,
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
        8850000000000000000,
        20000000000,
        21000,
        NOW() - INTERVAL '7 days' + INTERVAL '3 hours',
        1,
        true,
        'structuring'
    ),
    (
        'demo_tx_003',
        19500020,
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        '0x2fc617e933a52713247ce25730f6695920b3befe',
        4500000000000000000,
        22000000000,
        21000,
        NOW() - INTERVAL '7 days' + INTERVAL '5 hours',
        1,
        true,
        'layering'
    ),
    (
        'demo_tx_004',
        19500030,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        1500000000000000000,
        18000000000,
        21000,
        NOW() - INTERVAL '7 days' + INTERVAL '8 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_005',
        19500040,
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        2300000000000000000,
        19000000000,
        21000,
        NOW() - INTERVAL '7 days' + INTERVAL '10 hours',
        1,
        false,
        NULL
    );

-- Day 6
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_006',
        19507000,
        '0x2fc617e933a52713247ce25730f6695920b3befe',
        '0x4b0f1812e5df2a09796481ff14017e6005508003',
        8200000000000000000,
        21000000000,
        21000,
        NOW() - INTERVAL '6 days' + INTERVAL '1 hour',
        1,
        true,
        'layering'
    ),
    (
        'demo_tx_007',
        19507010,
        '0x4b0f1812e5df2a09796481ff14017e6005508003',
        '0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3',
        7800000000000000000,
        21500000000,
        21000,
        NOW() - INTERVAL '6 days' + INTERVAL '4 hours',
        1,
        true,
        'layering'
    ),
    (
        'demo_tx_008',
        19507020,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        500000000000000000,
        17000000000,
        21000,
        NOW() - INTERVAL '6 days' + INTERVAL '6 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_009',
        19507030,
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        3200000000000000000,
        18500000000,
        21000,
        NOW() - INTERVAL '6 days' + INTERVAL '9 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_010',
        19507040,
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        1000000000000000000,
        19000000000,
        21000,
        NOW() - INTERVAL '6 days' + INTERVAL '12 hours',
        1,
        false,
        NULL
    );

-- Day 5
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_011',
        19514000,
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        8250000000000000000,
        25000000000,
        21000,
        NOW() - INTERVAL '5 days' + INTERVAL '2 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_012',
        19514010,
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        8240000000000000000,
        25500000000,
        21000,
        NOW() - INTERVAL '5 days' + INTERVAL '3 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_013',
        19514020,
        '0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        7200000000000000000,
        20000000000,
        21000,
        NOW() - INTERVAL '5 days' + INTERVAL '6 hours',
        1,
        true,
        'integration'
    ),
    (
        'demo_tx_014',
        19514030,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        800000000000000000,
        17500000000,
        21000,
        NOW() - INTERVAL '5 days' + INTERVAL '10 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_015',
        19514040,
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        650000000000000000,
        18000000000,
        21000,
        NOW() - INTERVAL '5 days' + INTERVAL '14 hours',
        1,
        false,
        NULL
    );

-- Day 4
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_016',
        19521000,
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        '0x53b6936513e738f44fb50d2b9476730c0ab3bfc1',
        8500000000000000000,
        30000000000,
        21000,
        NOW() - INTERVAL '4 days' + INTERVAL '1 hour',
        1,
        true,
        'hacker_transfer'
    ),
    (
        'demo_tx_017',
        19521010,
        '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        4800000000000000000,
        22000000000,
        21000,
        NOW() - INTERVAL '4 days' + INTERVAL '5 hours',
        1,
        true,
        'reverse_layering'
    ),
    (
        'demo_tx_018',
        19521020,
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        2100000000000000000,
        17000000000,
        21000,
        NOW() - INTERVAL '4 days' + INTERVAL '8 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_019',
        19521030,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        350000000000000000,
        16500000000,
        21000,
        NOW() - INTERVAL '4 days' + INTERVAL '12 hours',
        1,
        false,
        NULL
    );

-- Day 3
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_020',
        19528000,
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        '0x8589427373d6d84e98730d7795d8f6f8731fda16',
        8500000000000000000,
        28000000000,
        21000,
        NOW() - INTERVAL '3 days' + INTERVAL '3 hours',
        1,
        true,
        'mixer_deposit'
    ),
    (
        'demo_tx_021',
        19528010,
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        8800000000000000000,
        24000000000,
        21000,
        NOW() - INTERVAL '3 days' + INTERVAL '6 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_022',
        19528020,
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        8750000000000000000,
        24500000000,
        21000,
        NOW() - INTERVAL '3 days' + INTERVAL '7 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_023',
        19528030,
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        1800000000000000000,
        18000000000,
        21000,
        NOW() - INTERVAL '3 days' + INTERVAL '10 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_024',
        19528040,
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        5500000000000000000,
        19500000000,
        21000,
        NOW() - INTERVAL '3 days' + INTERVAL '15 hours',
        1,
        false,
        NULL
    );

-- Day 2
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_025',
        19535000,
        '0x2fc617e933a52713247ce25730f6695920b3befe',
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        6500000000000000000,
        22000000000,
        21000,
        NOW() - INTERVAL '2 days' + INTERVAL '2 hours',
        1,
        true,
        'consolidation'
    ),
    (
        'demo_tx_026',
        19535010,
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
        5200000000000000000,
        21000000000,
        21000,
        NOW() - INTERVAL '2 days' + INTERVAL '4 hours',
        1,
        true,
        'layering'
    ),
    (
        'demo_tx_027',
        19535020,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        420000000000000000,
        17000000000,
        21000,
        NOW() - INTERVAL '2 days' + INTERVAL '8 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_028',
        19535030,
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        8900000000000000000,
        20000000000,
        21000,
        NOW() - INTERVAL '2 days' + INTERVAL '11 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_029',
        19535040,
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        1350000000000000000,
        18500000000,
        21000,
        NOW() - INTERVAL '2 days' + INTERVAL '16 hours',
        1,
        false,
        NULL
    );

-- Day 1 (Yesterday)
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_030',
        19542000,
        '0x4b0f1812e5df2a09796481ff14017e6005508003',
        '0x2fc617e933a52713247ce25730f6695920b3befe',
        3800000000000000000,
        23000000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '1 hour',
        1,
        true,
        'chain_hopping'
    ),
    (
        'demo_tx_031',
        19542010,
        '0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3',
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        4100000000000000000,
        22500000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '3 hours',
        1,
        true,
        'peeling'
    ),
    (
        'demo_tx_032',
        19542020,
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        7600000000000000000,
        26000000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '5 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_033',
        19542030,
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        7550000000000000000,
        26500000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '6 hours',
        1,
        true,
        'wash_trading'
    ),
    (
        'demo_tx_034',
        19542040,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        2200000000000000000,
        18000000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '9 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_035',
        19542050,
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        4800000000000000000,
        19000000000,
        21000,
        NOW() - INTERVAL '1 day' + INTERVAL '14 hours',
        1,
        false,
        NULL
    );

-- Today
INSERT INTO
    transactions (
        tx_hash,
        block_number,
        from_address,
        to_address,
        value,
        gas_price,
        gas_used,
        timestamp,
        status,
        is_flagged,
        flag_reason
    )
VALUES (
        'demo_tx_036',
        19549000,
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        8200000000000000000,
        24000000000,
        21000,
        NOW() - INTERVAL '8 hours',
        1,
        true,
        'structuring'
    ),
    (
        'demo_tx_037',
        19549010,
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
        7800000000000000000,
        23500000000,
        21000,
        NOW() - INTERVAL '6 hours',
        1,
        true,
        'layering'
    ),
    (
        'demo_tx_038',
        19549020,
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        750000000000000000,
        17500000000,
        21000,
        NOW() - INTERVAL '4 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_039',
        19549030,
        '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        8500000000000000000,
        20000000000,
        21000,
        NOW() - INTERVAL '2 hours',
        1,
        false,
        NULL
    ),
    (
        'demo_tx_040',
        19549040,
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        380000000000000000,
        16500000000,
        21000,
        NOW() - INTERVAL '1 hour',
        1,
        false,
        NULL
    );

-- =====================================================
-- ALERTS (Generated by AI Scanner)
-- =====================================================

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
        acknowledged
    )
VALUES
    -- Critical Alerts
    (
        uuid_generate_v4 (),
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        'OFAC_SANCTIONED',
        'CRITICAL',
        'Wallet on OFAC sanctions list - Ronin Bridge Exploiter',
        99.00,
        '{"source": "OFAC", "sanction_date": "2022-04-14"}',
        NOW() - INTERVAL '30 days',
        false
    ),
    (
        uuid_generate_v4 (),
        '0x53b6936513e738f44fb50d2b9476730c0ab3bfc1',
        'STATE_ACTOR',
        'CRITICAL',
        'Wallet linked to Lazarus Group (DPRK)',
        98.00,
        '{"source": "FBI", "threat_level": "nation_state"}',
        NOW() - INTERVAL '25 days',
        false
    ),
    (
        uuid_generate_v4 (),
        '0x8589427373d6d84e98730d7795d8f6f8731fda16',
        'MIXER_USAGE',
        'CRITICAL',
        'Tornado Cash interaction detected',
        95.00,
        '{"mixer": "tornado_cash", "deposit_count": 15}',
        NOW() - INTERVAL '20 days',
        true
    ),
    (
        uuid_generate_v4 (),
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        'PUMP_DUMP',
        'CRITICAL',
        'Coordinated pump and dump scheme detected',
        96.00,
        '{"tokens_affected": ["SCAM1", "RUGPULL"], "pattern": "coordinated"}',
        NOW() - INTERVAL '15 days',
        false
    ),

-- High Alerts
(
    uuid_generate_v4 (),
    '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
    'STRUCTURING',
    'HIGH',
    'Detected 12 transactions just under $10,000 threshold',
    92.00,
    '{"tx_count": 12, "avg_amount": 9876.54}',
    NOW() - INTERVAL '7 days',
    false
),
(
    uuid_generate_v4 (),
    '0x7f367cc41522ce07553e823bf3be79a889debe1b',
    'LAYERING',
    'HIGH',
    'Complex transaction layering pattern detected',
    88.00,
    '{"layers": 4, "total_wallets": 8}',
    NOW() - INTERVAL '5 days',
    false
),
(
    uuid_generate_v4 (),
    '0x2fc617e933a52713247ce25730f6695920b3befe',
    'SMURFING',
    'HIGH',
    'High volume micro-transactions pattern',
    90.00,
    '{"tx_count_24h": 156, "avg_value": 0.05}',
    NOW() - INTERVAL '10 days',
    true
),
(
    uuid_generate_v4 (),
    '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
    'WASH_TRADING',
    'HIGH',
    'Self-trading loop detected',
    94.00,
    '{"loop_addresses": 3, "volume": 45.5}',
    NOW() - INTERVAL '3 days',
    false
),
(
    uuid_generate_v4 (),
    '0x4b0f1812e5df2a09796481ff14017e6005508003',
    'CHAIN_HOPPING',
    'HIGH',
    'Cross-chain bridge abuse for obfuscation',
    87.00,
    '{"chains": ["ETH", "BSC", "POLYGON"]}',
    NOW() - INTERVAL '4 days',
    false
),

-- Medium Alerts
(
    uuid_generate_v4 (),
    '0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff',
    'INTEGRATION',
    'MEDIUM',
    'Funds integration before exchange deposit',
    85.00,
    '{"destination": "binance_hot"}',
    NOW() - INTERVAL '2 days',
    false
),
(
    uuid_generate_v4 (),
    '0x5a7a51ed600e34a53e1c70c78e8a1e86f9d8f8e3',
    'PEELING_CHAIN',
    'MEDIUM',
    'Classic peeling chain pattern identified',
    82.00,
    '{"chain_length": 7}',
    NOW() - INTERVAL '1 day',
    false
),

-- Recent Alerts (Today)
(
    uuid_generate_v4 (),
    '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
    'RAPID_MOVEMENT',
    'HIGH',
    'Large value moved within 1 hour to multiple wallets',
    91.00,
    '{"amount_eth": 11.2, "recipients": 3}',
    NOW() - INTERVAL '8 hours',
    false
),
(
    uuid_generate_v4 (),
    '0x7f367cc41522ce07553e823bf3be79a889debe1b',
    'LAYERING',
    'HIGH',
    'Continuing layering activity detected',
    88.00,
    '{"layer": 2}',
    NOW() - INTERVAL '6 hours',
    false
),
(
    uuid_generate_v4 (),
    '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
    'WASH_TRADING',
    'HIGH',
    'Wash trading pattern continues',
    93.00,
    '{"volume_24h": 15.15}',
    NOW() - INTERVAL '5 hours',
    false
);

-- =====================================================
-- BLOCKED TRANSFERS (Attempted risky transfers)
-- =====================================================

INSERT INTO
    blocked_transfers (
        id,
        sender_address,
        receiver_address,
        amount,
        risk_score,
        block_reason,
        user_warning_count,
        blocked_at
    )
VALUES
    -- Alice tried to send to a suspicious wallet
    (
        uuid_generate_v4 (),
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
        5000000000000000000,
        92.00,
        'high_risk_receiver',
        0,
        NOW() - INTERVAL '5 days'
    ),
    -- Bob tried to send to a known hacker
    (
        uuid_generate_v4 (),
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        3000000000000000000,
        99.00,
        'blacklisted_receiver',
        0,
        NOW() - INTERVAL '3 days'
    ),
    -- Alice tried again after warning
    (
        uuid_generate_v4 (),
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x7f367cc41522ce07553e823bf3be79a889debe1b',
        2500000000000000000,
        88.00,
        'high_risk_receiver',
        1,
        NOW() - INTERVAL '2 days'
    ),
    -- Unknown user to sanctioned wallet
    (
        uuid_generate_v4 (),
        '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
        '0x53b6936513e738f44fb50d2b9476730c0ab3bfc1',
        8500000000000000000,
        98.00,
        'sanctioned_entity',
        0,
        NOW() - INTERVAL '1 day'
    ),
    -- Recent blocked attempt
    (
        uuid_generate_v4 (),
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        1200000000000000000,
        96.00,
        'manipulation_detected',
        1,
        NOW() - INTERVAL '12 hours'
    ),
    -- Today's blocked transfer
    (
        uuid_generate_v4 (),
        '0x742d35cc6634c0532925a3b844bc454e4438f44e',
        '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59',
        800000000000000000,
        94.00,
        'wash_trading_network',
        2,
        NOW() - INTERVAL '3 hours'
    );

-- =====================================================
-- USER WARNINGS (Strike system)
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.user_warnings') IS NOT NULL THEN
        INSERT INTO user_warnings (user_id, wallet_address, target_address, warning_type, risk_score, user_action, warning_number, created_at)
        SELECT
            u.id,
            '0x742d35cc6634c0532925a3b844bc454e4438f44e',
            '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a',
            'HIGH_RISK_TRANSFER',
            92.00,
            'cancelled',
            1,
            NOW() - INTERVAL '5 days'
        FROM users u WHERE u.username = 'alice_nguyen';

        INSERT INTO user_warnings (user_id, wallet_address, target_address, warning_type, risk_score, user_action, warning_number, created_at)
        SELECT
            u.id,
            '0x742d35cc6634c0532925a3b844bc454e4438f44e',
            '0x7f367cc41522ce07553e823bf3be79a889debe1b',
            'HIGH_RISK_TRANSFER',
            88.00,
            'ignored',
            2,
            NOW() - INTERVAL '2 days'
        FROM users u WHERE u.username = 'alice_nguyen';

        INSERT INTO user_warnings (user_id, wallet_address, target_address, warning_type, risk_score, user_action, warning_number, created_at)
        SELECT
            u.id,
            '0x8ba1f109551bd432803012645ac136ddd64dba72',
            '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
            'MANIPULATION_ALERT',
            96.00,
            'cancelled',
            1,
            NOW() - INTERVAL '12 hours'
        FROM users u WHERE u.username = 'bob_tran';
    END IF;
END $$;

-- =====================================================
-- BLACKLIST (Known bad actors)
-- =====================================================

DELETE FROM blacklist;

INSERT INTO
    blacklist (
        id,
        address,
        category,
        source,
        description,
        severity,
        is_active,
        reported_at,
        verified_at
    )
VALUES (
        uuid_generate_v4 (),
        '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        'OFAC_SANCTIONS',
        'OFAC SDN List',
        'Ronin Bridge Exploiter - $625M hack',
        'CRITICAL',
        true,
        '2022-04-14',
        '2022-04-14'
    ),
    (
        uuid_generate_v4 (),
        '0x53b6936513e738f44fb50d2b9476730c0ab3bfc1',
        'STATE_ACTOR',
        'FBI/Treasury',
        'Lazarus Group - DPRK state-sponsored hacking',
        'CRITICAL',
        true,
        '2022-01-15',
        '2022-01-20'
    ),
    (
        uuid_generate_v4 (),
        '0x8589427373d6d84e98730d7795d8f6f8731fda16',
        'OFAC_SANCTIONS',
        'OFAC SDN List',
        'Tornado Cash sanctioned entity',
        'CRITICAL',
        true,
        '2022-08-08',
        '2022-08-08'
    ),
    (
        uuid_generate_v4 (),
        '0xa0c68c638235ee32657e8f720a23cec1bfc77c77',
        'MARKET_MANIPULATION',
        'SEC Report',
        'Pump and dump scheme operator',
        'HIGH',
        true,
        NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '14 days'
    );

-- =====================================================
-- RISK ASSESSMENTS (Historical AI analysis)
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.risk_assessments') IS NOT NULL THEN
        INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version, feature_count, confidence_score, assessed_at)
        SELECT w.id, 92.00, 'CRITICAL',
            '{"money_laundering": {"detected": true, "confidence": 0.95, "reasons": ["structuring pattern", "rapid fund movement"]}, "wash_trading": {"detected": false}, "scam": {"detected": false}}'::jsonb,
            'Multi-Agent-v1.0', 24, 95.00, NOW() - INTERVAL '7 days'
        FROM wallets w WHERE w.address = '0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a';

        INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version, feature_count, confidence_score, assessed_at)
        SELECT w.id, 94.00, 'CRITICAL',
            '{"money_laundering": {"detected": false}, "wash_trading": {"detected": true, "confidence": 0.98, "reasons": ["self-trading loop", "zero-sum pattern"]}, "scam": {"detected": false}}'::jsonb,
            'Multi-Agent-v1.0', 28, 98.00, NOW() - INTERVAL '3 days'
        FROM wallets w WHERE w.address = '0x9bf4001d307dfd62b26a2f1307ee0c0307632d59';

        INSERT INTO risk_assessments (wallet_id, score, risk_level, details, model_version, feature_count, confidence_score, assessed_at)
        SELECT w.id, 5.00, 'LOW',
            '{"money_laundering": {"detected": false}, "wash_trading": {"detected": false}, "scam": {"detected": false}}'::jsonb,
            'Multi-Agent-v1.0', 18, 92.00, NOW() - INTERVAL '1 day'
        FROM wallets w WHERE w.address = '0x742d35cc6634c0532925a3b844bc454e4438f44e';
    END IF;
END $$;

-- =====================================================
-- REFRESH MATERIALIZED VIEW
-- =====================================================
DO $$
BEGIN
    IF to_regclass('public.high_risk_wallets') IS NOT NULL THEN
        REFRESH MATERIALIZED VIEW high_risk_wallets;
    END IF;
END $$;

-- =====================================================
-- ROLE OPS TABLES (for current role dashboards)
-- =====================================================

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
        last_checked_at,
        created_at,
        updated_at
    )
VALUES (
        uuid_generate_v4 (),
        'alchemy-mainnet',
        'ethereum',
        'https://eth-mainnet.g.alchemy.com/v2/demo',
        'http',
        10,
        true,
        'healthy',
        NOW() - INTERVAL '2 minutes',
        NOW(),
        NOW()
    ),
    (
        uuid_generate_v4 (),
        'infura-backup',
        'ethereum',
        'https://mainnet.infura.io/v3/demo',
        'http',
        20,
        true,
        'degraded',
        NOW() - INTERVAL '4 minutes',
        NOW(),
        NOW()
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    pipeline_metrics (
        chain,
        block_number,
        throughput_tps,
        ingestion_latency_ms,
        decode_latency_ms,
        inserted_at
    )
VALUES (
        'ethereum',
        19548995,
        12.5,
        180,
        95,
        NOW() - INTERVAL '30 minutes'
    ),
    (
        'ethereum',
        19548996,
        11.9,
        210,
        110,
        NOW() - INTERVAL '25 minutes'
    ),
    (
        'ethereum',
        19548997,
        13.4,
        170,
        90,
        NOW() - INTERVAL '20 minutes'
    ),
    (
        'ethereum',
        19548998,
        10.8,
        240,
        130,
        NOW() - INTERVAL '15 minutes'
    ),
    (
        'ethereum',
        19548999,
        14.1,
        160,
        85,
        NOW() - INTERVAL '10 minutes'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    feature_store_configs (
        id,
        feature_key,
        enabled,
        expression,
        created_at,
        updated_at
    )
VALUES (
        uuid_generate_v4 (),
        'tx_velocity_1h',
        true,
        'count_tx(1h)',
        NOW(),
        NOW()
    ),
    (
        uuid_generate_v4 (),
        'counterparty_entropy_24h',
        true,
        'entropy(counterparties,24h)',
        NOW(),
        NOW()
    ),
    (
        uuid_generate_v4 (),
        'bridge_hops_7d',
        false,
        'bridge_hops(7d)',
        NOW(),
        NOW()
    ) ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO
    model_registry (
        id,
        model_name,
        version,
        artifact_uri,
        framework,
        is_active,
        promoted_at,
        created_at
    )
VALUES (
        uuid_generate_v4 (),
        'risk-core',
        'v1.0.0',
        's3://models/risk-core-v1.onnx',
        'onnx',
        true,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '2 days'
    ),
    (
        uuid_generate_v4 (),
        'risk-core',
        'v1.1.0-rc',
        's3://models/risk-core-v1_1-rc.onnx',
        'onnx',
        false,
        NULL,
        NOW() - INTERVAL '8 hours'
    ) ON CONFLICT DO NOTHING;

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
        created_at,
        updated_at
    )
VALUES (
        uuid_generate_v4 (),
        'block_high_risk_runtime',
        'Block transfer when risk score >= 80',
        80.0,
        true,
        true,
        true,
        90,
        true,
        NOW(),
        NOW()
    ),
    (
        uuid_generate_v4 (),
        'watch_medium_risk',
        'Flag and monitor transfers when risk score >= 60',
        60.0,
        false,
        false,
        true,
        120,
        true,
        NOW(),
        NOW()
    ) ON CONFLICT (rule_name) DO NOTHING;

-- Notification table can be legacy (event_type required) or current schema (severity expected).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_events' AND column_name = 'event_type'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notification_events' AND column_name = 'severity'
        ) THEN
            INSERT INTO notification_events (
                id, channel, event_type, recipient, severity, message, status, metadata, created_at, sent_at
            ) VALUES
                (uuid_generate_v4(), 'telegram', 'ALERT', 'security-room', 'HIGH', 'Automated security notification check', 'sent', '{"source":"seed_demo_data"}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
            ON CONFLICT DO NOTHING;
        ELSE
            INSERT INTO notification_events (
                id, channel, event_type, recipient, message, status, metadata, created_at, sent_at
            ) VALUES
                (uuid_generate_v4(), 'telegram', 'ALERT', 'security-room', 'Automated security notification check', 'sent', '{"source":"seed_demo_data"}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
            ON CONFLICT DO NOTHING;
        END IF;
    ELSE
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notification_events' AND column_name = 'severity'
        ) THEN
            INSERT INTO notification_events (
                id, channel, recipient, severity, message, status, metadata, created_at, sent_at
            ) VALUES
                (uuid_generate_v4(), 'telegram', 'security-room', 'HIGH', 'Automated security notification check', 'sent', '{"source":"seed_demo_data"}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
            ON CONFLICT DO NOTHING;
        ELSE
            INSERT INTO notification_events (
                id, channel, recipient, message, status, metadata, created_at, sent_at
            ) VALUES
                (uuid_generate_v4(), 'telegram', 'security-room', 'Automated security notification check', 'sent', '{"source":"seed_demo_data"}'::jsonb, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;

-- Verify data counts
SELECT 'wallets' as table_name, COUNT(*) as count
FROM wallets
UNION ALL
SELECT 'transactions', COUNT(*)
FROM transactions
UNION ALL
SELECT 'alerts', COUNT(*)
FROM alerts
UNION ALL
SELECT 'blocked_transfers', COUNT(*)
FROM blocked_transfers
UNION ALL
SELECT 'blacklist', COUNT(*)
FROM blacklist
UNION ALL
SELECT 'node_endpoints', COUNT(*)
FROM node_endpoints
UNION ALL
SELECT 'pipeline_metrics', COUNT(*)
FROM pipeline_metrics
UNION ALL
SELECT 'feature_store_configs', COUNT(*)
FROM feature_store_configs
UNION ALL
SELECT 'model_registry', COUNT(*)
FROM model_registry
UNION ALL
SELECT 'policy_rules', COUNT(*)
FROM policy_rules
UNION ALL
SELECT 'notification_events', COUNT(*)
FROM notification_events;


