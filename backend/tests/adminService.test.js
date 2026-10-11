const { createLocalStore } = require('../src/db/localStore');
const { createAdmin } = require('../scripts/adminService');

describe('create-admin script', () => {
  test('creates an administrator with a hashed password', async () => {
    const store = createLocalStore();
    const admin = await createAdmin(store, {
      name: 'Campus Admin',
      email: 'Admin@Campus.edu',
      password: 'VeryStrongPass123',
    });

    expect(admin.role).toBe('ADMIN');
    const saved = await store.users.findByEmail('admin@campus.edu');
    expect(saved.role).toBe('ADMIN');
    expect(saved.passwordHash).not.toBe('VeryStrongPass123');
  });

  test('rejects short administrator passwords', async () => {
    const store = createLocalStore();
    await expect(
      createAdmin(store, { name: 'Admin', email: 'a@campus.edu', password: 'Short123' }),
    ).rejects.toThrow(/12 characters/);
  });

  test('refuses to overwrite an existing account', async () => {
    const store = createLocalStore();
    const details = { name: 'Admin', email: 'a@campus.edu', password: 'VeryStrongPass123' };
    await createAdmin(store, details);
    await expect(createAdmin(store, details)).rejects.toMatchObject({ statusCode: 409 });
  });
});
