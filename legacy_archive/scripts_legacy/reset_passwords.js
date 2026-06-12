/**
 * Reset all user passwords to known values for development.
 * Run inside the auth-service container which has bcryptjs available.
 * 
 * Usage: node /app/scripts/reset_passwords.js
 */
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://blockchain:blockchain123@postgres_main:5432/blockchain_main';

const pool = new Pool({ connectionString: DATABASE_URL });

// All users will get password: Admin@123
const DEFAULT_PASSWORD = 'Admin@123';

async function resetPasswords() {
  console.log('Generating bcrypt hash for password:', DEFAULT_PASSWORD);
  const hash = await bcryptjs.hash(DEFAULT_PASSWORD, 10);
  console.log('Generated hash:', hash);

  const client = await pool.connect();
  try {
    // Update all users
    const result = await client.query(
      'UPDATE users SET password_hash = $1 RETURNING id, username, email, role',
      [hash]
    );

    console.log(`\nUpdated ${result.rowCount} users:`);
    result.rows.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) - ${u.email}`);
    });

    console.log(`\n✅ All passwords reset to: ${DEFAULT_PASSWORD}`);
    console.log('\nLogin credentials:');
    result.rows.forEach(u => {
      console.log(`  Username: ${u.username}`);
      console.log(`  Password: ${DEFAULT_PASSWORD}`);
      console.log(`  Role: ${u.role}`);
      console.log('');
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPasswords();
