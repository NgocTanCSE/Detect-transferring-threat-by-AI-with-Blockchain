const express = require('express');
const httpProxy = require('http-proxy');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const logger = require('./utils/logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// Middleware
app.use(helmet());
app.use(cors());

// Correlation ID Middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increase to 1000 for testing
  message: { error: 'Too many requests, please try again later.' },
});

app.use(limiter);

// Logging middleware (Morgan)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Service URLs
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  wallet: process.env.WALLET_SERVICE_URL || 'http://wallet-service:3002',
  alert: process.env.ALERT_SERVICE_URL || 'http://alert-service:3003',
  transfer: process.env.TRANSFER_SERVICE_URL || 'http://transfer-service:3004',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3005',
  compliance: process.env.COMPLIANCE_SERVICE_URL || 'http://compliance-service:3006',
  event: process.env.EVENT_SERVICE_URL || 'http://event-service:3007',
  ai: process.env.AI_SERVICE_URL || 'http://ai-service:8000',
};

// Proxy instances with correlation ID forwarding
const proxies = {};
Object.entries(SERVICES).forEach(([key, url]) => {
  proxies[key] = httpProxy.createProxyServer({ target: url });
  
  // Forward correlation ID to downstream services
  proxies[key].on('proxyReq', (proxyReq, req) => {
    if (req.correlationId) {
      proxyReq.setHeader('x-correlation-id', req.correlationId);
    }
  });
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
  if (req.method === 'OPTIONS') {
    return next();
  }

  const token = req.headers['authorization']?.split(' ')[1];

  // Public routes that don't require auth
  const publicRoutes = [
    '/health',
    '/ready',
    '/auth/register',
    '/auth/login',
    '/auth/validate',
    '/auth/health',
    '/auth/ready',
    // Admin Dashboard Routes
    '/ops',
    '/cases',
    '/statistics',
    '/analytics',
    '/alerts',
    '/blocked',
    '/compliance',
    '/admin'
  ];
  // Routes where auth header is forwarded to downstream service (auth service handles its own verification)
  const authPassthroughRoutes = [
    '/auth/me',
    '/auth/profile',
    '/auth/refresh',
    '/auth/logout',
  ];
  if (publicRoutes.some((route) => req.path.startsWith(route))) {
    return next();
  }
  // For auth passthrough routes, forward the request as-is (let the auth service verify the token)
  if (authPassthroughRoutes.some((route) => req.path.startsWith(route))) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
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

  // AI Service (8000) - Assistant, Ops, Case Management
  '/assistant': 'ai',
  '/ops': 'ai',
  '/api': 'ai',
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

  // Auth service uses internal paths like /register and /login.
  // Gateway exposes them as /auth/register and /auth/login.
  if (service === 'auth' && req.url.startsWith('/auth')) {
    req.url = req.url.replace(/^\/auth/, '') || '/';
  }

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
