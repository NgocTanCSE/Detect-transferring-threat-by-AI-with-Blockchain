/**
 * ⚠️ DEPRECATED - Monolith Orchestrator
 * 
 * This service has been fully decomposed into microservices.
 * All traffic should be routed through the API Gateway (port 8001).
 * 
 * Service map:
 *   Auth       → auth-service:3001
 *   Wallets    → wallet-service:3002
 *   Alerts     → alert-service:3003
 *   Transfers  → transfer-service:3004
 *   Analytics  → analytics-service:3005
 *   Compliance → compliance-service:3006
 *   Events     → event-service:3007
 *   AI/Core    → ai-service:8000
 * 
 * This stub remains only for backward compatibility during transition.
 * It will be removed in the next release.
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'deprecated',
    message: 'This monolith orchestrator is deprecated. Use API Gateway at port 8001.',
    service_map: {
      gateway: 'http://api-gateway:8001',
      auth: 'http://auth-service:3001',
      wallet: 'http://wallet-service:3002',
      alert: 'http://alert-service:3003',
      transfer: 'http://transfer-service:3004',
      analytics: 'http://analytics-service:3005',
      compliance: 'http://compliance-service:3006',
      event: 'http://event-service:3007',
      ai: 'http://ai-service:8000',
    },
    timestamp: new Date().toISOString(),
  });
});

// Catch-all: return deprecation notice for any route
app.all('*', (req, res) => {
  res.status(410).json({
    error: 'Gone',
    message: `This endpoint has been migrated. Use the API Gateway at port 8001.`,
    path: req.path,
  });
});

app.listen(PORT, () => {
  console.log(`⚠️  Deprecated Orchestrator stub on port ${PORT} — Use API Gateway instead`);
});
