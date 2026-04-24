const Alert = require('../models/Alert');
const { Op } = require('sequelize');

class AlertController {
  async getAlerts(req, res) {
    const { page = 1, limit = 20, severity, wallet_address } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (severity) where.severity = severity;
    if (wallet_address) where.wallet_address = wallet_address;

    try {
      const { count, rows } = await Alert.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['detected_at', 'DESC']]
      });

      res.json({
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        items: rows
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAlertSummary(req, res) {
    try {
      const summary = await Alert.findAll({
        attributes: [
          'severity',
          [Alert.sequelize.fn('COUNT', Alert.sequelize.col('id')), 'count']
        ],
        group: ['severity']
      });

      const result = {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        by_alert_type: {} // Optional: add alert type grouping if needed
      };

      summary.forEach(item => {
        const sev = item.get('severity').toLowerCase();
        const count = parseInt(item.get('count'));
        result.total += count;
        if (result[sev] !== undefined) {
          result[sev] = count;
        }
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async acknowledgeAlert(req, res) {
    const { id } = req.params;
    try {
      const alert = await Alert.findByPk(id);
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      alert.acknowledged = true;
      await alert.save();
      res.json({ message: 'Alert acknowledged', alert });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AlertController();
