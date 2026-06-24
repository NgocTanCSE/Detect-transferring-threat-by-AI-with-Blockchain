/**
 * Blockchain AI - Auth Service
 * Microservice for user authentication and JWT token management
 *
 * Features:
 * - User registration with spam detection
 * - User login with JWT tokens
 * - Token refresh
 * - User profile management
 * - Role-based access control
 */

const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const traceMiddleware = require('../../shared/trace');
require('dotenv').config();
const { client, requestMetrics } = require('../../shared/metrics');

const profileService = require('./profile');
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ==========================================
// CONSTANTS
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET_KEY environment variable is required');
    process.exit(1);
}
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

// In-memory rate limiter for login
const loginAttempts = new Map();
const LOGIN_RATE_LIMIT = 5; // attempts
const LOGIN_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(username) {
  const key = username.toLowerCase();
  const now = Date.now();
  const entry = loginAttempts.get(key) || [];
  const recent = entry.filter(t => now - t < LOGIN_RATE_WINDOW);
  if (recent.length >= LOGIN_RATE_LIMIT) {
    const retryAfter = Math.ceil((recent[0] + LOGIN_RATE_WINDOW - now) / 1000);
    const err = new Error('Too many login attempts. Account temporarily locked.');
    err.statusCode = 429;
    err.retryAfter = retryAfter;
    throw err;
  }
  recent.push(now);
  loginAttempts.set(key, recent);
}

// Password reset rate limiting
const resetAttempts = new Map();

function checkResetRateLimit(email) {
  const key = `reset:${email.toLowerCase()}`;
  const now = Date.now();
  const entry = resetAttempts.get(key) || [];
  const recent = entry.filter(t => now - t < 3600000);
  if (recent.length >= 3) {
    const err = new Error('Too many password reset attempts. Try again later.');
    err.statusCode = 429;
    throw err;
  }
  recent.push(now);
  resetAttempts.set(key, recent);
}

// Spam detection - disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'yopmail.com',
  'throwaway.email', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
  'trashmail.com', 'getnada.com', 'maildrop.cc', 'mohmal.com',
  'dispostable.com', 'mailnesia.com', 'sharklasers.com', 'guerrillamail.info',
  'tempail.com', 'emailondeck.com', 'mailcatch.com', 'mintemail.com',
]);

// ==========================================
// RESPONSE MODELS
// ==========================================

class UserResponse {
  constructor(id, username, email, walletAddress, createdAt) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.wallet_address = walletAddress;
    this.created_at = createdAt;
  }
}

class TokenResponse {
  constructor(accessToken, tokenType, expiresIn) {
    this.access_token = accessToken;
    this.token_type = tokenType || 'bearer';
    this.expires_in = expiresIn;
  }
}

// ==========================================
// SPAM DETECTION
// ==========================================

function checkUsername(username) {
  const patterns = [
    /spam|bot|fake|temp/i,           // Still block obvious keywords
  ];

  for (const pattern of patterns) {
    if (pattern.test(username)) {
      return { suspicious: true, reason: 'Username contains restricted keywords' };
    }
  }

  // Only block extremely long strings that look like random garbage
  if (username.length > 50) {
    return { suspicious: true, reason: 'Username is too long' };
  }

  return { suspicious: false };
}

function checkEmail(email) {
  const emailLower = email.toLowerCase();
  const domain = emailLower.split('@')[1] || '';

  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { suspicious: true, reason: `Disposable email domain not allowed: ${domain}` };
  }

  for (const disposable of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.includes(disposable)) {
      return { suspicious: true, reason: 'Email domain contains known disposable service' };
    }
  }

  const localPart = emailLower.split('@')[0] || '';
  if ((localPart.match(/\+/g) || []).length > 1) {
    return { suspicious: true, reason: 'Email contains excessive plus-addressing' };
  }

  if ((localPart.match(/\./g) || []).length > 4) {
    return { suspicious: true, reason: 'Email contains excessive dots' };
  }

  return { suspicious: false };
}

// ==========================================
// UTILITIES
// ==========================================

async function hashPassword(password) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

function generateToken(userId, username, email, role, orgId) {
  const payload = {
    sub: userId,
    username,
    email,
    role: role || 'user',
    org_id: orgId || null,
    iat: Math.floor(Date.now() / 1000),
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRY,
  });

  return token;
}

function normalizeWalletAddress(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error('Invalid Ethereum wallet address');
  }
  return normalized;
}

function normalizeOrganizationSlug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organization';
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    return { valid: true, payload: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function getUserById(db, userId) {
  const result = await db.query(
    'SELECT id, username, email, wallet_address, role, organization_id, created_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

async function getUserByIdentifier(db, identifier) {
  // Check both username and email
  const result = await db.query(
    `SELECT id, username, email, wallet_address, password_hash, role, organization_id, is_active, warning_count, created_at 
     FROM users 
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
    [identifier]
  );
  return result.rows[0];
}

async function getUserByEmail(db, email) {
  const result = await db.query(
    'SELECT id, username, email, wallet_address, created_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rows[0];
}

// ==========================================
// MIDDLEWARE
// ==========================================

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
}

const redis = require('redis');

// Redis client for Token Blacklist (lazy connect)
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const redisClient = redis.createClient({ url: REDIS_URL });
let redisConnected = false;
redisClient.on('error', (err) => console.error('[AUTH] Redis Error:', err));

async function ensureRedisConnection() {
  if (redisConnected || redisClient.isOpen) return;
  try {
    await redisClient.connect();
    redisConnected = true;
  } catch (error) {
    console.error('[AUTH] Redis connection failed:', error.message);
  }
}

async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  // 1. Check if token is blacklisted in Redis
  try {
    await ensureRedisConnection();
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked (logged out)' });
    }
  } catch (e) {
    console.error('[AUTH] Blacklist check error:', e.message);
  }

  const { valid, payload, error } = verifyToken(token);

  if (!valid) {
    return res.status(403).json({ error: 'Invalid or expired token', detail: error });
  }

  req.user = payload;
  next();
}

function createApp(dbPool = pool) {
  const authApp = express();
  authApp.use(helmet());
  authApp.use(cors());
  authApp.use(express.json());
  authApp.use(express.urlencoded({ extended: true }));

  // Tracing middleware
  authApp.use(traceMiddleware);
  authApp.use(requestMetrics);

  // Logging middleware (Request logging)
  authApp.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
        correlationId: req.correlationId,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    });
    next();
  });

  // ==========================================
  // ENDPOINTS
  // ==========================================
  // Health check
  authApp.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'auth-service'
    });
  });

  // Ready check - verify database connection
authApp.get('/ready', async (req, res) => {
  try {
    await dbPool.query('SELECT 1');
    res.json({ status: 'ready', service: 'auth-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

authApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

  // Register endpoint
// Profile Service Endpoints (full profile, details, preferences)
  authApp.post('/register', async (req, res) => {
    try {
      const { username, email, password, wallet_address } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
      }

      // Spam detection
      const usernameCheck = checkUsername(username);
      if (usernameCheck.suspicious) {
        return res.status(400).json({ error: usernameCheck.reason });
      }

      const emailCheck = checkEmail(email);
      if (emailCheck.suspicious) {
        return res.status(400).json({ error: emailCheck.reason });
      }

      let normalizedWalletAddress = null;
      try {
        normalizedWalletAddress = normalizeWalletAddress(req.body.wallet_address);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      // Check username uniqueness
      const existingUsername = await dbPool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );
      if (existingUsername.rowCount > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Check email uniqueness
      const existingEmail = await getUserByEmail(dbPool, email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Advanced Anti-Fraud: Block registration for known bad actors
      const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
      
      // 1. Check if wallet is blacklisted or suspended
      if (normalizedWalletAddress) {
        const walletCheck = await dbPool.query(
          `SELECT w.account_status, b.is_active as blacklisted 
           FROM wallets w 
           LEFT JOIN blacklist b ON LOWER(w.address) = LOWER(b.address)
           WHERE LOWER(w.address) = LOWER($1)`,
          [normalizedWalletAddress]
        );
        
        if (walletCheck.rows.length > 0) {
          const w = walletCheck.rows[0];
          if (w.blacklisted) {
            return res.status(403).json({ error: 'Security Alert: This wallet address is blacklisted due to malicious activity.' });
          }
          if (w.account_status === 'suspended' || w.account_status === 'frozen') {
            return res.status(403).json({ error: `Security Alert: This wallet is currently ${w.account_status}.` });
          }
        }
      }

      // 2. IP Fingerprinting: Check if this IP is associated with any suspended users
      if (clientIp !== 'unknown') {
        const ipCheck = await dbPool.query(
          `SELECT u.username, u.email 
           FROM usage_logs l
           JOIN users u ON l.user_id = u.id
           WHERE l.ip_address = $1 AND (u.is_active = false OR u.warning_count >= 3)
           LIMIT 1`,
          [clientIp]
        );
        
        if (ipCheck.rows.length > 0) {
          // Trigger a silent alert to the compliance team about evasion attempt
          try {
            await dbPool.query(
              `INSERT INTO alerts (wallet_address, alert_type, severity, message, risk_score)
               VALUES ($1, 'EVASION_ATTEMPT', 'HIGH', 'Suspended user attempting to register new account from same IP', 85.0)`,
              [normalizedWalletAddress || 'NO_WALLET']
            );
          } catch (e) {
            console.error('[AUTH] Failed to log evasion alert:', e.message);
          }
          
          return res.status(403).json({ 
            error: 'Account Registration Blocked', 
            detail: 'Our security systems have flagged this network. Please contact support.'
          });
        }
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Handle organization
      let orgId = req.body.organization_id || null;
      const organizationName = req.body.organization_name;

      if (!orgId && organizationName) {
        // Create new organization if name provided
        const orgSlug = normalizeOrganizationSlug(organizationName);
        const orgResult = await dbPool.query(
          `INSERT INTO organizations (name, slug, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [organizationName, orgSlug]
        );
        orgId = orgResult.rows[0].id;
      }

      // Create user
      const result = await dbPool.query(
        `INSERT INTO users (username, email, password_hash, wallet_address, role, organization_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, username, email, wallet_address, role, organization_id, created_at`,
         [username, email, passwordHash, normalizedWalletAddress, 'user', orgId]
      );

      const user = result.rows[0];

      // Also create a wallet entry for the user if wallet_address is provided
      if (normalizedWalletAddress) {
        const walletAddress = normalizedWalletAddress;
        await dbPool.query(
          `INSERT INTO wallets (address, account_status, risk_score, created_at)
           VALUES ($1, 'active', 0, NOW())
           ON CONFLICT (address) DO NOTHING`,
          [walletAddress]
        );

        console.log(`[AUTH] Wallet profile ensured for ${walletAddress}`);
      }

      const response = new UserResponse(
        user.id,
        user.username,
        user.email,
        user.wallet_address,
        user.created_at
      );

      res.status(201).json(response);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed', detail: error.message });
    }
  });

  // Login endpoint
  authApp.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Rate limit check
      try {
        checkLoginRateLimit(username);
      } catch (rateErr) {
        return res.status(rateErr.statusCode || 429).json({
          error: rateErr.message,
          retry_after: rateErr.retryAfter || 900,
        });
      }

      // Get user by username or email
      const user = await getUserByIdentifier(dbPool, username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password (with plaintext fallback for legacy data)
      const passwordValid = await verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token (include role and organization_id)
      const token = generateToken(user.id, user.username, user.email, user.role, user.organization_id);

      res.json({
        access_token: token,
        token_type: 'bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          wallet_address: user.wallet_address,
          warning_count: user.warning_count || 0,
          is_active: user.is_active !== false,
          created_at: user.created_at,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed', detail: error.message });
    }
  });

  // Get current user profile (supports both /profile and /me)
  const profileHandler = async (req, res) => {
    try {
      const result = await dbPool.query(
        'SELECT id, username, email, role, wallet_address, is_active, warning_count, created_at FROM users WHERE id = $1',
        [req.user.sub]
      );
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        wallet_address: user.wallet_address,
        warning_count: user.warning_count || 0,
        is_active: user.is_active !== false,
        created_at: user.created_at,
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Failed to get profile', detail: error.message });
    }
  };
  authApp.get('/profile', requireAuth, profileHandler);
  authApp.get('/me', requireAuth, profileHandler);

  // Extended profile endpoints (details & preferences)
  authApp.get('/profile/full', requireAuth, async (req, res) => {
    try {
      const data = await profileService.getFullProfile(req.user.sub);
      res.json(data);
    } catch (err) {
      const status = err.status || 500;
      logger.error(`GET /profile/full error: ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  });

  authApp.patch('/profile/details', requireAuth, async (req, res) => {
    try {
      const updated = await profileService.upsertUserDetails(req.user.sub, req.body);
      res.json(updated);
    } catch (err) {
      const status = err.status || 500;
      logger.error(`PATCH /profile/details error: ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  });

  authApp.get('/profile/preferences', requireAuth, async (req, res) => {
    try {
      const prefs = await profileService.getUserPreferences(req.user.sub);
      res.json(prefs);
    } catch (err) {
      const status = err.status || 500;
      logger.error(`GET /profile/preferences error: ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  });

  authApp.patch('/profile/preferences', requireAuth, async (req, res) => {
    try {
      const updated = await profileService.upsertUserPreferences(req.user.sub, req.body);
      res.json(updated);
    } catch (err) {
      const status = err.status || 500;
      logger.error(`PATCH /profile/preferences error: ${err.message}`);
      res.status(status).json({ error: err.message });
    }
  });
  authApp.post('/refresh', requireAuth, async (req, res) => {
    try {
      const result = await dbPool.query('SELECT id, username, email, role, organization_id FROM users WHERE id = $1', [req.user.sub]);
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const token = generateToken(user.id, user.username, user.email, user.role, user.organization_id);
      res.json(new TokenResponse(token, 'bearer'));
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed', detail: error.message });
    }
  });

  authApp.post('/change-password', requireAuth, async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      const userResult = await dbPool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.sub]);
      const user = userResult.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const valid = await verifyPassword(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      const newHash = await hashPassword(new_password);
      await dbPool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.sub]);
      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password', detail: error.message });
    }
  });

  // Forgot password – generate reset code and store in Redis
  authApp.post('/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await getUserByEmail(dbPool, email);
      if (!user) {
        return res.json({ message: 'If the email is registered, a password reset code has been sent.' });
      }

      try {
        checkResetRateLimit(email);
      } catch (rateErr) {
        return res.status(rateErr.statusCode || 429).json({ error: rateErr.message });
      }

      await ensureRedisConnection();
      const resetCode = require('crypto').randomBytes(4).toString('hex').toUpperCase();
      const resetKey = `reset:${email.toLowerCase()}`;
      await redisClient.setex(resetKey, 15 * 60, resetCode);

      res.json({ message: 'If the email is registered, a password reset code has been sent.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process request', detail: error.message });
    }
  });

  // Reset password – verify code and update
  authApp.post('/reset-password', async (req, res) => {
    try {
      const { email, code, new_password } = req.body;
      if (!email || !code || !new_password) {
        return res.status(400).json({ error: 'Email, code, and new_password are required' });
      }

      const resetKey = `reset:${email.toLowerCase()}`;
      await ensureRedisConnection();
      const storedCode = await redisClient.get(resetKey);
      if (!storedCode || storedCode !== code) {
        return res.status(401).json({ error: 'Invalid or expired reset code' });
      }

      if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const passwordHash = await hashPassword(new_password);
      await dbPool.query('UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)', [passwordHash, email]);

      await ensureRedisConnection();
      await redisClient.del(resetKey);
      res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password', detail: error.message });
    }
  });

  // Validate token
  authApp.post('/validate', (req, res) => {
    try {
      const token = extractToken(req);
      if (!token) {
        return res.status(401).json({ valid: false, error: 'No token provided' });
      }

      const { valid, payload, error } = verifyToken(token);

      if (!valid) {
        return res.json({ valid: false, error });
      }

      res.json({ valid: true, user: payload });
    } catch (error) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Logout (token blacklisting)
  authApp.post('/logout', requireAuth, async (req, res) => {
    const token = extractToken(req);
    if (token) {
      await ensureRedisConnection();
      try {
        // Blacklist for 7 days (matching max expiry)
        await redisClient.setex(`blacklist:${token}`, 7 * 24 * 60 * 60, '1');
        console.log(`[AUTH] Token blacklisted: ${token.substring(0, 10)}...`);
      } catch (e) {
        console.error('[AUTH] Failed to blacklist token:', e.message);
      }
    }
    res.json({ message: 'Logged out successfully' });
  });

  // Error handling
  authApp.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
    });
  });

  return authApp;
}

const runtimeApp = createApp(pool);

// Start server
if (require.main === module) {
  redisClient.connect().then(() => console.log('✓ Auth Service connected to Redis (Blacklist)')).catch(e => console.warn('[AUTH] Redis connection failed, blacklist disabled'));
  runtimeApp.listen(PORT, () => {
    console.log(`Auth Service running on port ${PORT}`);
    console.log(`  JWT Algorithm: ${JWT_ALGORITHM}`);
    console.log(`  JWT Expiry: ${JWT_EXPIRY}`);
  });
}

module.exports = {
  app: runtimeApp,
  createApp,
  verifyToken,
  generateToken,
};
