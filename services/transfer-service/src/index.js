/**
 * Blockchain AI - Transfer Service
 * Microservice for protected transaction processing and risk prevention
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
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

app.set('etag', false);

// Force no-cache
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Tracing middleware
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || `internal-${Math.random().toString(36).substring(7)}`;
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.correlationId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

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

// Middleware to enforce Role-Based Access Control
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    
    // In dev mode, if no gateway header is present, allow all (optional)
    if (!userRole && process.env.NODE_ENV === 'development') {
      return next();
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      console.warn(`[RBAC] Transfer denied for role: ${userRole}`);
      return res.status(403).json({ 
        error: 'Forbidden: You do not have permission to perform transactions.' 
      });
    }
    next();
  };
};

/**
 * POST /protected-transfer
 * Process a transaction with risk assessment and protection
 */
app.post(['/protected-transfer', '/transfer/protected', '/protected'], requireRole(['user', 'admin', 'api_client']), async (req, res) => {
  const { 
    sender, 
    from_wallet_id,
    receiver, 
    to_address,
    to_wallet_id,
    amount, 
    amount_eth,
    force_proceed = false,
    confirm_risk = false,
    chain = 'ethereum',
    asset = 'ETH'
  } = req.body;

  // Align field names from different sources (Demo Scripts vs Frontend)
  const finalSender = sender || from_wallet_id;
  const finalReceiver = receiver || to_address || to_wallet_id;
  const finalAmount = amount || amount_eth;
  const finalForceProceed = force_proceed || confirm_risk;

  if (!finalSender || !finalReceiver || !finalAmount) {
    return res.status(400).json({ error: 'Missing required fields: sender/from_wallet_id, receiver/to_address, amount' });
  }

  // Chain/Asset Validation
  const validAssets = {
    'ethereum': ['ETH', 'USDT', 'USDC'],
    'bsc': ['BNB', 'USDT', 'BUSD']
  };

  const normalizedChain = chain.toLowerCase();
  const normalizedAsset = asset.toUpperCase();

  if (!validAssets[normalizedChain]) {
    return res.status(400).json({ error: `Unsupported chain: ${chain}` });
  }

  if (!validAssets[normalizedChain].includes(normalizedAsset)) {
    return res.status(400).json({ error: `Invalid asset ${asset} for chain ${chain}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedSender = finalSender.toLowerCase().trim();
    const normalizedReceiver = finalReceiver.toLowerCase().trim();

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
      const amountWei = weiFromEth(finalAmount);
      await client.query(
        'INSERT INTO blocked_transfers (id, sender_address, receiver_address, amount, risk_score, block_reason, user_warning_count, chain_id, blocked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
        [uuidv4(), normalizedSender, normalizedReceiver, amountWei, receiverRisk, 'high_risk_receiver', warningCount, normalizedChain]
      );
      await client.query('COMMIT');
      return res.status(403).json({
        data: {
          status: 'blocked',
          blocked: true,
          reason: 'Receiver is high-risk or blocked',
          receiver_risk: receiverRisk,
          receiver_status: receiverStatus,
          message: `Giao dịch đã bị chặn bởi AI Sentinel. Địa chỉ nhận có mức độ rủi ro cực cao (${receiverRisk}%).`
        }
      });
    }

    // 5. Medium risk (50-80) - Show warning
    if (receiverRisk >= 50 && !finalForceProceed) {
      await client.query('ROLLBACK');
      return res.json({
        data: {
          status: 'warning',
          requires_confirmation: true,
          receiver_risk: receiverRisk,
          current_warnings: warningCount,
          max_warnings: 3,
          message: `⚠️ Ví này có điểm rủi ro là ${receiverRisk}%. Bạn có chắc chắn muốn tiếp tục?`,
          warning_text: `Bạn còn ${3 - warningCount} lần cảnh báo trước khi tài khoản bị khóa.`
        }
      });
    }

    // 6. User chose to proceed despite warning
    if (finalForceProceed && receiverRisk >= 50) {
      await client.query(
        'INSERT INTO user_warnings (id, wallet_address, target_address, warning_type, risk_score, user_action, warning_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
        [uuidv4(), normalizedSender, normalizedReceiver, 'RISK_IGNORED', receiverRisk, 'ignored', warningCount + 1]
      );
      
      const newWarningCount = warningCount + 1;
      if (newWarningCount >= 3) {
        // Auto-suspend
        await client.query(
          "UPDATE wallets SET account_status = 'suspended', flagged_at = NOW(), notes = COALESCE(notes, '') || '\n[' || NOW() || '] Auto-suspended after 3 risk warnings.' WHERE address = $1",
          [senderWallet.address]
        );

        // Create alert
        await client.query(
          "INSERT INTO alerts (id, wallet_address, alert_type, severity, message, risk_score, chain_id, detected_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
          [uuidv4(), normalizedSender, 'USER_SUSPENDED', 'HIGH', `User account auto-suspended after ignoring 3 risk warnings. Last attempted transfer to ${normalizedReceiver}.`, receiverRisk, normalizedChain]
        );

        await client.query('COMMIT');
        return res.status(403).json({
          data: {
            status: 'blocked',
            suspended: true,
            reason: 'Account suspended after 3 ignored risk warnings',
            warning_count: newWarningCount,
            message: 'Tài khoản của bạn đã bị tạm khóa do phớt lờ cảnh báo rủi ro quá 3 lần.'
          }
        });
      }
    }

    // 7. Proceed with transaction
    const amountWei = weiFromEth(finalAmount);

    // Create transaction
    const txHash = `sim_${Math.random().toString(36).substring(2, 15)}`;
    await client.query(
      'INSERT INTO transactions (id, tx_hash, from_address, to_address, value, block_number, timestamp, status, chain_id) VALUES ($1, $2, $3, $4, $5, 0, NOW(), 1, $6)',
      [uuidv4(), txHash, normalizedSender, normalizedReceiver, amountWei, normalizedChain]
    );

    // Update wallets
    await client.query(
      'UPDATE wallets SET total_transactions = COALESCE(total_transactions, 0) + 1, last_activity_at = NOW() WHERE LOWER(address) = $1',
      [normalizedSender]
    );

    if (receiverRes.rows.length > 0) {
      await client.query(
        'UPDATE wallets SET total_transactions = COALESCE(total_transactions, 0) + 1, last_activity_at = NOW() WHERE LOWER(address) = $1',
        [normalizedReceiver]
      );
    } else {
      await client.query(
        "INSERT INTO wallets (id, address, total_transactions, last_activity_at, account_status, risk_score) VALUES ($1, $2, 1, NOW(), 'active', 0)",
        [uuidv4(), normalizedReceiver]
      );
    }

    await client.query('COMMIT');

    res.json({
      data: {
        status: 'success',
        tx_hash: txHash,
        from: finalSender,
        to: finalReceiver,
        amount_eth: finalAmount,
        asset: normalizedAsset,
        chain: normalizedChain,
        receiver_risk_score: receiverRisk,
        warning_count: finalForceProceed && receiverRisk >= 50 ? warningCount + 1 : warningCount,
        message: 'Giao dịch đã được thực hiện thành công.'
      }
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
 * POST /transfers/batch
 * Process a batch of transfers (CSV/JSON)
 */
app.post('/transfers/batch', async (req, res) => {
  const { transfers } = req.body; // Expects array of {sender, receiver, amount}

  if (!transfers || !Array.isArray(transfers)) {
    return res.status(400).json({ error: 'transfers array is required' });
  }

  const results = {
    total: transfers.length,
    processed: 0,
    blocked: 0,
    failed: 0,
    details: []
  };

  for (const tx of transfers) {
    try {
      // Internal call to process single transfer
      // In production, this would be handled by a worker/queue
      const normalizedSender = tx.sender.toLowerCase().trim();
      const normalizedReceiver = tx.receiver.toLowerCase().trim();
      const amountWei = weiFromEth(tx.amount);

      // Check risk (simplified for batch)
      const blacklistRes = await pool.query('SELECT * FROM blacklist WHERE LOWER(address) = $1', [normalizedReceiver]);
      if (blacklistRes.rows.length > 0) {
        results.blocked++;
        results.details.push({ tx, status: 'blocked', reason: 'receiver_blacklisted' });
        continue;
      }

      // Create transaction
      const txHash = `batch_${Math.random().toString(36).substring(2, 15)}`;
      await pool.query(
        'INSERT INTO transactions (id, tx_hash, from_address, to_address, value, block_number, timestamp, status) VALUES ($1, $2, $3, $4, $5, 0, NOW(), 1)',
        [uuidv4(), txHash, normalizedSender, normalizedReceiver, amountWei]
      );

      results.processed++;
      results.details.push({ tx, status: 'success', tx_hash: txHash });

    } catch (error) {
      console.error('Batch tx error:', error);
      results.failed++;
      results.details.push({ tx, status: 'failed', error: error.message });
    }
  }

  res.json(results);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Transfer Service running on port ${PORT}`);
});
