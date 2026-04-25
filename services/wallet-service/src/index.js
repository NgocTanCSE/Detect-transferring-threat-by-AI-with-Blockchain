/**
 * Blockchain AI - Wallet Service
 * Microservice for wallet management and balance tracking
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const queue = require('./services/queue');

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wallet-service', timestamp: new Date() });
});

// Ready check
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'wallet-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

/**
 * GET /wallets
 * Get all monitored wallets with filtering
 */
app.get('/wallets', async (req, res) => {
  const {
    status,
    account_status,
    risk_category,
    min_risk,
    min_risk_score,
    limit = 100
  } = req.query;

  const actualStatus = status || account_status;
  const actualMinRisk = min_risk !== undefined ? min_risk : min_risk_score;

  let query = 'SELECT * FROM wallets WHERE 1=1';
  const params = [];

  if (actualStatus) {
    params.push(actualStatus);
    query += ` AND account_status = $${params.length}`;
  }

  if (risk_category) {
    params.push(risk_category);
    query += ` AND risk_category = $${params.length}`;
  }

  if (actualMinRisk !== undefined) {
    params.push(actualMinRisk);
    query += ` AND risk_score >= $${params.length}`;
  }

  query += ` ORDER BY risk_score DESC LIMIT $${params.length + 1}`;
  params.push(parseInt(limit));

  try {
    const result = await pool.query(query, params);
    
    // Get statistics in parallel
    const statsQuery = `
      SELECT 
        COUNT(*) as total_wallets,
        COUNT(*) FILTER (WHERE risk_score >= 80) as high_risk_count,
        COUNT(*) FILTER (WHERE account_status = 'suspended') as suspended_count,
        COUNT(*) FILTER (WHERE account_status = 'frozen') as frozen_count
      FROM wallets
    `;
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    res.json({
      wallets: result.rows.map(w => ({
        ...w,
        id: w.id.toString(), // Convert BigInt to string
        risk_score: parseFloat(w.risk_score || 0),
        total_transactions: parseInt(w.total_transactions || 0)
      })),
      statistics: {
        total_wallets: parseInt(stats.total_wallets),
        high_risk_count: parseInt(stats.high_risk_count),
        suspended_count: parseInt(stats.suspended_count),
        frozen_count: parseInt(stats.frozen_count)
      },
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

/**
 * PUT /wallets/:address/status
 * Update wallet status
 */
app.put('/wallets/:address/status', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();
  const { status, reason, admin_id } = req.body;

  const validStatuses = ['active', 'suspended', 'frozen', 'under_review'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const result = await pool.query(
      'UPDATE wallets SET account_status = $1, notes = $2, updated_at = NOW() WHERE LOWER(address) = $3 RETURNING *',
      [status, reason || '', address]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const updatedWallet = result.rows[0];

    // Publish event
    await queue.publishEvent('wallet.status.changed', {
      event_type: 'WALLET_STATUS_CHANGED',
      wallet_address: address,
      new_status: status,
      reason: reason || '',
      admin_id: admin_id || 'system',
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Wallet status updated',
      wallet: updatedWallet
    });
  } catch (error) {
    console.error('Error updating wallet status:', error);
    res.status(500).json({ error: 'Failed to update wallet status' });
  }
});

/**
 * GET /wallets/:address/stats
 * Get detailed stats for a wallet
 */
app.get('/wallets/:address/stats', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();

  try {
    const walletResult = await pool.query('SELECT * FROM wallets WHERE LOWER(address) = $1', [address]);
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];

    // Get transaction counts
    const txStats = await pool.query(
      'SELECT COUNT(*) as total, SUM(value) as total_value FROM transactions WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1',
      [address]
    );

    // Get alert counts
    const alertStats = await pool.query(
      'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE severity = \'CRITICAL\') as critical FROM alerts WHERE LOWER(wallet_address) = $1',
      [address]
    );

    res.json({
      address: wallet.address,
      risk_score: parseFloat(wallet.risk_score || 0),
      account_status: wallet.account_status,
      stats: {
        total_transactions: parseInt(txStats.rows[0].total),
        total_value_wei: txStats.rows[0].total_value ? txStats.rows[0].total_value.toString() : '0',
        total_alerts: parseInt(alertStats.rows[0].total),
        critical_alerts: parseInt(alertStats.rows[0].critical)
      }
    });
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Failed to fetch wallet stats' });
  }
});

// Start server
queue.connect().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Wallet Service running on port ${PORT}`);
  });
}).catch(console.error);
