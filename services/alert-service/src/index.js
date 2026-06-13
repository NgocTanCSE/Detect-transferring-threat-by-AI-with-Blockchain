const express = require('express');
const { Pool } = require('pg');
const queue = require('./services/queue');
require('dotenv').config();
const { client, requestMetrics } = require('../../shared/metrics');
const traceMiddleware = require('../../shared/trace');

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3003', 10);

app.set('etag', false); // Tắt ETag để tránh mã 304 khi dữ liệu cần cập nhật liên tục

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());

// Force no-cache for all routes
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Tracing middleware
app.use(traceMiddleware);
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

async function ensureSchema() {
  await pool.query(`
		CREATE TABLE IF NOT EXISTS alerts (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			wallet_address VARCHAR(255),
			alert_type VARCHAR(100) NOT NULL DEFAULT 'SUSPICIOUS_ACTIVITY',
			severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
			message TEXT NOT NULL,
			risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
			meta JSONB,
			chain_id VARCHAR(50) NOT NULL DEFAULT 'ethereum',
			acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
			acknowledged_at TIMESTAMPTZ,
			acknowledged_by VARCHAR(255),
			detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_chain_id ON alerts(chain_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_wallet_address ON alerts(wallet_address)');

  // Add chain_id column if missing (for existing tables from init.sql)
  await pool.query(`DO $$ BEGIN
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50) DEFAULT 'ethereum';
  EXCEPTION WHEN duplicate_column THEN null;
  END $$`);

  // Add meta column if missing (init.sql uses 'metadata' instead)
  await pool.query(`DO $$ BEGIN
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS meta JSONB;
  EXCEPTION WHEN duplicate_column THEN null;
  END $$`);

  // Copy metadata to meta for backwards compatibility
  await pool.query(`UPDATE alerts SET meta = metadata WHERE meta IS NULL AND metadata IS NOT NULL`);
}

app.get('/health', async (req, res) => {
  const metrics = await queue.getQueueMetrics();
  res.json({
    status: 'ok',
    service: 'alert-service',
    mq_metrics: metrics
  });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'alert-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

app.get('/alerts/latest', async (req, res) => {
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit || '5', 10), 100));

  try {
    const { rows } = await pool.query(
      `
				SELECT id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, detected_at
				FROM alerts
				ORDER BY detected_at DESC
				LIMIT $1
			`,
      [limit]
    );

    res.json({
      alerts: rows.map((alert) => ({
        id: String(alert.id),
        alert_id: String(alert.id),
        wallet_address: alert.wallet_address || '',
        alert_type: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        risk_score: Number(alert.risk_score || 0),
        metadata: alert.meta || {},
        meta: alert.meta || {},
        chain_id: alert.chain_id || 'ethereum',
        detected_at: new Date(alert.detected_at).toISOString(),
      })),
      count: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/alerts/recent', async (req, res) => {
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit || '50', 10), 500));
  const severity = req.query.severity ? String(req.query.severity).toUpperCase() : null;
  const search = req.query.search ? String(req.query.search).trim() : null;
  const chain = normalizeChain(req.query.chain || 'ethereum');

  if (!chain) {
    return res.status(400).json({
      error: 'Invalid chain. Use ethereum|eth|1 or bsc|bnb|binance|56',
    });
  }

  try {
    const filters = ['chain_id = $1'];
    const params = [chain];
    let idx = 2;

    if (severity && severity !== 'ALL') {
      filters.push(`severity = $${idx}`);
      params.push(severity);
      idx += 1;
    }

    if (search) {
      filters.push(`(
				wallet_address ILIKE $${idx}
				OR alert_type ILIKE $${idx}
				OR message ILIKE $${idx}
			)`);
      params.push(`%${search}%`);
      idx += 1;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM alerts ${whereClause}`,
      params
    );
    const totalMatching = countResult.rows[0]?.count || 0;

    const alertResult = await pool.query(
      `
				SELECT id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, acknowledged, detected_at
				FROM alerts
				${whereClause}
				ORDER BY detected_at DESC
				LIMIT $${idx}
			`,
      [...params, limit]
    );

    const todayStats = await pool.query(
      `
				SELECT
					COUNT(*) FILTER (WHERE detected_at >= date_trunc('day', NOW()))::int AS total_alerts_today,
					COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int AS critical_count
				FROM alerts
				WHERE chain_id = $1
			`,
      [chain]
    );

    const stats = todayStats.rows[0] || { total_alerts_today: 0, critical_count: 0 };

    res.json({
      alerts: alertResult.rows.map((alert) => ({
        alert_id: String(alert.id),
        id: String(alert.id),
        wallet_address: alert.wallet_address,
        alert_type: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        risk_score: Number(alert.risk_score || 0),
        context: alert.meta || {},
        meta: alert.meta || {},
        chain_id: alert.chain_id || 'ethereum',
        detected_at: new Date(alert.detected_at).toISOString(),
        acknowledged: Boolean(alert.acknowledged),
      })),
      statistics: {
        total_alerts_today: Number(stats.total_alerts_today || 0),
        critical_count: Number(stats.critical_count || 0),
        total_matching: Number(totalMatching),
        returned_count: alertResult.rows.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/alerts', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
  const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit || '20', 10), 100));
  const offset = (page - 1) * limit;

  const filters = [];
  const params = [];
  let idx = 1;

  if (req.query.severity) {
    filters.push(`severity = $${idx}`);
    params.push(String(req.query.severity).toUpperCase());
    idx += 1;
  }

  if (req.query.wallet_address) {
    filters.push(`wallet_address = $${idx}`);
    params.push(String(req.query.wallet_address).toLowerCase());
    idx += 1;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM alerts ${whereClause}`,
      params
    );

    const rowsResult = await pool.query(
      `
				SELECT id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, acknowledged, detected_at
				FROM alerts
				${whereClause}
				ORDER BY detected_at DESC
				LIMIT $${idx} OFFSET $${idx + 1}
			`,
      [...params, limit, offset]
    );

    res.json({
      total: countResult.rows[0]?.count || 0,
      page,
      limit,
      items: rowsResult.rows.map(row => ({
        ...row,
        meta: row.meta || {}
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/alerts/summary', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
			SELECT severity, COUNT(*)::int AS count
			FROM alerts
			GROUP BY severity
		`);

    const result = { total: 0, critical: 0, high: 0, medium: 0, low: 0, by_alert_type: {} };
    for (const row of rows) {
      const sev = String(row.severity || '').toLowerCase();
      const count = Number(row.count || 0);
      result.total += count;
      if (Object.prototype.hasOwnProperty.call(result, sev)) {
        result[sev] = count;
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new alert
app.post('/alerts', async (req, res) => {
  const { wallet_address, alert_type, severity, message, risk_score, meta, chain_id } = req.body;

  if (!alert_type || !message) {
    return res.status(400).json({ error: 'alert_type and message are required' });
  }

  try {
    const { rows } = await pool.query(
      `
        INSERT INTO alerts (
          wallet_address, alert_type, severity, message, 
          risk_score, meta, chain_id, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, detected_at
      `,
      [
        wallet_address,
        alert_type,
        severity || 'MEDIUM',
        message,
        risk_score || 0,
        meta ? JSON.stringify(meta) : null,
        chain_id || 'ethereum'
      ]
    );

    const newAlert = rows[0];

    // Publish to MQ
    await queue.publishAlert({
      ...newAlert,
      meta: newAlert.meta || {},
      event_type: 'ALERT_CREATED'
    });

    res.status(201).json({
      ...newAlert,
      meta: newAlert.meta || {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/alerts/:id/acknowledge', async (req, res) => {
  const id = req.params.id; // Use as string/UUID since some IDs are UUIDs

  try {
    const { rows } = await pool.query(
      `
				UPDATE alerts
				SET acknowledged = TRUE
				WHERE id = $1
				RETURNING id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, acknowledged, detected_at
			`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const alert = rows[0];
    
    // Publish acknowledgement event
    await queue.publishAlert({
      ...alert,
      event_type: 'ALERT_ACKNOWLEDGED'
    });

    res.json({ message: 'Alert acknowledged', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

ensureSchema()
  .then(async () => {
    // Connect to RabbitMQ
    await queue.connect();
    
    // Start Worker with dummy processor
await queue.startWorker(async (content) => {
  // If this is a risk event (no alert_type but contains risk data), persist it as an alert
  if (!content.alert_type && content.wallet_address && content.risk_score !== undefined) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO alerts (
          wallet_address, alert_type, severity, message, risk_score, meta, chain_id, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, wallet_address, alert_type, severity, message, risk_score, meta, chain_id, detected_at`,
        [
          content.wallet_address,
          content.alert_type || 'RISK_EVENT',
          content.severity || 'MEDIUM',
          content.message || 'Risk event received',
          content.risk_score,
          content.meta ? JSON.stringify(content.meta) : null,
          content.chain_id || 'ethereum'
        ]
      );
      // Publish a notification that a risk alert has been stored
      await queue.publishAlert({
        ...rows[0],
        event_type: 'RISK_ALERT_INSERTED'
      });
    } catch (err) {
      console.error('Failed to store risk event as alert:', err.message);
      // Propagate error to trigger retry logic
      throw err;
    }
  }

  // Existing demo failure behavior – keep occasional transient errors
  if (Math.random() < 0.1) {
    throw new Error('Transient connectivity error to external notification provider');
  }
  // Processing succeeded
  return true;
});
    
    app.listen(PORT, () => {
      console.log(`alert-service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize alert-service schema:', error.message);
    process.exit(1);
  });
