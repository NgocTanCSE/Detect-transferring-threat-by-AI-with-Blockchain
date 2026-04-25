/**
 * Auth Service Database Schema Migration
 * Creates users table in postgres_main database
 *
 * Run with:
 * psql postgresql://blockchain:blockchain123@localhost:5432/blockchain_main < services/auth-service/migrations/001_create_users_table.sql
 */

-- Create users table if not exists
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users (wallet_address);

-- Create sessions table for token management (optional)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth_sessions (expires_at);

-- Add comment
COMMENT ON
TABLE users IS 'User accounts with authentication credentials';

COMMENT ON
TABLE auth_sessions IS 'JWT token sessions for authentication tracking';
