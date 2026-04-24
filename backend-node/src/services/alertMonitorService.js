const axios = require('axios');
const { aiServiceUrl } = require('../config/env');

const DEFAULT_POLL_INTERVAL_MS = Number.parseInt(process.env.ALERT_POLL_INTERVAL_MS || '10000', 10);
const MAX_SEEN_ALERTS = 500;

class AlertMonitorService {
  constructor() {
    this.timer = null;
    this.seenAlertIds = new Set();
  }

  _remember(alertId) {
    if (!alertId) {
      return;
    }

    this.seenAlertIds.add(alertId);
    if (this.seenAlertIds.size <= MAX_SEEN_ALERTS) {
      return;
    }

    const earliest = this.seenAlertIds.values().next().value;
    if (earliest) {
      this.seenAlertIds.delete(earliest);
    }
  }

  async _pollAndEmit(io) {
    try {
      const response = await axios.get(`${aiServiceUrl}/alerts/latest`, {
        timeout: 10000,
      });

      const alerts = Array.isArray(response.data?.alerts) ? response.data.alerts : [];
      for (const alert of alerts) {
        const alertId = alert.alert_id || alert.id;
        if (!alertId || this.seenAlertIds.has(alertId)) {
          continue;
        }

        this._remember(alertId);

        const riskScore = Number(alert.risk_score || 0);
        if (riskScore < 80 && String(alert.severity || '').toUpperCase() !== 'CRITICAL') {
          continue;
        }

        io.emit('new-threat', {
          address: alert.wallet_address,
          score: riskScore,
          level: alert.severity || 'HIGH',
          chain: alert.chain_id || 'ethereum',
          message: alert.message,
          timestamp: alert.detected_at || new Date().toISOString(),
          source: 'alert-monitor',
        });
      }
    } catch (error) {
      console.error('Alert monitor poll failed:', error.message);
    }
  }

  start(io) {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this._pollAndEmit(io);
    }, DEFAULT_POLL_INTERVAL_MS);

    this._pollAndEmit(io);
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = new AlertMonitorService();
