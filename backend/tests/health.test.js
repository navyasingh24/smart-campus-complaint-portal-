const request = require('supertest');
const { buildTestApp } = require('./helpers');

describe('Health checks', () => {
  test('GET /api/health returns ok with version information', async () => {
    const { app } = buildTestApp({ APP_VERSION: 'abc123' });
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('abc123');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  test('GET /api/health/ready reports database connectivity', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'local' });
  });

  test('GET /api/health/ready returns 503 when the database is unreachable', async () => {
    const { app, store } = buildTestApp();
    store.ping = async () => {
      throw new Error('connection refused');
    };
    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unavailable');
    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });

  test('unknown API routes return 404 JSON', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});

describe('Request logging', () => {
  test('API requests are logged as JSON without bodies, health probes are skipped', async () => {
    const { createLogger } = require('../src/logger');
    const { createApp } = require('../src/app');
    const { createLocalStore } = require('../src/db/localStore');
    const { loadConfig } = require('../src/config');

    const lines = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((line) => {
      lines.push(line);
      return true;
    });
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((line) => {
      lines.push(line);
      return true;
    });
    try {
      const app = createApp({
        config: loadConfig({ NODE_ENV: 'test', STATIC_DIR: '/nonexistent' }),
        store: createLocalStore(),
        logger: createLogger('info'),
      });
      await request(app).get('/api/health');
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'someone@campus.edu', password: 'SuperSecret123' });
    } finally {
      spy.mockRestore();
      stderrSpy.mockRestore();
    }

    const entries = lines.map((l) => JSON.parse(l));
    const requestLogs = entries.filter((e) => e.message === 'request completed');
    expect(requestLogs).toHaveLength(1);
    expect(requestLogs[0]).toMatchObject({ method: 'POST', path: '/api/auth/login', statusCode: 401 });
    expect(lines.join('')).not.toContain('SuperSecret123');
  });
});

describe('Serving the built frontend', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  test('GET and HEAD requests for pages return index.html', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-static-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>');
    try {
      const { app } = buildTestApp({ STATIC_DIR: dir });
      const get = await request(app).get('/admin');
      expect(get.status).toBe(200);
      expect(get.text).toContain('<div id="root">');
      expect((await request(app).head('/')).status).toBe(200);
      expect((await request(app).post('/').send({})).status).toBe(404);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
