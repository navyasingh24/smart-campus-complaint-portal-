const request = require('supertest');
const { buildTestApp, registerStudent, loginAdmin, validComplaint } = require('./helpers');

async function setup() {
  const { app, store } = buildTestApp();
  const student = await registerStudent(app);
  const first = await student.agent.post('/api/complaints').send(validComplaint);
  const second = await student.agent
    .post('/api/complaints')
    .send({ ...validComplaint, title: 'Broken fan in hostel room', category: 'HOSTEL' });
  const admin = await loginAdmin(app, store);
  return {
    app,
    store,
    student,
    admin,
    complaintIds: [first.body.complaint.complaintId, second.body.complaint.complaintId],
  };
}

describe('Administrator operations', () => {
  test('students are forbidden from all admin endpoints', async () => {
    const { student, complaintIds } = await setup();

    expect((await student.agent.get('/api/admin/complaints')).status).toBe(403);
    expect((await student.agent.get('/api/admin/stats')).status).toBe(403);
    const update = await student.agent
      .patch(`/api/admin/complaints/${complaintIds[0]}/status`)
      .send({ status: 'RESOLVED' });
    expect(update.status).toBe(403);
  });

  test('anonymous users get 401 from admin endpoints', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/admin/complaints')).status).toBe(401);
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
  });

  test('an admin can list all complaints with student details', async () => {
    const { admin, student } = await setup();
    const other = await registerStudent(admin.agent.app);
    await other.agent.post('/api/complaints').send(validComplaint);

    const res = await admin.agent.get('/api/admin/complaints');
    expect(res.status).toBe(200);
    expect(res.body.complaints).toHaveLength(3);
    expect(res.body.complaints[0]).toHaveProperty('studentName');
    expect(res.body.complaints.some((c) => c.userId === student.user.userId)).toBe(true);
  });

  test('an admin can filter complaints by status and category', async () => {
    const { admin } = await setup();
    const hostel = await admin.agent.get('/api/admin/complaints?category=HOSTEL');
    expect(hostel.body.complaints).toHaveLength(1);

    const pending = await admin.agent.get('/api/admin/complaints?status=PENDING');
    expect(pending.body.complaints).toHaveLength(2);

    const resolved = await admin.agent.get('/api/admin/complaints?status=RESOLVED&category=WIFI');
    expect(resolved.body.complaints).toHaveLength(0);
  });

  test('an admin can update a complaint status and the student sees it', async () => {
    const { admin, student, complaintIds } = await setup();
    const res = await admin.agent
      .patch(`/api/admin/complaints/${complaintIds[0]}/status`)
      .send({ status: 'IN_PROGRESS', adminNote: 'Technician assigned' });

    expect(res.status).toBe(200);
    expect(res.body.complaint).toMatchObject({
      status: 'IN_PROGRESS',
      adminNote: 'Technician assigned',
      updatedBy: admin.user.userId,
    });
    expect(res.body.complaint.updatedAt >= res.body.complaint.createdAt).toBe(true);

    const studentView = await student.agent.get(`/api/complaints/${complaintIds[0]}`);
    expect(studentView.body.complaint.status).toBe('IN_PROGRESS');
  });

  test('an invalid status is rejected', async () => {
    const { admin, complaintIds } = await setup();
    const res = await admin.agent
      .patch(`/api/admin/complaints/${complaintIds[0]}/status`)
      .send({ status: 'CLOSED' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty('status');
  });

  test('updating a complaint that does not exist returns 404', async () => {
    const { admin } = await setup();
    const res = await admin.agent
      .patch('/api/admin/complaints/00000000-0000-4000-8000-000000000000/status')
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(404);
  });

  test('dashboard statistics reflect status changes', async () => {
    const { admin, complaintIds } = await setup();
    await admin.agent
      .patch(`/api/admin/complaints/${complaintIds[1]}/status`)
      .send({ status: 'RESOLVED' });

    const res = await admin.agent.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      total: 2,
      byStatus: { PENDING: 1, IN_PROGRESS: 0, RESOLVED: 1 },
      byCategory: { WIFI: 1, CLASSROOM: 0, HOSTEL: 1, ELECTRICITY: 0, SANITATION: 0, OTHER: 0 },
    });
  });
});
