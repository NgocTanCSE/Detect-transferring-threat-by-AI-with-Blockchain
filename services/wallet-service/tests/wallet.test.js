const request = require('supertest');

describe('Wallet Service', () => {
  let app;

  beforeAll(() => {
    process.env.PORT = '0';
    process.env.DISABLE_DB = 'true';
    app = require('../src/index');
  });

  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('GET / returns service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service');
  });

  test('GET /wallets returns array', async () => {
    const res = await request(app).get('/wallets');
    expect(res.status).toBe(200);
  });
});
