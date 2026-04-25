const express = require('express');
const httpProxy = require('http-proxy');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

app.use(limiter);

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  wallet: process.env.WALLET_SERVICE_URL || 'http://wallet-service:3002',
  alert: process.env.ALERT_SERVICE_URL || 'http://alert-service:3003',
  transfer: process.env.TRANSFER_SERVICE_URL || 'http://transfer-service:3004',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3005',
  compliance: process.env.COMPLIANCE_SERVICE_URL || 'http://compliance-service:3006',
  event: process.env.EVENT_SERVICE_URL || 'http://event-service:3007',
};

// Proxy instances
const proxies = {};
Object.entries(SERVICES).forEach(([key, url]) => {
  proxies[key] = httpProxy.createProxyServer({ target: url });
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Ready check - verify all services are available
app.get('/ready', async (req, res) => {
  const axios = require('axios');
  const checks = {};

  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const response = await axios.get(`${url}/health`, { timeout: 2000 });
      checks[name] = { status: 'healthy' };
    } catch (error) {
      checks[name] = { status: 'unhealthy', error: error.message };
    }
  }

  const allHealthy = Object.values(checks).every((check) => check.status === 'healthy');
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks,
  });
});

// Auth middleware
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  // Public routes
  const publicRoutes = ['/auth/register', '/auth/login'];
  if (publicRoutes.some((route) => req.path.startsWith(route))) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    // Verify token with API Gateway
    const decoded = jwt.decode(token); // In production, verify with secret
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

app.use(verifyToken);

// Route mapping
const ROUTE_MAP = {
  // Auth Service (3001)
  '/auth': 'auth',
  '/register': 'auth',
  '/login': 'auth',

  // Wallet Service (3002)
  '/wallets': 'wallet',
  '/balance': 'wallet',

  // Alert Service (3003)
  '/alerts': 'alert',

  // Transfer Service (3004)
  '/transfers': 'transfer',
  '/protected-transfer': 'transfer',

  // Analytics Service (3005)
  '/statistics': 'analytics',
  '/dashboard': 'analytics',
  '/analytics': 'analytics',

  // Compliance Service (3006)
  '/compliance': 'compliance',
  '/blocked': 'compliance',
  '/aml': 'compliance',

  // Event Service (3007)
  '/events': 'event',
};

// Find service for route
function getService(path) {
  for (const [prefix, service] of Object.entries(ROUTE_MAP)) {
    if (path.startsWith(prefix)) {
      return service;
    }
  }
  return null;
}

// Route handler
app.all('*', (req, res) => {
  const service = getService(req.path);

  if (!service) {
    return res.status(404).json({
      error: 'Not found',
      availableRoutes: Object.keys(ROUTE_MAP),
    });
  }

  const proxy = proxies[service];
  const target = SERVICES[service];

  console.log(`→ Proxying ${req.method} ${req.path} to ${service} (${target})`);

  proxy.web(req, res, (error) => {
    console.error(`Proxy error for ${service}:`, error.message);
    res.status(503).json({
      error: 'Service unavailable',
      service,
    });
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway started on port ${PORT}`);
  console.log('Services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
});

module.exports = app;
