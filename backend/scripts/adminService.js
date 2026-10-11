const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../src/constants');
const { validateRegistration } = require('../src/validation');
const { BCRYPT_ROUNDS } = require('../src/routes/auth');

// Creates an administrator account. Kept separate from the command-line
// wrapper so it can be unit tested.
async function createAdmin(store, { name, email, password }) {
  const input = validateRegistration({ name, email, password });
  if (input.password.length < 12) {
    throw new Error('Administrator passwords must be at least 12 characters long');
  }
  const now = new Date().toISOString();
  const admin = {
    userId: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    role: ROLES.ADMIN,
    createdAt: now,
    updatedAt: now,
  };
  await store.users.create(admin);
  return { userId: admin.userId, email: admin.email, name: admin.name, role: admin.role };
}

module.exports = { createAdmin };
