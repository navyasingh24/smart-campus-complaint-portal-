const request = require('supertest');
const { buildTestApp, registerStudent } = require('./helpers');

describe('Security configuration', () => {
  test('cross-origin requests from unknown origins are not allowed', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('explicitly configured origins are allowed', async () => {
    const { app } = buildTestApp({ CORS_ORIGINS: 'https://portal.campus.edu' });
    const res = await request(app).get('/api/health').set('Origin', 'https://portal.campus.edu');
    expect(res.headers['access-control-allow-origin']).toBe('https://portal.campus.edu');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('security headers are set and the framework is not advertised', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('unexpected errors return a generic message without internal details', async () => {
    const { app, store } = buildTestApp();
    const { agent } = await registerStudent(app);
    store.complaints.listByUser = async () => {
      throw new Error('Secret internal database failure at arn:aws:dynamodb:...');
    };
    const res = await agent.get('/api/complaints');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong. Please try again later.' });
  });

  test('malformed JSON returns 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });

  test('production configuration refuses to start without a strong JWT secret', () => {
    const { loadConfig } = require('../src/config');
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/32/);
    const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) });
    expect(config.cookieSecure).toBe(true);
    expect(config.db.driver).toBe('dynamodb');
  });
});
