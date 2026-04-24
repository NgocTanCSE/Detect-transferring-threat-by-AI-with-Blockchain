const aiService = require('../services/aiService');

class TransactionController {
  async getWalletTransactions(req, res) {
    const { wallet_address } = req.params;
    const { chain, limit } = req.query;
    
    try {
      const data = await aiService.getTransactions(wallet_address, chain, limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async analyzeWallet(req, res) {
    const { wallet_address } = req.params;
    const { chain } = req.query;

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

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new TransactionController();
