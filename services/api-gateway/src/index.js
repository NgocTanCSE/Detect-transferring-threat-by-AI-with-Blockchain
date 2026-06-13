const express = require('express');
const httpProxy = require('http-proxy');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

// Add correlation ID token for request logs
morgan.token('corr', (req) => req.correlationId || '-');
const CircuitBreaker = require('opossum');
const logger = require('./utils/logger');
require('dotenv').config();
const { Pool } = require('pg');
const traceMiddleware = require('../../shared/trace');
const { client, requestMetrics } = require('../../shared/metrics');

// Database connection for API Key validation
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'your_jwt_secret_key_here_change_in_production';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// Middleware
app.use(helmet());
app.use(cors());

// Log usage to database
const logUsage = async (req, res, responseTime) => {
  if (!req.user && !req.headers['x-api-key']) return;
  
  try {
    const orgId = req.user?.org_id || null;
    const userId = req.user?.sub?.startsWith('api_key_') ? null : (req.user?.sub || null);
    
    await pool.query(
      `INSERT INTO usage_logs (
        organization_id, user_id, endpoint, method, 
        status_code, response_time_ms, ip_address, user_agent, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        orgId,
        userId,
        req.path,
        req.method,
        res.statusCode,
        responseTime,
        req.ip || req.headers['x-forwarded-for'] || 'unknown',
        req.headers['user-agent'] || 'unknown'
      ]
    );
  } catch (error) {
    console.error('[GATEWAY USAGE] Failed to log usage:', error.message);
  }
};

// Correlation ID Middleware
app.use(traceMiddleware);
app.use(requestMetrics);

// Rate limiting tiers
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Increased for demo
  message: { error: 'Too many authentication attempts, please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Increased for demo
  message: { error: 'API rate limit exceeded, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const dashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5000, // Increased for demo
  message: { error: 'Dashboard polling too frequent.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting based on path
app.use((req, res, next) => {
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
    return authLimiter(req, res, next);
  }
  if (req.path.includes('/statistics') || req.path.includes('/dashboard') || req.path.includes('/ops/')) {
    return dashboardLimiter(req, res, next);
  }
  return apiLimiter(req, res, next);
});

// Logging middleware (Morgan)
app.use(morgan(':corr :method :url :status :response-time ms', {
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
const circuitBreakers = {};
Object.entries(SERVICES).forEach(([key, url]) => {
  const proxy = httpProxy.createProxyServer({ target: url });
  
  // Forward correlation ID and user info to downstream services
  proxy.on('proxyReq', (proxyReq, req) => {
    if (req.correlationId) {
      proxyReq.setHeader('x-correlation-id', req.correlationId);
    }
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.sub || '');
      proxyReq.setHeader('x-user-role', req.user.role || '');
      proxyReq.setHeader('x-org-id', req.user.org_id || '');
    }
  });
  
  // Store proxy for ws upgrades
  proxies[key] = proxy;
  
  // Create a circuit breaker around the proxy call for HTTP requests
  const breaker = new CircuitBreaker((req, res) => {
    return new Promise((resolve, reject) => {
      proxy.web(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, {
    timeout: 5000, // 5 seconds
    errorThresholdPercentage: 50,
    resetTimeout: 10000 // 10 seconds before trying again
  });
  circuitBreakers[key] = breaker;
});

// Version endpoint
app.get('/version', (req, res) => {
  const aiVersion = process.env.AI_MODEL_VERSION || 'v1.0';
  res.json({
    service: 'api-gateway',
    version: 'v1.0',
    ai_service_version: aiVersion
  });
});
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    dlq_metrics: { main: 0, dead: 0 }
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
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Auth middleware (supports JWT and API Key)
const verifyAuth = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Public routes (no auth required)
  const publicRoutes = [
    '/health', '/ready',
    '/auth/register', '/auth/login', '/auth/validate',
    '/socket.io',
    // Dashboard monitoring endpoints — read-only, no auth needed
    '/statistics', '/dashboard', '/alerts/recent', '/alerts/latest',
    '/blocked-transfers', '/analyze',
    '/wallets', '/wallet/',
    '/diagnostics',
    '/ops/', '/admin/diagnostics',
    '/cases',
    '/assistant',
  ];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  // Check for API Key first
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const result = await pool.query(
        'SELECT id, name, slug FROM organizations WHERE api_key = $1 AND is_active = TRUE',
        [apiKey]
      );
      
      if (result.rows.length > 0) {
        const org = result.rows[0];
        req.user = {
          org_id: org.id,
          org_name: org.name,
          role: 'api_client',
          sub: `api_key_${org.slug}`
        };
        console.log(`[GATEWAY AUTH] API Key validated for org: ${org.name}`);
        return next();
      }
    } catch (error) {
      console.error('[GATEWAY AUTH] API Key validation error:', error.message);
    }
  }

  // Fallback to JWT
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access denied: No token or API key provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

app.use(verifyAuth);

// Route mapping
const ROUTE_MAP = {
  // Auth Service (3001)
  '/auth': 'auth',

  // Wallet Service (3002)
  '/wallets': 'wallet',
  '/balance': 'wallet',
  '/wallet/': 'wallet',

  // Alert Service (3003)
  '/alerts': 'alert',

  // Transfer Service (3004)
  '/transfers': 'transfer',
  '/transfer': 'transfer',
  '/protected-transfer': 'transfer',

  // Analytics Service (3005)
  '/statistics': 'analytics',
  '/dashboard': 'analytics',
  '/analytics': 'analytics',
  '/ops/system/node-endpoints': 'analytics',
  '/ops/system/pipeline-metrics': 'analytics',

  // Compliance Service (3006)
  '/ops/compliance': 'compliance',
  '/compliance': 'compliance',
  '/cases': 'compliance',
  '/aml': 'compliance',
  '/policy-rules': 'compliance',

  // User endpoints (FastAPI backend)
  '/user': 'ai',
  // Feedback endpoints (FastAPI backend)
  '/feedback': 'ai',
  // Security endpoints (FastAPI backend)
  '/security': 'ai',
  // Admin diagnostics endpoints (FastAPI backend)
  '/admin': 'ai',

  // AI Service (FastAPI backend on port 8000) - Assistant, Ops, Case Management
  '/assistant': 'ai',
  '/ops/system': 'ai',
  '/ops/ai': 'ai',
  '/ops/security': 'ai',
  '/analyze': 'ai', 
  '/blocked-transfers': 'ai',
  '/socket.io': 'event',
};

// Prefixes to strip when forwarding to specific services
const STRIP_PREFIXES = {
  'auth': ['/auth'],
  'compliance': ['/ops/compliance'],
  'transfer': ['/transfer', '/transfers'],
};

// Find service for route using longest prefix match
function getService(path) {
  const matches = Object.entries(ROUTE_MAP)
    .filter(([prefix]) => path.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length); // Longest match first
    
  return matches.length > 0 ? matches[0][1] : null;
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

  const breaker = circuitBreakers[service];
  const target = SERVICES[service];

  // Handle prefix stripping
  if (STRIP_PREFIXES[service]) {
    for (const prefix of STRIP_PREFIXES[service]) {
      if (req.url.startsWith(prefix)) {
        req.url = req.url.replace(prefix, '') || '/';
        // Ensure url starts with /
        if (!req.url.startsWith('/')) req.url = '/' + req.url;
        break;
      }
    }
  }

  console.log(`→ Proxying ${req.method} ${req.path} to ${service} (${target}) as ${req.url}`);

  const start = Date.now();
  breaker.fire(req, res).catch((error) => {
    const duration = Date.now() - start;
    console.error(`Proxy error for ${service}:`, error.message);
    if (!res.headersSent) {
      res.status(503).json({
        error: 'Service unavailable',
        service,
      });
    }
    logUsage(req, res, duration);
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    logUsage(req, res, duration);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 API Gateway started on port ${PORT}`);
  console.log('Services:');
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const service = getService(req.url);
  if (service) {
    console.log(`→ Upgrading proxy for ${req.url} to ${service}`);
    proxies[service].ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

module.exports = app;
