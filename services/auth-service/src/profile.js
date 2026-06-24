// Profile Service – Handles extended user details & preferences

const { Pool } = require('pg');
const Joi = require('joi');
require('dotenv').config();
const logger = require('./utils/logger');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');

// Separate pool (shares same DATABASE_URL env var)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- Validation schemas -------------------------------------------------
const detailsSchema = Joi.object({
  full_name: Joi.string().max(200).allow('', null),
  phone: Joi.string()
    .pattern(/^\+?\d{7,15}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Phone must be a valid international number'
    }),
  address: Joi.string().max(500).allow('', null)
});

const prefsSchema = Joi.object({
  dark_mode: Joi.boolean(),
  language: Joi.string()
    .max(10)
    .pattern(/^[a-z]{2}$/i)
    .messages({
      'string.pattern.base': 'Language must be a 2‑letter ISO code'
    })
    .allow('', null),
  notif_email: Joi.boolean(),
  notif_push: Joi.boolean(),
  notif_sms: Joi.boolean()
});

function assertUuid(id, ctx) {
  if (!uuidValidate(id)) {
    const err = new Error(`Invalid UUID for ${ctx}`);
    err.status = 400;
    throw err;
  }
}

// ---- Service functions --------------------------------------------------
/**
 * Retrieve the core user record together with details & preferences.
 */
async function getFullProfile(userId) {
  assertUuid(userId, 'userId');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: userRows } = await client.query(
      `SELECT id, username, email, wallet_address, role, organization_id, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (userRows.length === 0) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }
    const user = userRows[0];

    const { rows: detailRows } = await client.query(
      `SELECT full_name, phone, address, created_at, updated_at
       FROM user_details WHERE user_id = $1`,
      [userId]
    );
    const details = detailRows[0] || null;

    const { rows: prefRows } = await client.query(
      `SELECT dark_mode, language, notif_email, notif_push, notif_sms,
              created_at, updated_at
       FROM user_preferences WHERE user_id = $1`,
      [userId]
    );
    const preferences = prefRows[0] || null;

    await client.query('COMMIT');
    return { user, details, preferences };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`getFullProfile error for ${userId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Upsert (create or update) user details.
 */
async function upsertUserDetails(userId, payload) {
  assertUuid(userId, 'userId');
  const { error, value } = detailsSchema.validate(payload, { abortEarly: false });
  if (error) {
    const err = new Error(`Invalid user details: ${error.message}`);
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO user_details (user_id, full_name, phone, address, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           updated_at = now()
       RETURNING id, user_id, full_name, phone, address, created_at, updated_at`,
      [userId, value.full_name, value.phone, value.address]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`upsertUserDetails error for ${userId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch user preferences.
 */
async function getUserPreferences(userId) {
  assertUuid(userId, 'userId');
  const { rows } = await pool.query(
    `SELECT dark_mode, language, notif_email, notif_push, notif_sms,
            created_at, updated_at
     FROM user_preferences WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Upsert user preferences (partial updates allowed).
 */
async function upsertUserPreferences(userId, payload) {
  assertUuid(userId, 'userId');
  const { error, value } = prefsSchema.validate(payload, { abortEarly: false });
  if (error) {
    const err = new Error(`Invalid preferences: ${error.message}`);
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO user_preferences (user_id, dark_mode, language, notif_email, notif_push, notif_sms, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id) DO UPDATE
       SET dark_mode = COALESCE(EXCLUDED.dark_mode, user_preferences.dark_mode),
           language = COALESCE(EXCLUDED.language, user_preferences.language),
           notif_email = COALESCE(EXCLUDED.notif_email, user_preferences.notif_email),
           notif_push = COALESCE(EXCLUDED.notif_push, user_preferences.notif_push),
           notif_sms = COALESCE(EXCLUDED.notif_sms, user_preferences.notif_sms),
           updated_at = now()
       RETURNING id, user_id, dark_mode, language, notif_email, notif_push, notif_sms, created_at, updated_at`,
      [
        userId,
        value.dark_mode,
        value.language,
        value.notif_email,
        value.notif_push,
        value.notif_sms
      ]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`upsertUserPreferences error for ${userId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getFullProfile,
  upsertUserDetails,
  getUserPreferences,
  upsertUserPreferences
};
