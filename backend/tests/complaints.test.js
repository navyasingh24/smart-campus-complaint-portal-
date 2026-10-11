const request = require('supertest');
const { buildTestApp, registerStudent, loginAdmin, validComplaint } = require('./helpers');

describe('Student complaints', () => {
  test('a student can create a complaint', async () => {
    const { app } = buildTestApp();
    const { agent, user } = await registerStudent(app);
    const res = await agent.post('/api/complaints').send(validComplaint);

    expect(res.status).toBe(201);
    expect(res.body.complaint).toMatchObject({
      title: validComplaint.title,
      category: 'WIFI',
      location: 'Library, 2nd floor',
      status: 'PENDING',
      userId: user.userId,
    });
    expect(res.body.complaint.complaintId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.complaint.createdAt).toBeDefined();
  });

  test('the location is optional', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    const { location, ...withoutLocation } = validComplaint;
    const res = await agent.post('/api/complaints').send(withoutLocation);

    expect(res.status).toBe(201);
    expect(res.body.complaint.location).toBeNull();
  });

  test('the server ignores attempts to set status or owner on creation', async () => {
    const { app } = buildTestApp();
    const { agent, user } = await registerStudent(app);
    const res = await agent
      .post('/api/complaints')
      .send({ ...validComplaint, status: 'RESOLVED', userId: 'someone-else' });

    expect(res.status).toBe(201);
    expect(res.body.complaint.status).toBe('PENDING');
    expect(res.body.complaint.userId).toBe(user.userId);
  });

  test.each([
    [{ ...validComplaint, title: '' }, 'title'],
    [{ ...validComplaint, title: 'x'.repeat(121) }, 'title'],
    [{ ...validComplaint, description: 'too short' }, 'description'],
    [{ ...validComplaint, category: 'PARKING' }, 'category'],
    [{ ...validComplaint, location: 'x'.repeat(121) }, 'location'],
  ])('invalid complaint data is rejected (%#)', async (body, field) => {
    const { app, store } = buildTestApp();
    const { agent } = await registerStudent(app);
    const res = await agent.post('/api/complaints').send(body);

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(field);
    expect(await store.complaints.listAll()).toHaveLength(0);
  });

  test('creating a complaint without logging in returns 401', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/complaints').send(validComplaint);
    expect(res.status).toBe(401);
  });

  test('non-JSON request bodies are rejected', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    const res = await agent
      .post('/api/complaints')
      .type('form')
      .send('title=Hello&description=World');
    expect(res.status).toBe(415);
  });

  test('a student only sees their own complaints, newest first', async () => {
    const { app } = buildTestApp();
    const alice = await registerStudent(app, { email: 'alice@campus.edu' });
    const bob = await registerStudent(app, { email: 'bob@campus.edu' });

    await alice.agent.post('/api/complaints').send({ ...validComplaint, title: 'Alice first issue' });
    await new Promise((r) => setTimeout(r, 5));
    await alice.agent.post('/api/complaints').send({ ...validComplaint, title: 'Alice second issue' });
    await bob.agent.post('/api/complaints').send({ ...validComplaint, title: 'Bob private issue' });

    const res = await alice.agent.get('/api/complaints');
    expect(res.status).toBe(200);
    expect(res.body.complaints.map((c) => c.title)).toEqual([
      'Alice second issue',
      'Alice first issue',
    ]);
  });

  test('query parameters cannot be used to list another student\'s complaints', async () => {
    const { app } = buildTestApp();
    const alice = await registerStudent(app);
    const bob = await registerStudent(app);
    await bob.agent.post('/api/complaints').send(validComplaint);

    const res = await alice.agent.get(`/api/complaints?userId=${bob.user.userId}`);
    expect(res.status).toBe(200);
    expect(res.body.complaints).toHaveLength(0);
  });

  test('complaints can be filtered by category and status', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    await agent.post('/api/complaints').send(validComplaint);
    await agent.post('/api/complaints').send({ ...validComplaint, category: 'HOSTEL' });

    const byCategory = await agent.get('/api/complaints?category=hostel');
    expect(byCategory.body.complaints).toHaveLength(1);
    expect(byCategory.body.complaints[0].category).toBe('HOSTEL');

    const byStatus = await agent.get('/api/complaints?status=RESOLVED');
    expect(byStatus.body.complaints).toHaveLength(0);

    const invalid = await agent.get('/api/complaints?status=DONE');
    expect(invalid.status).toBe(400);
  });

  test('a student can view their own complaint by id', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    const created = await agent.post('/api/complaints').send(validComplaint);
    const id = created.body.complaint.complaintId;

    const res = await agent.get(`/api/complaints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.complaint.complaintId).toBe(id);
  });

  test('a student cannot view another student\'s complaint', async () => {
    const { app } = buildTestApp();
    const alice = await registerStudent(app);
    const bob = await registerStudent(app);
    const created = await bob.agent.post('/api/complaints').send(validComplaint);

    const res = await alice.agent.get(`/api/complaints/${created.body.complaint.complaintId}`);
    expect(res.status).toBe(404);
    expect(res.body.complaint).toBeUndefined();
  });

  test('a malformed complaint id is rejected', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    const res = await agent.get('/api/complaints/not-a-uuid');
    expect(res.status).toBe(400);
  });

  test('an administrator can view any complaint by id but cannot submit complaints', async () => {
    const { app, store } = buildTestApp();
    const student = await registerStudent(app);
    const created = await student.agent.post('/api/complaints').send(validComplaint);
    const admin = await loginAdmin(app, store);

    const view = await admin.agent.get(`/api/complaints/${created.body.complaint.complaintId}`);
    expect(view.status).toBe(200);

    const submit = await admin.agent.post('/api/complaints').send(validComplaint);
    expect(submit.status).toBe(403);
  });
});
