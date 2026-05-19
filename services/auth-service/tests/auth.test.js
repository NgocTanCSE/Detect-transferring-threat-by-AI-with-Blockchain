const request = require('supertest');
const bcrypt = require('bcryptjs');
const { createApp } = require('../src/index');

function createMockDb() {
  const users = [];
  let idSeq = 1;

  return {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized === 'select 1') {
        return { rows: [{ '?column?': 1 }] };
      }

      if (normalized.includes('from users where lower(username) = lower($1)')) {
        const username = String(params[0] || '').toLowerCase();
        const user = users.find((u) => u.username.toLowerCase() === username);
        return { rows: user ? [user] : [] };
      }

      if (normalized.includes('from users where lower(email) = lower($1)')) {
        const email = String(params[0] || '').toLowerCase();
        const user = users.find((u) => u.email.toLowerCase() === email);
        return { rows: user ? [user] : [] };
      }

      if (normalized.includes('from users where id = $1')) {
        const id = Number(params[0]);
        const user = users.find((u) => u.id === id);
        if (!user) return { rows: [] };
        const { password_hash, ...safeUser } = user;
        return { rows: [safeUser] };
      }

      if (normalized.startsWith('insert into users')) {
        const [username, email, password_hash, wallet_address] = params;
        const row = {
          id: idSeq++,
          username,
          email,
          password_hash,
          wallet_address,
          created_at: new Date().toISOString(),
        };
        users.push(row);
        const { password_hash: _, ...safeUser } = row;
        return { rows: [safeUser] };
      }

      throw new Error(`Unhandled query in test mock: ${sql}`);
    },
  };
}

describe('Auth Service', () => {
  let app;

  beforeEach(() => {
    app = createApp(createMockDb());
  });

  it('GET /health returns service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'auth-service' });
  });

  it('POST /register creates user', async () => {
    const res = await request(app).post('/register').send({
      username: 'alice_dev',
      email: 'alice@example.com',
      password: 'SafePass123!',
    });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('alice_dev');
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('POST /register rejects disposable email', async () => {
    const res = await request(app).post('/register').send({
      username: 'alice_dev',
      email: 'alice@tempmail.com',
      password: 'SafePass123!',
    });

    expect(res.status).toBe(400);
  });

  it('POST /login returns bearer token with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('SafePass123!', 10);
    const db = createMockDb();
    await db.query(
      'INSERT INTO users (username, email, password_hash, wallet_address, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, wallet_address, created_at',
      ['alice_dev', 'alice@example.com', passwordHash, null]
    );

    const localApp = createApp(db);
    const res = await request(localApp).post('/login').send({
      username: 'alice_dev',
      password: 'SafePass123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.token_type).toBe('bearer');
    expect(typeof res.body.access_token).toBe('string');
  });

  it('POST /validate fails without token', async () => {
    const res = await request(app).post('/validate');
    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });
});
