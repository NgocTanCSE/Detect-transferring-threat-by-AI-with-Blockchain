const axios = require('axios');
require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://backend:8000';

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
      throw new Error('AI Analysis Service is currently unavailable');
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
      throw new Error('Data Service is currently unavailable');
    }
  }
}

module.exports = new AIService();
