const request = require('supertest');

describe('Alert Service', () => {
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

  test('GET / alerts list', async () => {
    const res = await request(app).get('/alerts');
    expect(res.status).toBe(200);
  });
});
