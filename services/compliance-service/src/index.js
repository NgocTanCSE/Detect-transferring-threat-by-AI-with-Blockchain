/**
 * Blockchain AI - Compliance Service
 * Microservice for governance and AML policy management
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const queue = require('./services/queue');
const traceMiddleware = require('../../shared/trace');
require('dotenv').config();
const { client, requestMetrics } = require('../../shared/metrics');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3006;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
app.use(helmet());
app.use(cors());
app.use(express.json());

// Correlation ID Middleware
app.use(traceMiddleware);
app.use(requestMetrics);

// Logging middleware (Morgan)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

const { withRetry } = require('./utils/retry');

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'compliance-service',
    timestamp: new Date()
  });
});

// Ready check
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'compliance-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

/**
 * POST /evaluate-policy
 * Evaluate a wallet against active policy rules.
 * Body: { wallet_address: string, risk_score?: number, account_status?: string }
 */
app.post('/evaluate-policy', async (req, res) => {
  const { wallet_address, risk_score, account_status } = req.body;
  if (!wallet_address) {
    return res.status(400).json({ error: 'wallet_address is required' });
  }
  const risk = parseFloat(risk_score || 0);
  const status = (account_status || '').toLowerCase() || 'active';

  try {
    // Load active policy rules ordered by priority
    const { rows: rules } = await withRetry(() => pool.query(
      'SELECT * FROM policy_rules WHERE is_active = true ORDER BY priority ASC, created_at DESC'
    ));

    // Determine blacklist status of the wallet
    const blacklistRes = await withRetry(() => pool.query(
      'SELECT 1 FROM blacklist WHERE LOWER(address) = $1',
      [wallet_address.toLowerCase()]
    ));
    const isBlacklisted = blacklistRes.rowCount > 0;

    // Evaluate each rule sequentially (first match wins)
    for (const rule of rules) {
      let block = false;
      let reason = '';

      if (risk >= parseFloat(rule.min_risk_score)) {
        block = true;
        reason = `Risk score ${risk} >= ${rule.min_risk_score}`;
      }
      if (!block && rule.block_blacklisted && isBlacklisted) {
        block = true;
        reason = 'Wallet is blacklisted';
      }
      if (!block && rule.block_suspended && ['suspended', 'frozen', 'under_review'].includes(status)) {
        block = true;
        reason = `Account status ${status} blocked by policy`;
      }

      if (block) {
        // Publish notification if rule requests it
        if (rule.notify_on_block) {
          await queue.publishEvent('policy.blocked', {
            event_type: 'POLICY_BLOCKED',
            wallet_address,
            risk_score: risk,
            account_status: status,
            rule_id: rule.id,
            rule_name: rule.rule_name,
            reason,
            timestamp: new Date().toISOString()
          });
        }
        return res.json({ blocked: true, rule_id: rule.id, rule_name: rule.rule_name, reason });
      }
    }

    // No rule triggered a block
    res.json({ blocked: false });
  } catch (error) {
    console.error('Policy evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate policy' });
  }
});

// Get all policy rules
app.get('/policy-rules', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM policy_rules ORDER BY priority ASC, created_at DESC'
    );
    res.json({
      count: result.rows.length,
      items: result.rows
    });
  } catch (error) {
    console.error('Error fetching policy rules:', error);
    res.status(500).json({ error: 'Failed to fetch policy rules' });
  }
});

// Create new policy rule
app.post('/policy-rules', async (req, res) => {
  const {
    rule_name,
    description,
    min_risk_score,
    block_blacklisted,
    block_suspended,
    notify_on_block,
    priority,
    is_active,
    created_by
  } = req.body;

  if (!rule_name) {
    return res.status(400).json({ error: 'rule_name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO policy_rules (
        rule_name, description, min_risk_score, block_blacklisted, 
        block_suspended, notify_on_block, priority, is_active, 
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        rule_name,
        description || '',
        min_risk_score || 80.0,
        block_blacklisted !== false,
        block_suspended !== false,
        notify_on_block !== false,
        priority || 10,
        is_active !== false,
        created_by || null
      ]
    );
    const newRule = result.rows[0];

    // Publish event
    await queue.publishEvent('policy.rule.created', {
      event_type: 'POLICY_RULE_CREATED',
      rule_id: newRule.id,
      rule_name: newRule.rule_name,
      priority: newRule.priority,
      timestamp: new Date().toISOString()
    });

    res.status(201).json(newRule);
  } catch (error) {
    console.error('Error creating policy rule:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Policy rule name already exists' });
    }
    res.status(500).json({ error: 'Failed to create policy rule' });
  }
});

// Update policy rule
app.put('/policy-rules/:id', async (req, res) => {
  const { id } = req.params;
  const {
    rule_name,
    description,
    min_risk_score,
    block_blacklisted,
    block_suspended,
    notify_on_block,
    priority,
    is_active
  } = req.body;

  try {
    // Check if exists
    const checkResult = await pool.query('SELECT * FROM policy_rules WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Policy rule not found' });
    }

    const current = checkResult.rows[0];

    const result = await pool.query(
      `UPDATE policy_rules SET
        rule_name = $1,
        description = $2,
        min_risk_score = $3,
        block_blacklisted = $4,
        block_suspended = $5,
        notify_on_block = $6,
        priority = $7,
        is_active = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING *`,
      [
        rule_name || current.rule_name,
        description !== undefined ? description : current.description,
        min_risk_score !== undefined ? min_risk_score : current.min_risk_score,
        block_blacklisted !== undefined ? block_blacklisted : current.block_blacklisted,
        block_suspended !== undefined ? block_suspended : current.block_suspended,
        notify_on_block !== undefined ? notify_on_block : current.notify_on_block,
        priority !== undefined ? priority : current.priority,
        is_active !== undefined ? is_active : current.is_active,
        id
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating policy rule:', error);
    res.status(500).json({ error: 'Failed to update policy rule' });
  }
});

// Delete policy rule
app.delete('/policy-rules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM policy_rules WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy rule not found' });
    }
    res.json({ message: 'Policy rule deleted', rule: result.rows[0] });
  } catch (error) {
    console.error('Error deleting policy rule:', error);
    res.status(500).json({ error: 'Failed to delete policy rule' });
  }
});

// Export SAR Report (Suspicious Activity Report)
app.post('/compliance/sar/export', async (req, res) => {
  const { case_id, format = 'csv' } = req.body;

  try {
    // In a real system, we'd fetch case details, alerts, and transaction history
    // For now, let's fetch based on the transaction hash if provided as case_id
    const result = await pool.query(
      `SELECT t.*, w.risk_score, w.account_status, a.severity, a.message as alert_message
       FROM transactions t
       LEFT JOIN wallets w ON LOWER(t.from_address) = LOWER(w.address)
       LEFT JOIN alerts a ON LOWER(t.tx_hash) = LOWER(a.wallet_address) -- Simplified join
       WHERE t.tx_hash = $1`,
      [case_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Case/Transaction not found' });
    }

    const data = result.rows[0];
    
    // Generate CSV content
    const csvRows = [
      ['Report Field', 'Value'],
      ['Report ID', uuidv4()],
      ['Generated At', new Date().toISOString()],
      ['Transaction Hash', data.tx_hash],
      ['From Address', data.from_address],
      ['To Address', data.to_address],
      ['Value (Wei)', data.value],
      ['Risk Score', data.risk_score],
      ['Account Status', data.account_status],
      ['Alert Severity', data.severity],
      ['Alert Message', data.alert_message],
      ['Compliance Officer', req.headers['x-user-id'] || 'System'],
      ['Organization ID', req.headers['x-org-id'] || 'None']
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=SAR_Report_${case_id}.csv`);
    res.status(200).send(csvContent);

  } catch (error) {
    console.error('Error exporting SAR:', error);
    res.status(500).json({ error: 'Failed to export SAR report' });
  }
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
      console.warn(`[RBAC] Access denied for role: ${userRole}`);
      return res.status(403).json({
        error: 'Forbidden: You do not have the required permissions for this compliance action.'
      });
    }
    next();
  };
};

const COMPLIANCE_ROLES = ['admin', 'compliance_risk_manager', 'security_analyst', 'system_admin'];

/**
 * GET /cases
 * List cases for analyst board
 */
app.get('/cases', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const minRisk = parseFloat(req.query.min_risk || 0.80);
  const status = req.query.status;
  const assignedTo = req.query.assigned_to;
  const limit = parseInt(req.query.limit || 100);

  try {
    let query = `
      SELECT t.*, 
             w_from.risk_score as from_risk, 
             w_to.risk_score as to_risk
      FROM transactions t
      LEFT JOIN wallets w_from ON LOWER(t.from_address) = LOWER(w_from.address)
      LEFT JOIN wallets w_to ON LOWER(t.to_address) = LOWER(w_to.address)
      WHERE (t.normalized_risk_score >= $1 OR t.is_flagged = true)
    `;
    const params = [minRisk];

    if (status) {
      params.push(status.toUpperCase());
      query += ` AND t.case_status = $${params.length}`;
    }

    if (assignedTo) {
      params.push(assignedTo);
      query += ` AND t.assigned_to = $${params.length}`;
    }

    query += ` ORDER BY t.updated_at DESC NULLS LAST, t.timestamp DESC NULLS LAST LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({
      count: result.rows.length,
      min_risk: minRisk,
      cases: result.rows.map(tx => ({
        tx_hash: tx.tx_hash,
        from_address: tx.from_address,
        to_address: tx.to_address,
        value: tx.value ? tx.value.toString() : '0',
        risk_score: tx.normalized_risk_score ? parseFloat(tx.normalized_risk_score) : null,
        status: tx.case_status || 'PENDING',
        assigned_to: tx.assigned_to,
        is_flagged: !!tx.is_flagged,
        flag_reason: tx.flag_reason,
        timestamp: tx.timestamp ? tx.timestamp.toISOString() : null,
        updated_at: tx.updated_at ? tx.updated_at.toISOString() : null,
      }))
    });
  } catch (error) {
    console.error('[COMPLIANCE] Failed to list cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

/**
 * REPORTING ENDPOINTS
 */

app.get('/reporting/summary', async (req, res) => {
  const days = parseInt(req.query.days || 30);
  try {
    const period_start = new Date();
    period_start.setDate(period_start.getDate() - days);

    // Fetch real counts for KPIs
    const alertsCount = await pool.query('SELECT COUNT(*) FROM alerts WHERE detected_at >= $1', [period_start]);
    const criticalCount = await pool.query('SELECT COUNT(*) FROM alerts WHERE severity = \'CRITICAL\' AND detected_at >= $1', [period_start]);
    const blockedCount = await pool.query('SELECT COUNT(*) FROM blocked_transfers WHERE blocked_at >= $1', [period_start]);
    const policiesCount = await pool.query('SELECT COUNT(*) FROM policy_rules WHERE is_active = true');
    const auditCount = await pool.query('SELECT COUNT(*) FROM audit_logs WHERE timestamp >= $1', [period_start]);

    // Fetch real case counts
    const pendingCases = await pool.query("SELECT COUNT(*) FROM transactions WHERE case_status = 'PENDING' OR case_status IS NULL");
    const verifiedCases = await pool.query("SELECT COUNT(*) FROM transactions WHERE case_status = 'VERIFIED'");
    const fraudCases = await pool.query("SELECT COUNT(*) FROM transactions WHERE case_status = 'FRAUD'");
    const ignoredCases = await pool.query("SELECT COUNT(*) FROM transactions WHERE case_status = 'IGNORED'");

    res.json({
      period: {
        days: days,
        start: period_start.toISOString(),
        end: new Date().toISOString()
      },
      kpis: {
        alerts_total: parseInt(alertsCount.rows[0].count),
        critical_alerts: parseInt(criticalCount.rows[0].count),
        blocked_total: parseInt(blockedCount.rows[0].count),
        blocked_value_eth: 145.8, // Mock value for now
        policy_rules_active: parseInt(policiesCount.rows[0].count),
        notifications_sent: parseInt(alertsCount.rows[0].count) * 2,
        notifications_failed: 0,
        audit_events: parseInt(auditCount.rows[0].count)
      },
      cases: {
        PENDING: parseInt(pendingCases.rows[0].count),
        VERIFIED: parseInt(verifiedCases.rows[0].count),
        FRAUD: parseInt(fraudCases.rows[0].count),
        IGNORED: parseInt(ignoredCases.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Reporting summary error:', error);
    res.status(500).json({ error: 'Failed to generate reporting summary' });
  }
});

app.get('/reporting/control-effectiveness', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const actionableAlerts = (await pool.query('SELECT COUNT(*) as c FROM alerts WHERE detected_at >= $1', [start])).rows[0].c;
    const blockedTotal = (await pool.query('SELECT COUNT(*) as c FROM blocked_transfers WHERE blocked_at >= $1', [start])).rows[0].c;
    const fraudCases = (await pool.query("SELECT COUNT(*) as c FROM transactions WHERE case_status = 'CONFIRMED_FRAUD' AND updated_at >= $1", [start])).rows[0].c;
    const ignoredCases = (await pool.query("SELECT COUNT(*) as c FROM transactions WHERE case_status = 'DISMISSED' AND updated_at >= $1", [start])).rows[0].c;

    const total = parseInt(actionableAlerts) || 1;
    const blocked = parseInt(blockedTotal);
    const fraud = parseInt(fraudCases);
    const ignored = parseInt(ignoredCases);

    res.json({
      period_days: days,
      inputs: {
        actionable_alerts: parseInt(actionableAlerts),
        blocked_total: blocked,
        fraud_cases: fraud,
        ignored_cases: ignored
      },
      metrics: {
        block_rate_pct: Math.round((blocked / total) * 1000) / 10,
        fraud_precision_proxy_pct: fraud + ignored > 0 ? Math.round((fraud / (fraud + ignored)) * 1000) / 10 : 0,
        decision_coverage: total > 0 ? Math.round(((fraud + ignored) / total) * 1000) / 10 : 0
      }
    });
  } catch (error) {
    console.error('Control effectiveness error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/reporting/audit-completeness', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = (await pool.query('SELECT action, COUNT(*) as c FROM audit_logs WHERE created_at >= $1 GROUP BY action ORDER BY c DESC', [start])).rows;
    const totalLogs = logs.reduce((sum, r) => sum + parseInt(r.c), 0);

    res.json({
      period_days: days,
      required_actions: 500,
      present_actions: totalLogs,
      completeness_pct: Math.min(100, Math.round((totalLogs / 500) * 1000) / 10),
      checks: [
        { action_type: 'CASE_REVIEW', count: parseInt(logs.find(l => l.action === 'CASE_REVIEW')?.c || 0), present: logs.some(l => l.action === 'CASE_REVIEW') },
        { action_type: 'POLICY_UPDATE', count: parseInt(logs.find(l => l.action === 'POLICY_UPDATE')?.c || 0), present: logs.some(l => l.action === 'POLICY_UPDATE') },
        { action_type: 'SAR_EXPORT', count: parseInt(logs.find(l => l.action === 'SAR_EXPORT')?.c || 0), present: logs.some(l => l.action === 'SAR_EXPORT') }
      ]
    });
  } catch (error) {
    console.error('Audit completeness error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

app.get('/reporting/audit-gaps', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const expectedActions = ['CASE_REVIEW', 'POLICY_UPDATE', 'SAR_EXPORT', 'CASE_ASSIGN', 'CASE_ACTION'];
    const presentActions = (await pool.query('SELECT DISTINCT action FROM audit_logs WHERE created_at >= $1', [start])).rows.map(r => r.action);

    const missingActions = expectedActions
      .filter(a => !presentActions.includes(a))
      .map(a => ({
        action_type: a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        owner_role: a.startsWith('CASE') ? 'analyst' : 'manager',
        reason: 'No audit logs found in period',
        recommended_next_step: 'Review logging configuration'
      }));

    // Also check for transactions with suspicious ratio but no case yet
    const highRiskNoCase = (await pool.query(`
      SELECT COUNT(*) as c FROM transactions t
      LEFT JOIN transaction_cases tc ON t.tx_hash = tc.tx_hash
      WHERE tc.id IS NULL AND t.risk_score > 0.7 AND t.created_at >= $1
    `, [start])).rows[0].c;

    res.json({
      period_days: days,
      missing_count: missingActions.length + (parseInt(highRiskNoCase) > 0 ? 1 : 0),
      missing_actions: missingActions
    });
  } catch (error) {
    console.error('Audit gaps error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /cases/:tx_hash/assign
 * Assign case to analyst
 */
app.post('/cases/:tx_hash/assign', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const { tx_hash } = req.params;
  const { assigned_to, assigned_by, note } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txRes = await client.query('SELECT * FROM transactions WHERE tx_hash = $1', [tx_hash]);
    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txRes.rows[0];
    const status = tx.case_status || 'PENDING';

    await client.query(
      'UPDATE transactions SET assigned_to = $1, case_status = $2, updated_at = NOW() WHERE tx_hash = $3',
      [assigned_to, status, tx_hash]
    );

    await client.query(
      'INSERT INTO transaction_cases (id, tx_hash, analyst_id, action, state, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [uuidv4(), tx_hash, assigned_to, 'ASSIGN', status, note]
    );

    await client.query(
      'INSERT INTO audit_logs (id, action_type, entity_type, user_identifier, details, timestamp) VALUES ($1, $2, $3, $4, $5, NOW())',
      [uuidv4(), 'CASE_ASSIGN', 'transaction', assigned_by || 'system', JSON.stringify({ tx_hash, assigned_to, note })]
    );

    await client.query('COMMIT');
    res.json({ message: 'Case assigned', tx_hash, status, assigned_to });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[COMPLIANCE] Assignment failed:', error);
    res.status(500).json({ error: 'Failed to assign case' });
  } finally {
    client.release();
  }
});

/**
 * POST /cases/:tx_hash/action
 * Apply case action (CONFIRM_FRAUD, DISMISS, ESCALATE)
 */
app.post('/cases/:tx_hash/action', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const { tx_hash } = req.params;
  const { action, analyst_id, note } = req.body;

  const CASE_ACTIONS = ["CONFIRM_FRAUD", "DISMISS", "ESCALATE"];
  const normalizedAction = (action || '').toUpperCase().trim();

  if (!CASE_ACTIONS.includes(normalizedAction)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const txRes = await client.query('SELECT * FROM transactions WHERE tx_hash = $1', [tx_hash]);
    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txRes.rows[0];
    const currentStatus = (tx.case_status || 'PENDING').toUpperCase();
    let targetStatus = currentStatus;

    if (normalizedAction === 'CONFIRM_FRAUD') targetStatus = 'FRAUD';
    else if (normalizedAction === 'DISMISS') targetStatus = 'IGNORED';
    else if (normalizedAction === 'ESCALATE') {
      targetStatus = currentStatus === 'PENDING' ? 'VERIFIED' : currentStatus;
    }

    await client.query(
      'UPDATE transactions SET case_status = $1, assigned_to = $2, updated_at = NOW() WHERE tx_hash = $3',
      [targetStatus, analyst_id || tx.assigned_to, tx_hash]
    );

    await client.query(
      'INSERT INTO transaction_cases (id, tx_hash, analyst_id, action, state, note, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [uuidv4(), tx_hash, analyst_id || tx.assigned_to, normalizedAction, targetStatus, note]
    );

    await client.query(
      'INSERT INTO audit_logs (id, action_type, entity_type, user_identifier, details, timestamp) VALUES ($1, $2, $3, $4, $5, NOW())',
      [uuidv4(), `CASE_${normalizedAction}`, 'transaction', analyst_id || 'system', JSON.stringify({ tx_hash, previous_status: currentStatus, new_status: targetStatus, note })]
    );

    await client.query('COMMIT');
    res.json({ message: 'Case action applied', tx_hash, action: normalizedAction, previous_status: currentStatus, new_status: targetStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[COMPLIANCE] Action failed:', error);
    res.status(500).json({ error: 'Failed to apply case action' });
  } finally {
    client.release();
  }
});

/**
 * GET /cases/:tx_hash/history
 */
app.get('/cases/:tx_hash/history', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const { tx_hash } = req.params;

  try {
    const txRes = await pool.query('SELECT * FROM transactions WHERE tx_hash = $1', [tx_hash]);
    if (txRes.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const history = await pool.query(
      'SELECT * FROM transaction_cases WHERE tx_hash = $1 ORDER BY created_at DESC',
      [tx_hash]
    );

    res.json({
      tx_hash,
      status: txRes.rows[0].case_status,
      assigned_to: txRes.rows[0].assigned_to,
      history: history.rows.map(entry => ({
        id: entry.id,
        action: entry.action,
        state: entry.state,
        analyst_id: entry.analyst_id,
        note: entry.note,
        created_at: entry.created_at ? entry.created_at.toISOString() : null,
      }))
    });
  } catch (error) {
    console.error('[COMPLIANCE] History fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch case history' });
  }
});

// Get audit logs
app.get('/audit/logs', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const limit = parseInt(req.query.limit || 100);
  try {
    const result = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    res.json({ count: result.rows.length, logs: result.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

app.get('/logs', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  const limit = parseInt(req.query.limit || 100);
  try {
    const result = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    res.json({ count: result.rows.length, logs: result.rows });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Export audit logs
app.get('/audit/logs/export', requireRole(COMPLIANCE_ROLES), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000');
    const csvRows = [['ID', 'Timestamp', 'Action', 'Entity', 'Actor', 'Details']];
    result.rows.forEach(log => {
      csvRows.push([
        log.id,
        log.timestamp.toISOString(),
        log.action_type,
        log.entity_type,
        log.user_identifier,
        JSON.stringify(log.details).replace(/"/g, '""')
      ]);
    });
    const csvContent = csvRows.map(row => `"${row.join('","')}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({ error: 'Failed to export logs' });
  }
});

// Centralized error handler
app.use((err, req, res, next) => {
  logger.error(`[${req.correlationId || 'no-id'}] Unhandled error: ${err.message}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Export the Express app for testing
module.exports = { app, pool };

// Start server only when executed directly
if (require.main === module) {
  queue.connect()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Compliance Service running on port ${PORT}`);
      });
    })
    .catch(console.error);
}

