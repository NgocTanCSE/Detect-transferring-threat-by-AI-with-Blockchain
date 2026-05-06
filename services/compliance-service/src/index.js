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
const logger = require('./utils/logger');
require('dotenv').config();

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
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Logging middleware (Morgan)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

const queue = require('./services/queue');

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'compliance-service', timestamp: new Date() });
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

// Get all policy rules
app.get('/compliance', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM policy_rules ORDER BY priority ASC, created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching policy rules:', error);
    res.status(500).json({ error: 'Failed to fetch policy rules' });
  }
});

// Create new policy rule
app.post('/compliance', async (req, res) => {
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
app.put('/compliance/:id', async (req, res) => {
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

// Start server
queue.connect().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Compliance Service running on port ${PORT}`);
  });
}).catch(console.error);
