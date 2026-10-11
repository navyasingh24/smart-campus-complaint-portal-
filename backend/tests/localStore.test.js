const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocalStore } = require('../src/db/localStore');

describe('Local development database adapter', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('data persists across restarts when a file is configured', async () => {
    const filePath = path.join(dir, 'db.json');
    const first = createLocalStore({ filePath });
    await first.users.create({ userId: 'u1', email: 'a@b.cd', name: 'A', role: 'STUDENT' });
    await first.complaints.create({
      complaintId: 'c1',
      userId: 'u1',
      status: 'PENDING',
      category: 'WIFI',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    // Simulate a server restart by creating a new store from the same file.
    const second = createLocalStore({ filePath });
    expect(await second.users.findByEmail('a@b.cd')).toMatchObject({ userId: 'u1' });
    expect(await second.complaints.getById('c1')).toMatchObject({ status: 'PENDING' });
  });

  test('returned objects are copies, so callers cannot change stored data by accident', async () => {
    const store = createLocalStore();
    await store.complaints.create({ complaintId: 'c1', userId: 'u1', status: 'PENDING' });
    const copy = await store.complaints.getById('c1');
    copy.status = 'RESOLVED';
    expect((await store.complaints.getById('c1')).status).toBe('PENDING');
  });

  test('duplicate emails are rejected', async () => {
    const store = createLocalStore();
    await store.users.create({ userId: 'u1', email: 'a@b.cd' });
    await expect(store.users.create({ userId: 'u2', email: 'a@b.cd' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('updating a missing complaint returns null', async () => {
    const store = createLocalStore();
    expect(await store.complaints.updateStatus('missing', { status: 'RESOLVED' })).toBeNull();
  });
});
