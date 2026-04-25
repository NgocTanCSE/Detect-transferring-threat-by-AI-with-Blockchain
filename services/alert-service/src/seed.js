/**
 * Blockchain AI - Alert Service Seeding Script
 * 
 * This script populates the alert database with realistic sample threat data.
 * Usage: 
 *   1. Ensure DATABASE_URL is set in .env
 *   2. Run: npm run seed
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SEED_ALERTS = [
  {
    wallet_address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
    alert_type: 'SANCTIONED_ENTITY',
    severity: 'CRITICAL',
    message: 'High-value transfer detected from Lazarus Group (DPRK) associated wallet.',
    risk_score: 99.5,
    chain_id: 'ethereum',
    meta: {
      entity: 'Lazarus Group',
      source: 'OFAC SDN List',
      tx_hash: '0x9d54e8c56c2f960f58509825b290740a3406497f1f0088828b8a531f8684d5a9'
    }
  },
  {
    wallet_address: '0x722122df12d4e14e13ac3b6895a86e84145b6967',
    alert_type: 'MIXER_INTERACTION',
    severity: 'HIGH',
    message: 'Wallet interacted with Tornado Cash router. Potential money laundering attempt.',
    risk_score: 85.0,
    chain_id: 'ethereum',
    meta: {
      protocol: 'Tornado Cash',
      method: 'deposit',
      value_eth: '10.0'
    }
  },
  {
    wallet_address: '0x4f3a120e72c76c22ae802d129f599bfdbc31cb81',
    alert_type: 'SUSPICIOUS_TRANSFER',
    severity: 'MEDIUM',
    message: 'Rapid succession of small transfers detected (PEELING). Possible obfuscation.',
    risk_score: 65.2,
    chain_id: 'bsc',
    meta: {
      pattern: 'peeling_chain',
      hop_count: 5,
      total_value: '1.5 BNB'
    }
  },
  {
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    alert_type: 'FLASH_LOAN_ATTACK',
    severity: 'CRITICAL',
    message: 'Large flash loan detected with abnormal arbitrage pattern on Uniswap V3.',
    risk_score: 92.0,
    chain_id: 'ethereum',
    meta: {
      loan_amount: '5000000 USDC',
      profit_est: '120 ETH',
      vulnerability: 'Price Manipulation'
    }
  },
  {
    wallet_address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    alert_type: 'PHISHING_VICTIM',
    severity: 'HIGH',
    message: 'Wallet approved all tokens to a known phishing contract.',
    risk_score: 88.0,
    chain_id: 'ethereum',
    meta: {
      target_contract: '0x6b175474e89094c44da98b954eedeac495271d0f',
      approval_type: 'Unlimited'
    }
  }
];

async function seed() {
  console.log('🚀 Starting Alert Service Seeding...');
  
  try {
    // 1. Verify connection
    await pool.query('SELECT 1');
    console.log('✓ Database connection successful');

    // 2. Clear existing data if RESET_DB is enabled
    const shouldReset = process.env.RESET_DB === '1' || process.env.RESET_DB === 'true';
    if (shouldReset) {
      console.log('🗑️ RESET_DB is enabled. Clearing existing alerts...');
      await pool.query('TRUNCATE TABLE alerts RESTART IDENTITY');
      console.log('✓ Alerts table cleared.');
    }

    // 3. Insert data
    console.log(`📥 Inserting ${SEED_ALERTS.length} sample alerts...`);
    
    for (const alert of SEED_ALERTS) {
      const query = `
        INSERT INTO alerts (
          wallet_address, alert_type, severity, message, 
          risk_score, meta, chain_id, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;
      
      const params = [
        alert.wallet_address,
        alert.alert_type,
        alert.severity,
        alert.message,
        alert.risk_score,
        JSON.stringify(alert.meta),
        alert.chain_id
      ];
      
      await pool.query(query, params);
      console.log(`  + [${alert.severity}] ${alert.alert_type} for ${alert.wallet_address.substring(0, 10)}...`);
    }

    console.log('✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await pool.end();
  }
}

seed();
