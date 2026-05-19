# Phase 2: Auth Service Integration Guide

## Overview

This guide explains how to integrate the Auth Service (port 3001) with the API Gateway (port 8001).

## Service Architecture

```
┌─────────────────┐
│    Frontend     │
│   (port 3000)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      API Gateway (port 8001)        │
│ - Route: /auth → Auth Service       │
│ - Rate limiting                     │
│ - Token validation middleware       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│     Auth Service (port 3001)        │
│ - User registration                 │
│ - User login                        │
│ - JWT token generation              │
│ - Token validation                  │
│ - Spam detection                    │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   PostgreSQL Main (port 5432)       │
│ - users table                       │
│ - auth_sessions table               │
└─────────────────────────────────────┘
```

## API Endpoints

### Public Endpoints (No Auth Required)

#### 1. Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123",
  "wallet_address": "0x1234..." (optional)
}

Response: 201 Created
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "wallet_address": null,
  "created_at": "2026-04-25T10:00:00Z"
}
```

**Error Responses:**
- `400` - Missing required fields, invalid email/username, spam detected
- `409` - Username or email already exists

**Spam Detection Rules:**
- Username cannot match bot patterns (abc123456, user12345, etc.)
- Email cannot use disposable domains (tempmail.com, etc.)
- Email cannot have excessive plus-addressing or dots

---

#### 2. Login User
```http
POST /auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "SecurePassword123"
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": "7d"
}
```

**Error Responses:**
- `400` - Missing username or password
- `401` - Invalid credentials (user not found or wrong password)

---

#### 3. Validate Token
```http
POST /auth/validate
Authorization: Bearer {access_token}

Response: 200 OK
{
  "valid": true,
  "user": {
    "sub": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "iat": 1682410800
  }
}

Or if invalid:
{
  "valid": false,
  "error": "jwt expired"
}
```

---

### Protected Endpoints (Auth Required)

#### 4. Get User Profile
```http
GET /auth/profile
Authorization: Bearer {access_token}

Response: 200 OK
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "wallet_address": null,
  "created_at": "2026-04-25T10:00:00Z"
}
```

**Error Responses:**
- `401` - Missing or invalid token
- `404` - User not found

---

#### 5. Refresh Token
```http
POST /auth/refresh
Authorization: Bearer {access_token}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": "7d"
}
```

---

#### 6. Logout
```http
POST /auth/logout
Authorization: Bearer {access_token}

Response: 200 OK
{
  "message": "Logged out successfully"
}
```

---

## API Gateway Integration

### Route Mapping

Update `services/api-gateway/src/index.js`:

```javascript
// Route mapping
const ROUTE_MAP = {
  '/auth/register': 'auth',    // Public
  '/auth/login': 'auth',       // Public
  '/auth/validate': 'auth',    // Public
  '/auth/profile': 'auth',     // Protected
  '/auth/refresh': 'auth',     // Protected
  '/auth/logout': 'auth',      // Protected

  // ... other services
};
```

### Authentication Middleware

The API Gateway includes token validation:

```javascript
// Auth middleware in API Gateway
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  // Public routes
  const publicRoutes = ['/auth/register', '/auth/login', '/auth/validate'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const decoded = jwt.decode(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

app.use(verifyToken);
```

---

## Environment Configuration

Update `.env`:

```bash
# Auth Service
AUTH_SERVICE_URL=http://auth-service:3001

# Database
DATABASE_URL=postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main

# JWT Configuration
JWT_SECRET=your_secret_key_min_32_chars_long
JWT_EXPIRY=7d
JWT_ALGORITHM=HS256
```

---

## Database Setup

Run migrations to create users table:

```bash
psql postgresql://blockchain:blockchain123@localhost:5432/blockchain_main < \
  services/auth-service/migrations/001_create_users_table.sql
```

This creates:
- `users` table with id, username, email, password_hash, wallet_address, created_at
- `auth_sessions` table for token tracking (optional)
- Indexes on username, email, wallet_address for fast lookups

---

## JWT Token Structure

Tokens are signed with HS256 algorithm:

```
Header:
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload:
{
  "sub": 1,           // User ID
  "username": "john_doe",
  "email": "john@example.com",
  "iat": 1682410800,
  "exp": 1682929200   // Expires in 7 days
}

Signature: HMAC-SHA256(header.payload, JWT_SECRET)
```

Decode at: https://jwt.io

---

## Testing Integration

### 1. Register User
```bash
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePassword123"
  }'
```

### 2. Login
```bash
TOKEN=$(curl -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "SecurePassword123"}' \
  | jq -r '.access_token')

echo "Token: $TOKEN"
```

### 3. Get Profile
```bash
curl -X GET http://localhost:8001/auth/profile \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Validate Token
```bash
curl -X POST http://localhost:8001/auth/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": "Error message",
  "detail": "Additional details (optional)"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden
- `404` - Not found
- `409` - Conflict (duplicate user)
- `500` - Server error

---

## Security Considerations

### Password Storage
- Passwords are hashed with bcryptjs (salt rounds: 10)
- Never stored or transmitted in plain text

### Token Security
- JWT tokens expire after 7 days
- Tokens should be sent over HTTPS only
- API Gateway validates tokens before proxying to other services

### Spam Prevention
- Username and email validation rules
- Disposable email domain blacklist
- Registration rate limiting (recommended in Phase 2.5)

### CORS
- API Gateway has CORS enabled for frontend access
- Restrict origins in production: `CORS_ORIGIN=https://yourdomain.com`

---

## Deployment Checklist

### Before Production:

- [ ] Change JWT_SECRET to strong random value (32+ characters)
- [ ] Enable HTTPS/TLS on API Gateway
- [ ] Update CORS_ORIGIN to production domain
- [ ] Review and update disposable email domain list
- [ ] Set up database backups
- [ ] Enable database encryption at rest
- [ ] Configure logging and monitoring
- [ ] Test token expiration and refresh flow
- [ ] Load test registration/login endpoints

### Monitoring:

- [ ] Monitor failed login attempts
- [ ] Alert on duplicate registration attempts
- [ ] Track token validation failures
- [ ] Monitor database connection pool

---

## Next Steps

Phase 2 Complete:
1. ✅ Auth Service implementation
2. ✅ API Gateway integration
3. ✅ Database migrations
4. ✅ Unit tests
5. ✅ Integration documentation

Phase 2.5 (Recommended):
- Add registration rate limiting per IP
- Implement token blacklist/revocation
- Add email verification
- Add password reset flow
- Implement 2FA

Phase 3:
- Alert Service extraction
- Real-time events via WebSocket
- Message queue integration
