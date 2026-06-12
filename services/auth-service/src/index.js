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
const logger = require('./utils/logger');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const authApp = express();
authApp.use(helmet());
authApp.use(cors());
authApp.use(express.json());

// Correlation ID Middleware
authApp.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
});

// Logging middleware (Morgan)
authApp.use(morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// ==========================================
// CONSTANTS
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

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

// Redis client for Token Blacklist
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.on('error', (err) => console.error('[AUTH] Redis Error:', err));
redisClient.connect().then(() => console.log('✓ Auth Service connected to Redis (Blacklist)')).catch(e => console.warn('[AUTH] Redis connection failed, blacklist disabled'));

async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  // 1. Check if token is blacklisted in Redis
  try {
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
  authApp.use(express.json());
  authApp.use(express.urlencoded({ extended: true }));

  // Tracing middleware
  authApp.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || `internal-${uuidv4()}`;
    res.setHeader('x-correlation-id', req.correlationId);
    next();
  });

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
    res.json({ status: 'ok', service: 'auth-service' });
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

  // Register endpoint
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

      // Check username uniqueness
      const existingUsername = await getUserByIdentifier(dbPool, username);
      if (existingUsername) {
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
      if (wallet_address) {
        const walletCheck = await dbPool.query(
          `SELECT w.account_status, b.is_active as blacklisted 
           FROM wallets w 
           LEFT JOIN blacklist b ON LOWER(w.address) = LOWER(b.address)
           WHERE LOWER(w.address) = LOWER($1)`,
          [wallet_address]
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
              [wallet_address || 'NO_WALLET']
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
        const orgSlug = organizationName.toLowerCase().replace(/\s+/g, '-');
        const orgResult = await dbPool.query(
          `INSERT INTO organizations (name, slug, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
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
        [username, email, passwordHash, wallet_address || null, 'user', orgId]
      );

      const user = result.rows[0];

      // Also create a wallet entry for the user if wallet_address is provided
      if (user.wallet_address) {
        const walletAddress = user.wallet_address.toLowerCase();
        await dbPool.query(
          `INSERT INTO wallets (address, account_status, risk_score, created_at)
           VALUES ($1, 'active', 0, NOW())
           ON CONFLICT (address) DO NOTHING`,
          [walletAddress]
        );

        // Add welcome balance for new users (10 ETH)
        try {
          const txHash = '0x' + uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
          const welcomeAmount = (10n * BigInt(10) ** 18n).toString(); // 10 ETH in wei
          
          await dbPool.query(
            `INSERT INTO transactions (id, tx_hash, from_address, to_address, value, block_number, timestamp, status, chain_id)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
            [uuidv4(), txHash, '0x0000000000000000000000000000000000000000', walletAddress, welcomeAmount, 1000000, 1, 'ethereum']
          );

          // Also update wallet profile
          await dbPool.query(
            `UPDATE wallets 
             SET total_transactions = COALESCE(total_transactions, 0) + 1,
                 total_value_received = COALESCE(total_value_received, 0) + $1,
                 last_activity_at = NOW()
             WHERE address = $2`,
            [welcomeAmount, walletAddress]
          );
          
          console.log(`[AUTH] Welcome bonus of 10 ETH added to ${walletAddress}`);
        } catch (bonusError) {
          console.error('[AUTH] Failed to add welcome bonus:', bonusError.message);
          // Don't fail registration if bonus fails
        }
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

  // Refresh token
  authApp.post('/refresh', requireAuth, async (req, res) => {
    try {
      const result = await dbPool.query('SELECT id, username, email, role FROM users WHERE id = $1', [req.user.sub]);
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const token = generateToken(user.id, user.username, user.email, user.role);
      res.json(new TokenResponse(token, 'bearer'));
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed', detail: error.message });
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
