const request = require('supertest');

describe('Event Service', () => {
  let app;

  beforeAll(() => {
    process.env.PORT = '0';
    app = require('../src/index');
  });

  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
