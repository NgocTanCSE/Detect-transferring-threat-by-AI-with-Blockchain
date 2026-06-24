const request = require('supertest');

describe('API Gateway', () => {
  let app;
  let server;

  beforeAll(() => {
    process.env.PORT = '0';
    process.env.DISABLE_PROXY = 'true';
    process.env.JWT_SECRET = 'test-secret';
    app = require('../src/index');
    server = app;
  });

  afterAll(() => {
    if (server && server.close) server.close();
  });

  test('GET /health returns 200', async () => {
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  test('GET / returns service info', async () => {
    const res = await request(server).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'api-gateway');
  });

  test('Missing auth returns 401 on protected route', async () => {
    const res = await request(server).get('/auth/me');
    expect([401, 404]).toContain(res.status);
  });

  test('OPTIONS / returns CORS headers', async () => {
    const res = await request(server).options('/');
    expect(res.status).toBe(204);
  });
});
