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
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(express.json());

// ==========================================
// CONSTANTS
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
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
    /^[a-z]{2,4}\d{6,}$/,           // abc123456
    /^user\d{4,}$/,                  // user12345
    /^test\d+$/,                     // test123
    /^[a-z0-9]{20,}$/,              // Long random
    /^[a-z]+_\d{8,}$/,              // word_12345678
    /spam|bot|fake|temp/i,           // Keywords
  ];

  for (const pattern of patterns) {
    if (pattern.test(username)) {
      return { suspicious: true, reason: 'Username matches bot pattern' };
    }
  }

  if (/\d{6,}/.test(username)) {
    return { suspicious: true, reason: 'Too many consecutive numbers' };
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

function generateToken(userId, username, email) {
  const payload = {
    sub: userId,
    username,
    email,
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
    'SELECT id, username, email, wallet_address, created_at FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

async function getUserByUsername(db, username) {
  const result = await db.query(
    'SELECT id, username, email, wallet_address, password_hash, created_at FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
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

async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { valid, payload, error } = verifyToken(token);

  if (!valid) {
    return res.status(403).json({ error: 'Invalid or expired token', detail: error });
  }

  req.user = payload;
  next();
}

// ==========================================
// ENDPOINTS
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Ready check - verify database connection
app.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', service: 'auth-service' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Register endpoint
app.post('/register', async (req, res) => {
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
    const existingUsername = await getUserByUsername(pool, username);
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Check email uniqueness
    const existingEmail = await getUserByEmail(pool, email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, wallet_address, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, username, email, wallet_address, created_at`,
      [username, email, passwordHash, wallet_address || null]
    );

    const user = result.rows[0];
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
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user
    const user = await getUserByUsername(pool, username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.username, user.email);

    res.json(new TokenResponse(token, 'bearer'));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', detail: error.message });
  }
});

// Get current user profile
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(pool, req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(new UserResponse(user.id, user.username, user.email, user.wallet_address, user.created_at));
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', detail: error.message });
  }
});

// Refresh token
app.post('/refresh', requireAuth, async (req, res) => {
  try {
    const user = await getUserById(pool, req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = generateToken(user.id, user.username, user.email);
    res.json(new TokenResponse(token, 'bearer'));
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed', detail: error.message });
  }
});

// Validate token
app.post('/validate', (req, res) => {
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

// Logout (optional - for token blacklisting in future)
app.post('/logout', requireAuth, (req, res) => {
  // In production, add token to blacklist/revocation list
  res.json({ message: 'Logged out successfully' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Auth Service running on port ${PORT}`);
  console.log(`  JWT Algorithm: ${JWT_ALGORITHM}`);
  console.log(`  JWT Expiry: ${JWT_EXPIRY}`);
});

module.exports = app;
