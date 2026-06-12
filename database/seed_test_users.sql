-- Test Users Seed Data for Blockchain AI Sentinel
-- Run this after init.sql to add test users for the test environment

-- Password for all test users: password123 (bcrypt hashed)
-- $2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu

INSERT INTO users (id, username, email, password_hash, role, wallet_address, warning_count, is_active, created_at)
VALUES
  -- Regular Users
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'alice_trader', 'alice@example.com',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'user', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 0, true, NOW()),

  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'charlie_whale', 'charlie@example.com',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'user', '0xabcdef1234567890abcdef1234567890abcdef12', 0, true, NOW()),

  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'dave_suspicious', 'dave@example.com',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'user', '0x9876543210fedcba9876543210fedcba98765432', 2, true, NOW()),

  -- Analyst
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'bob_analyst', 'bob@example.com',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'analyst', '0x1234567890abcdef1234567890abcdef12345678', 0, true, NOW()),

  -- Admin
  ('e5f6a7b8-c9d0-1234-efab-345678901234', 'eve_compliance', 'eve@example.com',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'admin', '0xfedcba9876543210fedcba9876543210fedcba98', 0, true, NOW()),

  -- Existing admin user (keep if exists)
  ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'admin', 'admin@sentinel.io',
   '$2b$10$8K1p/a0dL1LXMc.0SZ0w3OQH2xKGPKwHFt0EA7GhVFR4dS9yJq3Tu',
   'admin', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 0, true, NOW())

ON CONFLICT (username) DO NOTHING;

-- Add wallets for test users
INSERT INTO wallets (address, label, entity_type, risk_score, risk_category, account_status, total_transactions, chain_id, created_at, last_activity_at)
VALUES
  ('0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'Alice Trader', 'individual', 15, 'low', 'active', 25, 'ethereum', NOW(), NOW()),
  ('0xabcdef1234567890abcdef1234567890abcdef12', 'Charlie Whale', 'individual', 35, 'low', 'active', 150, 'ethereum', NOW(), NOW()),
  ('0x9876543210fedcba9876543210fedcba98765432', 'Dave Suspicious', 'individual', 75, 'high', 'under_review', 8, 'ethereum', NOW(), NOW()),
  ('0x1234567890abcdef1234567890abcdef12345678', 'Bob Analyst', 'individual', 10, 'low', 'active', 5, 'ethereum', NOW(), NOW()),
  ('0xfedcba9876543210fedcba9876543210fedcba98', 'Eve Compliance', 'individual', 5, 'low', 'active', 3, 'ethereum', NOW(), NOW())
ON CONFLICT (address) DO NOTHING;
