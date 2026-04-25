const request = require('supertest');
const { createApp } = require('../src/index');

function createIntegrationDb() {
  const users = [];
  let idSeq = 1;

  return {
    async query(sql, params = []) {
      const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      if (q === 'select 1') return { rows: [{ ok: 1 }] };

      if (q.includes('from users where lower(username) = lower($1)')) {
        const user = users.find((u) => u.username.toLowerCase() === String(params[0]).toLowerCase());
        return { rows: user ? [user] : [] };
      }

      if (q.includes('from users where lower(email) = lower($1)')) {
        const user = users.find((u) => u.email.toLowerCase() === String(params[0]).toLowerCase());
        return { rows: user ? [user] : [] };
      }

      if (q.includes('from users where id = $1')) {
        const user = users.find((u) => u.id === Number(params[0]));
        if (!user) return { rows: [] };
        const { password_hash, ...safeUser } = user;
        return { rows: [safeUser] };
      }

      if (q.startsWith('insert into users')) {
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

      throw new Error(`Unhandled query: ${sql}`);
    },
  };
}

describe('Auth flow integration', () => {
  it('register -> login -> profile -> refresh succeeds', async () => {
    const app = createApp(createIntegrationDb());

    const registerRes = await request(app).post('/register').send({
      username: 'flow_user',
      email: 'flow@example.com',
      password: 'FlowPass123!',
      wallet_address: '0xabc',
    });
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app).post('/login').send({
      username: 'flow_user',
      password: 'FlowPass123!',
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.access_token;

    const profileRes = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.username).toBe('flow_user');

    const refreshRes = await request(app)
      .post('/refresh')
      .set('Authorization', `Bearer ${token}`);
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.access_token).toBe('string');
  });
});
