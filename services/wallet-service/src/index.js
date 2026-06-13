/**
 * Blockchain AI - Wallet Service
 * Microservice for wallet management and balance tracking
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { client, requestMetrics } = require('../../shared/metrics');

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

// Tracing middleware
app.use(require('../../shared/trace'));
app.use(requestMetrics);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.correlationId}] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

const queue = require('./services/queue');

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'wallet-service',
    timestamp: new Date(),
    dlq_metrics: { main: 0, dead: 0 }
  });
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
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
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
        id: w.id.toString(),
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
 * PUT /wallet/:address/status
 */
app.put('/wallet/:address/status', async (req, res) => {
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
      data: updatedWallet
    });
  } catch (error) {
    console.error('Error updating wallet status:', error);
    res.status(500).json({ error: 'Failed to update wallet status' });
  }
});

/**
 * GET /wallet/:address/stats
 */
app.get('/wallet/:address/stats', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();

  try {
    const walletResult = await pool.query('SELECT * FROM wallets WHERE LOWER(address) = $1', [address]);
    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];

    const txStats = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE LOWER(from_address) = $1) as sent_count,
        COUNT(*) FILTER (WHERE LOWER(to_address) = $1) as received_count,
        COALESCE(SUM(value) FILTER (WHERE LOWER(from_address) = $1), 0) as eth_sent,
        COALESCE(SUM(value) FILTER (WHERE LOWER(to_address) = $1), 0) as eth_received
       FROM transactions WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1`,
      [address]
    );

    const alertStats = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical FROM alerts WHERE LOWER(wallet_address) = $1",
      [address]
    );

    res.json({
      data: {
        address: wallet.address,
        risk_score: parseFloat(wallet.risk_score || 0),
        account_status: wallet.account_status,
        eth_sent: parseFloat(txStats.rows[0].eth_sent) / 1e18,
        eth_received: parseFloat(txStats.rows[0].eth_received) / 1e18,
        eth_balance: (parseFloat(txStats.rows[0].eth_received) - parseFloat(txStats.rows[0].eth_sent)) / 1e18,
        sent_count: parseInt(txStats.rows[0].sent_count),
        received_count: parseInt(txStats.rows[0].received_count),
        total_transactions: parseInt(txStats.rows[0].sent_count) + parseInt(txStats.rows[0].received_count),
        total_alerts: parseInt(alertStats.rows[0].total),
        critical_alerts: parseInt(alertStats.rows[0].critical)
      }
    });
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Failed to fetch wallet stats' });
  }
});

/**
 * GET /wallet/:address/connections
 */
app.get('/wallet/:address/connections', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();

  try {
    const query = `
      WITH counterparty_txs AS (
        SELECT to_address as address, 'outgoing' as direction, value, id FROM transactions WHERE LOWER(from_address) = $1
        UNION ALL
        SELECT from_address as address, 'incoming' as direction, value, id FROM transactions WHERE LOWER(to_address) = $1
      )
      SELECT 
        c.address, 
        c.direction, 
        COUNT(*) as tx_count, 
        SUM(c.value) as total_value_wei,
        w.risk_score,
        w.account_status
      FROM counterparty_txs c
      LEFT JOIN wallets w ON LOWER(c.address) = LOWER(w.address)
      WHERE LOWER(c.address) != $1
      GROUP BY c.address, c.direction, w.risk_score, w.account_status
      ORDER BY tx_count DESC
      LIMIT 20
    `;
    const result = await pool.query(query, [address]);

    res.json({
      data: {
        wallet: { address, label: null, risk_score: 0, entity_type: 'Unknown' },
        connections: result.rows.map(r => ({
          address: r.address,
          direction: r.direction,
          tx_count: parseInt(r.tx_count),
          total_value_eth: parseFloat(r.total_value_wei) / 1e18,
          label: null,
          entity_type: 'Unknown',
          risk_score: parseFloat(r.risk_score || 0),
          account_status: r.account_status || 'active'
        })),
        total_connections: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch wallet connections' });
  }
});

/**
 * GET /wallet/:address/balance
 */
app.get('/wallet/:address/balance', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();
  const chain = (req.query.chain || 'ethereum').toLowerCase();

  try {
    // Get wallet basic info
    const walletResult = await pool.query('SELECT * FROM wallets WHERE LOWER(address) = $1', [address]);
    
    // Calculate balance from transactions table for the specific chain
    const balanceResult = await pool.query(`
      SELECT 
        (SELECT COALESCE(SUM(value), 0) FROM transactions WHERE LOWER(to_address) = $1 AND chain_id = $2 AND status = 1) -
        (SELECT COALESCE(SUM(value), 0) FROM transactions WHERE LOWER(from_address) = $1 AND chain_id = $2 AND status = 1) as balance
    `, [address, chain]);

    const balanceWei = balanceResult.rows[0].balance || '0';
    const balanceEth = parseFloat(balanceWei) / 1e18;

    res.json({
      data: {
        address,
        chain,
        balance_eth: balanceEth,
        balance_wei: balanceWei.toString(),
        risk_score: walletResult.rows.length > 0 ? parseFloat(walletResult.rows[0].risk_score || 0) : 0,
        account_status: walletResult.rows.length > 0 ? walletResult.rows[0].account_status : 'unknown',
        total_transactions: 0
      }
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * GET /wallet/:address/transactions
 * Get transaction history for a specific wallet
 */
app.get('/wallet/:address/transactions', async (req, res) => {
  const address = req.params.address.toLowerCase().trim();
  const limit = parseInt(req.query.limit || 10);

  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE LOWER(from_address) = $1 OR LOWER(to_address) = $1 ORDER BY timestamp DESC LIMIT $2',
      [address, limit]
    );

    res.json({
      transactions: result.rows.map(tx => ({
        ...tx,
        value_eth: parseFloat(tx.value || 0) / 1e18,
        value_wei: tx.value ? tx.value.toString() : '0'
      }))
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Start server
queue.connect().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Wallet Service running on port ${PORT}`);
  });
}).catch(console.error);
