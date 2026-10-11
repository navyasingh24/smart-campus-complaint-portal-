// Shared test setup. Every test file builds its own app with a fresh
// in-memory database, so tests never touch real data or AWS.

const request = require('supertest');
const { loadConfig } = require('../src/config');
const { createLogger } = require('../src/logger');
const { createLocalStore } = require('../src/db/localStore');
const { createApp } = require('../src/app');
const { createAdmin } = require('../scripts/adminService');

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';

function buildTestApp(envOverrides = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: TEST_SECRET,
    DB_DRIVER: 'local',
    LOCAL_DB_FILE: '',
    STATIC_DIR: '/nonexistent',
    ...envOverrides,
  });
  const store = createLocalStore();
  const logger = createLogger('silent');
  const app = createApp({ config, store, logger });
  return { app, store, config };
}

async function registerStudent(app, overrides = {}) {
  const agent = request.agent(app);
  const body = {
    name: 'Test Student',
    email: `student${Math.random().toString(36).slice(2, 8)}@campus.edu`,
    password: 'Password123',
    ...overrides,
  };
  const res = await agent.post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, password: body.password };
}

async function loginAdmin(app, store) {
  const credentials = {
    name: 'Campus Admin',
    email: 'admin@campus.edu',
    password: 'AdminPassword123',
  };
  await createAdmin(store, credentials);
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/login')
    .send({ email: credentials.email, password: credentials.password });
  if (res.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user };
}

const validComplaint = {
  title: 'Wi-Fi not working in library',
  description: 'The campus Wi-Fi keeps disconnecting on the second floor of the library.',
  category: 'WIFI',
  location: 'Library, 2nd floor',
};

module.exports = { buildTestApp, registerStudent, loginAdmin, validComplaint, TEST_SECRET };
