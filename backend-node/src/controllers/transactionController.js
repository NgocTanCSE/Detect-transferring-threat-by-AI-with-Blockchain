const aiService = require('../services/aiService');

function isLikelyWalletAddress(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('0x');
}

function toSafeLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit || ''), 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(Math.max(parsed, 1), 200);
}

class TransactionController {
  async getWalletTransactions(req, res) {
    const { wallet_address } = req.params;
    const { chain, limit } = req.query;

    if (!isLikelyWalletAddress(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet_address format' });
    }

    try {
      const data = await aiService.getTransactions(wallet_address, chain, toSafeLimit(limit));
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch wallet transactions' });
    }
  }

  async analyzeWallet(req, res) {
    const { wallet_address } = req.params;
    const { chain } = req.query;

    if (!isLikelyWalletAddress(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet_address format' });
    }

    try {
      const data = await aiService.analyzeWallet(wallet_address, chain);

      // If a high risk is detected, emit a real-time alert via WebSockets
      if (data.risk_score >= 80) {
        req.io.emit('new-threat', {
          address: wallet_address,
          score: data.risk_score,
          level: data.risk_level,
          chain: chain || 'ethereum',
          timestamp: new Date()
        });
      }

      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to analyze wallet' });
    }
  }
}

module.exports = new TransactionController();
