const bcrypt = require('bcryptjs');
const hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.9HvD6s1qWq1q1q';
const passwords = ['demo123', 'admin123', 'password', 'SecurePassword123', 'admin', 'SafePass123!', 'FlowPass123!'];

for (const pwd of passwords) {
  try {
    const match = bcrypt.compareSync(pwd, hash);
    console.log(`Password "${pwd}": ${match ? 'MATCH' : 'NO MATCH'}`);
  } catch (e) {
    console.log(`Error comparing "${pwd}":`, e.message);
  }
}
