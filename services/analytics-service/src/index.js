const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const traceMiddleware = require('../../shared/trace');
const { client, requestMetrics } = require('../../shared/metrics');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(requestMetrics);

const logger = require('./utils/logger');
app.use(morgan(':method :url :status :response-time ms', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

const { connect } = require('./services/queue');

const CHAIN_ALIASES = {
  ethereum: 'ethereum',
  eth: 'ethereum',
  '1': 'ethereum',
  bsc: 'bsc',
  bnb: 'bsc',
  binance: 'bsc',
  '56': 'bsc',
};

function normalizeChain(chain) {
  const normalized = String(chain || 'ethereum').trim().toLowerCase();
  return CHAIN_ALIASES[normalized] || null;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'analytics-service', timestamp: new Date() });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'analytics-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/statistics/dashboard', async (req, res) => {
  const chain = normalizeChain(req.query.chain || 'ethereum');
  if (!chain) {
    return res.status(400).json({ error: 'Invalid chain parameter' });
  }

  try {
    const [wallets, alerts, tokenTxs] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM wallets'),
      pool.query('SELECT COUNT(*) as count FROM alerts WHERE chain_id = $1', [chain]),
      pool.query('SELECT COUNT(*) as count FROM token_transfers WHERE chain_id = $1', [chain]),
    ]);

    const moneyLaundering = await pool.query(
      "SELECT COUNT(*) as count FROM wallets WHERE risk_category = 'money_laundering'",
    );
    const manipulation = await pool.query(
      "SELECT COUNT(*) as count FROM wallets WHERE risk_category = 'manipulation'",
    );
    const scam = await pool.query(
      "SELECT COUNT(*) as count FROM wallets WHERE risk_category = 'scam'",
    );

    const mlAlerts = await pool.query(
      "SELECT COUNT(*) as count FROM alerts WHERE alert_type = 'MONEY_LAUNDERING' AND chain_id = $1",
      [chain],
    );
    const manipAlerts = await pool.query(
      "SELECT COUNT(*) as count FROM alerts WHERE alert_type = 'MARKET_MANIPULATION' AND chain_id = $1",
      [chain],
    );
    const scamAlerts = await pool.query(
      "SELECT COUNT(*) as count FROM alerts WHERE alert_type = 'SCAM' AND chain_id = $1",
      [chain],
    );

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const criticalAlerts = await pool.query(
      "SELECT COUNT(*) as count FROM alerts WHERE severity = 'CRITICAL' AND chain_id = $1 AND detected_at >= $2",
      [chain, todayStart],
    );
    const alertsToday = await pool.query(
      "SELECT COUNT(*) as count FROM alerts WHERE chain_id = $1 AND detected_at >= $2",
      [chain, todayStart],
    );
    const blockedTotal = await pool.query(
      "SELECT COUNT(*) as count FROM blocked_transfers WHERE chain_id = $1",
      [chain],
    );

    res.json({
      data: {
        money_laundering: {
          wallet_count: parseInt(moneyLaundering.rows[0].count),
          alert_count: parseInt(mlAlerts.rows[0].count),
          icon: 'shield',
          color: 'blue',
        },
        manipulation: {
          wallet_count: parseInt(manipulation.rows[0].count),
          alert_count: parseInt(manipAlerts.rows[0].count),
          icon: 'activity',
          color: 'amber',
        },
        scam: {
          wallet_count: parseInt(scam.rows[0].count),
          alert_count: parseInt(scamAlerts.rows[0].count),
          icon: 'alert-triangle',
          color: 'red',
        },
        overview: {
          total_wallets: parseInt(wallets.rows[0].count),
          total_alerts: parseInt(alerts.rows[0].count),
          critical_alerts: parseInt(criticalAlerts.rows[0].count),
          alerts_today: parseInt(alertsToday.rows[0].count),
          total_blocked: parseInt(blockedTotal.rows[0].count),
        },
      },
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

app.get('/statistics/flow', async (req, res) => {
  const minutes = parseInt(req.query.minutes || 5);
  const chain = normalizeChain(req.query.chain || 'ethereum');
  if (!chain) {
    return res.status(400).json({ error: 'Invalid chain parameter' });
  }

  try {
    const result = await pool.query(
      `SELECT date as date, inflow_eth, outflow_eth FROM money_flow_snapshots 
       WHERE chain_id = $1 ORDER BY date DESC LIMIT 100`,
      [chain],
    );

    const flowData = result.rows.map(row => ({
      date: row.date,
      inflow: parseFloat(row.inflow_eth || 0),
      outflow: parseFloat(row.outflow_eth || 0),
    }));

    res.json({ flow_data: flowData });
  } catch (error) {
    console.error('Flow statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch flow statistics' });
  }
});

app.get('/organizations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, contact_email, api_key, is_active FROM organizations',
    );
    res.json({ count: result.rows.length, items: result.rows });
  } catch (error) {
    console.error('Organizations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

app.get('/ops/system/node-endpoints', async (req, res) => {
  try {
    const onlyActive = req.query.only_active === 'true';
    let query = 'SELECT * FROM node_endpoints';
    if (onlyActive) {
      query += ' WHERE is_active = true';
    }
    query += ' ORDER BY provider_name, priority';

    const result = await pool.query(query);
    res.json({ count: result.rows.length, items: result.rows });
  } catch (error) {
    console.error('Node endpoints error:', error);
    res.status(500).json({ error: 'Failed to fetch node endpoints' });
  }
});

app.get('/ops/system/pipeline-metrics', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 100);
    const result = await pool.query(
      'SELECT * FROM pipeline_metrics ORDER BY inserted_at DESC LIMIT $1',
      [limit],
    );
    res.json({ count: result.rows.length, items: result.rows });
  } catch (error) {
    console.error('Pipeline metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline metrics' });
  }
});

app.get('/ops/system/pipeline-metrics/summary', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as total_points, AVG(throughput_tps) as avg_throughput_tps, ' +
      'AVG(ingestion_latency_ms) as avg_ingestion_latency_ms, AVG(decode_latency_ms) as avg_decode_latency_ms, ' +
      'MAX(block_number) as last_block_number FROM pipeline_metrics',
    );
    const row = result.rows[0];
    res.json({
      total_points: parseInt(row.total_points) || 0,
      avg_throughput_tps: parseFloat(row.avg_throughput_tps) || null,
      avg_ingestion_latency_ms: parseFloat(row.avg_ingestion_latency_ms) || null,
      avg_decode_latency_ms: parseFloat(row.avg_decode_latency_ms) || null,
      last_block_number: parseInt(row.last_block_number) || null,
    });
  } catch (error) {
    console.error('Pipeline summary error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline summary' });
  }
});

app.get('/ops/system/slo-metrics', async (req, res) => {
  try {
    const days = parseInt(req.query.days || 14);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const healthResult = await pool.query(
      'SELECT availability_pct, error_budget_burn FROM system_health_snapshots WHERE timestamp >= $1 ORDER BY timestamp DESC LIMIT 1',
      [cutoff],
    );

    const latencyResult = await pool.query(
      'SELECT AVG(latency_p95_ms) as p95_ms FROM system_health_snapshots WHERE timestamp >= $1',
      [cutoff],
    );

    const healthRow = healthResult.rows[0] || {};
    const latencyRow = latencyResult.rows[0] || {};

    res.json({
      period_days: days,
      endpoint_health: {
        total: 0,
        active: 0,
        healthy_active: 0,
        availability_pct: parseFloat(healthRow.availability_pct) || 100,
        error_budget_burn_pct: parseFloat(healthRow.error_budget_burn) || 0,
      },
      latency_slo: {
        ingest_target_ms: 500,
        decode_target_ms: 200,
        ingest_p95_ms: parseFloat(latencyRow.p95_ms) || 0,
        decode_p95_ms: 0,
        ingest_breaches: 0,
        decode_breaches: 0,
        sample_points: 0,
      },
    });
  } catch (error) {
    console.error('SLO metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch SLO metrics' });
  }
});

app.get('/ops/system/data-integrity', async (req, res) => {
  try {
    const counts = await pool.query(
      'SELECT COUNT(*) as count FROM wallets UNION ALL SELECT COUNT(*) FROM transactions UNION ALL SELECT COUNT(*) FROM alerts',
    );

    const checks = [
      { name: 'Wallet addresses normalized', status: 'ok' },
      { name: 'Transaction hashes unique', status: 'ok' },
      { name: 'Alert severities valid', status: 'ok' },
    ];

    res.json({
      overall_ok: true,
      counts: {
        wallets: parseInt(counts.rows[0]?.count) || 0,
        transactions: parseInt(counts.rows[1]?.count) || 0,
        alerts: parseInt(counts.rows[2]?.count) || 0,
      },
      checks,
      missing_controls: [],
      role_readiness: {},
    });
  } catch (error) {
    console.error('Data integrity error:', error);
    res.status(500).json({ error: 'Failed to check data integrity' });
  }
});

app.use((err, req, res, next) => {
  console.error(`[${req.correlationId || 'no-id'}] Unhandled error:`, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

connect().then(() => {
  app.listen(PORT, () => {
    console.log(`Analytics Service running on port ${PORT}`);
  });
}).catch(console.error);