// Optional start-up step that makes sure an administrator account exists.
//
// On hosts without shell access (for example Render's free plan) the
// create-admin script cannot be run, and the free plan's disk is wiped on
// every restart. If ADMIN_EMAIL and ADMIN_PASSWORD are provided as secret
// environment variables, the administrator is (re)created at start-up using
// exactly the same rules as scripts/create-admin.js. Nothing happens when the
// variables are not set, so there is still no default admin password.

const { createAdmin } = require('../scripts/adminService');

async function ensureBootstrapAdmin(store, env, logger) {
  const email = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = env.ADMIN_PASSWORD || '';
  if (!email || !password) return 'skipped';

  const existing = await store.users.findByEmail(email);
  if (existing) {
    if (existing.role !== 'ADMIN') {
      logger.warn('bootstrap admin email belongs to a non-admin account; not changed');
    }
    return 'exists';
  }

  try {
    const admin = await createAdmin(store, {
      name: env.ADMIN_NAME || 'Administrator',
      email,
      password,
    });
    logger.info('bootstrap administrator created', { userId: admin.userId });
    return 'created';
  } catch (error) {
    // Never crash the app because of a bad admin setting; log why instead.
    logger.error('could not create bootstrap administrator', {
      reason: error.details ? JSON.stringify(error.details) : error.message,
    });
    return 'failed';
  }
}

module.exports = { ensureBootstrapAdmin };
