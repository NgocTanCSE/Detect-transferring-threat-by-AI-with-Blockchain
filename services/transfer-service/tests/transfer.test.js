const request = require('supertest');

describe('Transfer Service', () => {
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

  test('POST /transfer without data returns 400', async () => {
    const res = await request(app).post('/transfer/protected').send({});
    expect(res.status).toBe(400);
  });
});
