const crypto = require('node:crypto');
const express = require('express');
const { ROLES } = require('../constants');
const { NotFoundError } = require('../errors');
const { validateComplaint, validateFilters, validateId } = require('../validation');

// Student-facing complaint routes. A student can only ever see their own
// complaints: the user id always comes from the verified token, never from
// the request, so it cannot be changed by the client.
function createComplaintsRouter({ store, logger, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  router.post('/', auth.requireRole(ROLES.STUDENT), async (req, res) => {
    const input = validateComplaint(req.body);
    const now = new Date().toISOString();
    const complaint = {
      complaintId: crypto.randomUUID(),
      userId: req.user.userId,
      studentName: req.user.name,
      studentEmail: req.user.email,
      ...input,
      status: 'PENDING',
      adminNote: null,
      createdAt: now,
      updatedAt: now,
    };
    await store.complaints.create(complaint);
    logger.info('complaint created', {
      complaintId: complaint.complaintId,
      userId: complaint.userId,
      category: complaint.category,
    });
    res.status(201).json({ complaint });
  });

  router.get('/', auth.requireRole(ROLES.STUDENT), async (req, res) => {
    const filters = validateFilters(req.query);
    const complaints = await store.complaints.listByUser(req.user.userId, filters);
    res.json({ complaints });
  });

  router.get('/:id', async (req, res) => {
    const id = validateId(req.params.id);
    const complaint = await store.complaints.getById(id);
    const canView =
      complaint && (req.user.role === ROLES.ADMIN || complaint.userId === req.user.userId);
    if (!canView) {
      // 404 (not 403) so students cannot discover which complaint ids exist.
      if (complaint) {
        logger.warn('blocked access to another user\'s complaint', {
          userId: req.user.userId,
          complaintId: id,
        });
      }
      throw new NotFoundError('Complaint not found');
    }
    res.json({ complaint });
  });

  return router;
}

module.exports = { createComplaintsRouter };
