require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  port: toInt(process.env.PORT, 8001),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://backend:8000',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@db:5432/blockchain_db',
  jwtSecretKey: process.env.JWT_SECRET_KEY || 'blockchain-sentinel-change-me-in-production',
  requestTimeoutMs: toInt(process.env.NODE_PROXY_TIMEOUT_MS, 30000),
};
