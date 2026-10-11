const request = require('supertest');
const jwt = require('jsonwebtoken');
const { buildTestApp, registerStudent } = require('./helpers');

describe('Authentication', () => {
  test('a student can register and receives an httpOnly session cookie', async () => {
    const { app, store } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Patel', email: 'Asha@Campus.edu', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha Patel', email: 'asha@campus.edu', role: 'STUDENT' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^scc_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    // The password is stored hashed, never in plain text.
    const saved = await store.users.findByEmail('asha@campus.edu');
    expect(saved.passwordHash).toBeDefined();
    expect(saved.passwordHash).not.toContain('Password123');
  });

  test('registration cannot be used to create an administrator', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@campus.edu', password: 'Password123', role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('STUDENT');
  });

  test('registration rejects invalid input with field errors', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('name');
    expect(res.body.details).toHaveProperty('email');
    expect(res.body.details).toHaveProperty('password');
  });

  test('registration rejects a duplicate email', async () => {
    const { app } = buildTestApp();
    await registerStudent(app, { email: 'dup@campus.edu' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Second', email: 'dup@campus.edu', password: 'Password123' });

    expect(res.status).toBe(409);
  });

  test('login succeeds with correct credentials', async () => {
    const { app } = buildTestApp();
    await registerStudent(app, { email: 'login@campus.edu', password: 'Password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@campus.edu', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@campus.edu');
    expect(res.headers['set-cookie'][0]).toMatch(/^scc_token=/);
  });

  test('login fails with a wrong password', async () => {
    const { app } = buildTestApp();
    await registerStudent(app, { email: 'wrongpw@campus.edu' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpw@campus.edu', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('login fails for an unknown email with the same message', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@campus.edu', password: 'Password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  test('GET /api/auth/me returns the current user when logged in', async () => {
    const { app } = buildTestApp();
    const { agent, user } = await registerStudent(app);
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ userId: user.userId, role: 'STUDENT' });
  });

  test('GET /api/auth/me returns 401 without a session', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('a token signed with a different secret is rejected', async () => {
    const { app } = buildTestApp();
    const forged = jwt.sign({ role: 'ADMIN', email: 'x@y.z', name: 'X' }, 'attacker-secret', {
      subject: 'fake-user',
    });
    const res = await request(app).get('/api/admin/stats').set('Cookie', `scc_token=${forged}`);
    expect(res.status).toBe(401);
  });

  test('an expired token is rejected', async () => {
    const { app, config } = buildTestApp();
    const expired = jwt.sign({ role: 'STUDENT', email: 'x@y.z', name: 'X' }, config.jwtSecret, {
      subject: 'user-1',
      expiresIn: -10,
    });
    const res = await request(app).get('/api/auth/me').set('Cookie', `scc_token=${expired}`);
    expect(res.status).toBe(401);
  });

  test('logout clears the session cookie', async () => {
    const { app } = buildTestApp();
    const { agent } = await registerStudent(app);
    const res = await agent.post('/api/auth/logout').send({});

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/scc_token=;/);
    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  test('login is rate limited after too many attempts', async () => {
    const { app } = buildTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
    const attempt = () =>
      request(app).post('/api/auth/login').send({ email: 'a@b.cd', password: 'Password123' });
    await attempt();
    await attempt();
    await attempt();
    const res = await attempt();
    expect(res.status).toBe(429);
  });
});
