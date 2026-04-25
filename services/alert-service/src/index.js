const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3003', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());

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
			id BIGSERIAL PRIMARY KEY,
			wallet_address VARCHAR(255),
			alert_type VARCHAR(100) NOT NULL DEFAULT 'SUSPICIOUS_ACTIVITY',
			severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
			message TEXT NOT NULL,
			risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
			meta JSONB,
			chain_id VARCHAR(50) NOT NULL DEFAULT 'ethereum',
			acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
			detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_chain_id ON alerts(chain_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_alerts_wallet_address ON alerts(wallet_address)');
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'alert-service' });
});

app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'alert-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
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
      items: rowsResult.rows,
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

app.post('/alerts/:id/acknowledge', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid alert id' });
  }

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

    res.json({ message: 'Alert acknowledged', alert: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`alert-service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize alert-service schema:', error.message);
    process.exit(1);
  });
