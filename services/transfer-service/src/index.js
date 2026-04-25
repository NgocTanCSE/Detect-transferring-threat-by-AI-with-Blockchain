/**
 * Blockchain AI - Transfer Service
 * Microservice for protected transaction processing and risk prevention
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const CircuitBreaker = require('opossum');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

// Circuit Breaker options
const breakerOptions = {
  timeout: 3000, // If the name server takes longer than 3 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 10000 // After 10 seconds, try again
};

// Function to call AI service
const analyzeAddress = async (address) => {
  const response = await axios.get(`${AI_SERVICE_URL}/analyze/${address}`);
  return response.data;
};

// Create the breaker
const aiBreaker = new CircuitBreaker(analyzeAddress, breakerOptions);
aiBreaker.fallback((address) => {
  console.warn(`Circuit open or AI service failed for ${address}. Using default low risk.`);
  return { risk_score: 0.0, account_status: 'active', ai_insight: 'AI Analysis unavailable (Circuit Breaker)' };
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Helper: Wei from ETH
const weiFromEth = (eth) => {
  return (BigInt(Math.round(parseFloat(eth) * 1e9)) * BigInt(1e9)).toString();
};

// Helper: ETH from Wei
const ethFromWei = (wei) => {
  return (parseFloat(wei) / 1e18).toFixed(6);
};

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'transfer-service', timestamp: new Date() });
});

/**
 * POST /protected-transfer
 * Process a transaction with risk assessment and protection
 */
app.post('/protected-transfer', async (req, res) => {
  const { sender, receiver, amount, force_proceed = false } = req.body;

  if (!sender || !receiver || !amount) {
    return res.status(400).json({ error: 'Missing required fields: sender, receiver, amount' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedSender = sender.toLowerCase().trim();
    const normalizedReceiver = receiver.toLowerCase().trim();

    // 1. Check sender status
    const senderRes = await client.query('SELECT * FROM wallets WHERE LOWER(address) = $1', [normalizedSender]);
    if (senderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sender wallet not found in system' });
    }

    const senderWallet = senderRes.rows[0];
    if (senderWallet.account_status === 'suspended') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Your account is suspended due to multiple risk warnings. Contact support.' });
    }

    // 2. Get current warning count
    const warningRes = await client.query('SELECT COUNT(*) FROM user_warnings WHERE LOWER(wallet_address) = $1', [normalizedSender]);
    const warningCount = parseInt(warningRes.rows[0].count);

    // 3. Check receiver risk
    // Check blacklist first
    const blacklistRes = await client.query('SELECT * FROM blacklist WHERE LOWER(address) = $1', [normalizedReceiver]);
    const receiverRes = await client.query('SELECT * FROM wallets WHERE LOWER(address) = $1', [normalizedReceiver]);

    let receiverRisk = 0.0;
    let receiverStatus = 'unknown';
    const isBlacklisted = blacklistRes.rows.length > 0;

    if (isBlacklisted) {
      receiverRisk = 100.0;
      receiverStatus = 'blacklisted';
    } else if (receiverRes.rows.length > 0) {
      receiverRisk = parseFloat(receiverRes.rows[0].risk_score || 0);
      receiverStatus = receiverRes.rows[0].account_status;
    } else {
      // 3.1 Use AI service with Circuit Breaker for unknown wallets
      try {
        const aiData = await aiBreaker.fire(normalizedReceiver);
        receiverRisk = parseFloat(aiData.risk_score || 0);
        receiverStatus = aiData.account_status || 'unknown';
      } catch (e) {
        console.error('AI analysis via breaker failed:', e.message);
        // Risk remains 0.0 as initialized
      }
    }

    // 4. Critical risk (>80 or blacklisted) - Block immediately
    if (receiverRisk >= 80 || isBlacklisted || ['frozen', 'suspended'].includes(receiverStatus)) {
      const amountWei = weiFromEth(amount);
      await client.query(
        'INSERT INTO blocked_transfers (sender_address, receiver_address, amount, risk_score, block_reason, user_warning_count, blocked_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
        [normalizedSender, normalizedReceiver, amountWei, receiverRisk, 'high_risk_receiver', warningCount]
      );
      await client.query('COMMIT');
      return res.status(403).json({
        blocked: true,
        reason: 'Receiver is high-risk or blocked',
        receiver_risk: receiverRisk,
        receiver_status: receiverStatus
      });
    }

    // 5. Medium risk (50-80) - Show warning
    if (receiverRisk >= 50 && !force_proceed) {
      await client.query('ROLLBACK');
      return res.json({
        status: 'warning',
        requires_confirmation: true,
        receiver_risk: receiverRisk,
        current_warnings: warningCount,
        max_warnings: 3,
        message: `⚠️ This wallet has a risk score of ${receiverRisk}%. Are you sure you want to proceed?`,
        warning_text: `You have ${3 - warningCount} warnings remaining before account suspension.`
      });
    }

    // 6. User chose to proceed despite warning
    if (force_proceed && receiverRisk >= 50) {
      await client.query(
        'INSERT INTO user_warnings (wallet_address, target_address, warning_type, risk_score, user_action, warning_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
        [normalizedSender, normalizedReceiver, 'RISK_IGNORED', receiverRisk, 'ignored', warningCount + 1]
      );
      
      const newWarningCount = warningCount + 1;
      if (newWarningCount >= 3) {
        // Auto-suspend
        await client.query(
          "UPDATE wallets SET account_status = 'suspended', flagged_at = NOW(), flagged_by = 'SYSTEM_AUTO_SUSPEND', notes = notes || '\n[' || NOW() || '] Auto-suspended after 3 risk warnings.' WHERE address = $1",
          [senderWallet.address]
        );

        // Create alert
        await client.query(
          "INSERT INTO alerts (wallet_address, alert_type, severity, message, risk_score, detected_at) VALUES ($1, $2, $3, $4, $5, NOW())",
          [normalizedSender, 'USER_SUSPENDED', 'HIGH', `User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to ${normalizedReceiver}.`, receiverRisk]
        );

        await client.query('COMMIT');
        return res.status(403).json({
          suspended: true,
          reason: 'Account suspended after 3 ignored risk warnings',
          warning_count: newWarningCount
        });
      }
    }

    // 7. Proceed with transaction
    const amountWei = weiFromEth(amount);

    // Check balance (Simplified balance check for simulation)
    const balanceRes = await client.query(`
      SELECT 
        (SELECT COALESCE(SUM(value), 0) FROM transactions WHERE LOWER(to_address) = $1) -
        (SELECT COALESCE(SUM(value), 0) FROM transactions WHERE LOWER(from_address) = $1) as balance
    `, [normalizedSender]);
    
    const balanceWei = BigInt(balanceRes.rows[0].balance || '0');
    if (balanceWei < BigInt(amountWei)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create transaction
    const txHash = `sim_${Math.random().toString(36).substring(2, 15)}`;
    await client.query(
      'INSERT INTO transactions (tx_hash, from_address, to_address, value, block_number, timestamp, status) VALUES ($1, $2, $3, $4, 0, NOW(), 1)',
      [txHash, normalizedSender, normalizedReceiver, amountWei]
    );

    // Update wallets
    await client.query(
      'UPDATE wallets SET total_value_sent = total_value_sent + $1, total_transactions = total_transactions + 1, last_activity_at = NOW() WHERE LOWER(address) = $2',
      [amountWei, normalizedSender]
    );

    if (receiverRes.rows.length > 0) {
      await client.query(
        'UPDATE wallets SET total_value_received = total_value_received + $1, total_transactions = total_transactions + 1, last_activity_at = NOW() WHERE LOWER(address) = $2',
        [amountWei, normalizedReceiver]
      );
    } else {
      await client.query(
        'INSERT INTO wallets (address, total_value_received, total_transactions, last_activity_at, account_status, risk_score) VALUES ($1, $2, 1, NOW(), $3, $4)',
        [normalizedReceiver, amountWei, 'active', 0]
      );
    }

    await client.query('COMMIT');

    res.json({
      status: 'success',
      tx_hash: txHash,
      from: sender,
      to: receiver,
      amount_eth: amount,
      receiver_risk_score: receiverRisk,
      warning_count: force_proceed && receiverRisk >= 50 ? warningCount + 1 : warningCount,
      message: 'Transaction completed successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing transfer:', error);
    res.status(500).json({ error: 'Internal server error during transfer processing' });
  } finally {
    client.release();
  }
});

/**
 * GET /transfers/blocked
 * Get list of blocked transfers (Admin)
 */
app.get('/transfers/blocked', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM blocked_transfers ORDER BY blocked_at DESC LIMIT 100');
    res.json(result.rows.map(r => ({
      ...r,
      id: r.id.toString(),
      amount_eth: ethFromWei(r.amount)
    })));
  } catch (error) {
    console.error('Error fetching blocked transfers:', error);
    res.status(500).json({ error: 'Failed to fetch blocked transfers' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Transfer Service running on port ${PORT}`);
});
