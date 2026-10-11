const { createLocalStore } = require('../src/db/localStore');
const { createLogger } = require('../src/logger');
const { ensureBootstrapAdmin } = require('../src/bootstrapAdmin');
const { loadConfig } = require('../src/config');

const logger = createLogger('silent');
const env = {
  ADMIN_NAME: 'Campus Admin',
  ADMIN_EMAIL: 'Admin@Campus.edu',
  ADMIN_PASSWORD: 'VeryStrongPass123',
};

describe('Bootstrap administrator from environment variables', () => {
  test('does nothing when the variables are not set', async () => {
    const store = createLocalStore();
    expect(await ensureBootstrapAdmin(store, {}, logger)).toBe('skipped');
  });

  test('creates the administrator once and leaves it alone afterwards', async () => {
    const store = createLocalStore();
    expect(await ensureBootstrapAdmin(store, env, logger)).toBe('created');
    const saved = await store.users.findByEmail('admin@campus.edu');
    expect(saved.role).toBe('ADMIN');
    expect(saved.passwordHash).not.toBe(env.ADMIN_PASSWORD);

    expect(await ensureBootstrapAdmin(store, env, logger)).toBe('exists');
  });

  test('a weak password is reported instead of crashing the app', async () => {
    const store = createLocalStore();
    const result = await ensureBootstrapAdmin(store, { ...env, ADMIN_PASSWORD: 'short1' }, logger);
    expect(result).toBe('failed');
    expect(await store.users.findByEmail('admin@campus.edu')).toBeNull();
  });

  test('an existing student account with the same email is not promoted', async () => {
    const store = createLocalStore();
    await store.users.create({ userId: 'u1', email: 'admin@campus.edu', role: 'STUDENT' });
    expect(await ensureBootstrapAdmin(store, env, logger)).toBe('exists');
    expect((await store.users.findByEmail('admin@campus.edu')).role).toBe('STUDENT');
  });
});

describe('Version reporting on Render', () => {
  test('falls back to RENDER_GIT_COMMIT when APP_VERSION is empty', () => {
    const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: '', RENDER_GIT_COMMIT: 'abc123' });
    expect(config.appVersion).toBe('abc123');
  });

  test('APP_VERSION from the CI build takes priority', () => {
    const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: 'ci-sha', RENDER_GIT_COMMIT: 'abc123' });
    expect(config.appVersion).toBe('ci-sha');
  });
});
