const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://backend:8000';

function buildFallbackRiskAssessment(address, chain, reason) {
  const normalized = String(address || '').toLowerCase().trim();
  const isValidEthLike = /^0x[a-f0-9]{40}$/.test(normalized);

  let riskScore = 35;
  let riskLevel = 'LOW';
  const reasons = ['Fallback mode: AI service unavailable'];

  if (!isValidEthLike) {
    riskScore = 90;
    riskLevel = 'CRITICAL';
    reasons.push('Invalid wallet address format');
  } else if (/^(0x)?([a-f0-9])\2{10,}/.test(normalized)) {
    riskScore = 80;
    riskLevel = 'HIGH';
    reasons.push('Suspicious repeated-character address pattern');
  }

  return {
    address: normalized,
    chain: chain || 'ethereum',
    risk_score: riskScore,
    risk_level: riskLevel,
    details: {
      fallback_rules: {
        active: true,
        reasons,
        upstream_error: reason,
      },
    },
    ai_insight: `System is running in fallback mode. Rule-based score: ${riskScore}.`,
    detection_count: 0,
    fallback: true,
  };
}

class AIService {
  /**
   * Forward a wallet analysis request to the Python AI Microservice.
   */
  async analyzeWallet(address, chain = 'ethereum') {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/analyze/${address}`, {
        params: { chain }
      });
      return response.data;
    } catch (error) {
      console.error('Error calling AI Service:', error.message);
      return buildFallbackRiskAssessment(address, chain, error.message);
    }
  }

  /**
   * Fetch recent transactions from Python backend (which acts as data source).
   */
  async getTransactions(address, chain = 'ethereum', limit = 20) {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/transactions/${address}`, {
        params: { chain, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error.message);
      return {
        address,
        chain,
        count: 0,
        transactions: [],
        fallback: true,
        message: 'Data service is unavailable. Returning empty transaction list.',
      };
    }
  }
}

module.exports = new AIService();
