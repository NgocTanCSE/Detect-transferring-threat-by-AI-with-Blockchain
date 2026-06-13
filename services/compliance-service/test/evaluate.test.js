const request = require('supertest');
const { app } = require('../src/index');

describe('Policy Evaluation Endpoint', () => {
  test('should return 400 when wallet_address is missing', async () => {
    const response = await request(app)
      .post('/evaluate-policy')
      .send({});
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
