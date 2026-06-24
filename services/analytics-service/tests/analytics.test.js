const request = require('supertest');

describe('Analytics Service', () => {
  let app;

  beforeAll(() => {
    app = require('./index');
  });

  describe('Health checks', () => {
    it('GET /health returns ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('analytics-service');
    });

    it('GET /ready returns ready status', async () => {
      const res = await request(app).get('/ready');
      expect([200, 503]).toContain(res.statusCode);
    });
  });

  describe('Statistics endpoints', () => {
    it('GET /statistics/dashboard returns statistics structure', async () => {
      const res = await request(app).get('/statistics/dashboard?chain=ethereum');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('overview');
    });

    it('GET /statistics/dashboard returns error for invalid chain', async () => {
      const res = await request(app).get('/statistics/dashboard?chain=invalid');
      expect(res.statusCode).toBe(400);
    });

    it('GET /statistics/flow returns flow data', async () => {
      const res = await request(app).get('/statistics/flow?chain=ethereum');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('flow_data');
    });
  });

  describe('Organization endpoints', () => {
    it('GET /organizations returns list', async () => {
      const res = await request(app).get('/organizations');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('items');
    });
  });
});