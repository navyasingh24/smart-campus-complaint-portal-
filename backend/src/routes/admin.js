const express = require('express');
const { ROLES } = require('../constants');
const { NotFoundError } = require('../errors');
const { validateFilters, validateId, validateStatusUpdate } = require('../validation');

// Administrator routes. Every route requires a valid session AND the ADMIN
// role; the check happens here on the server, not only in the React UI.
function createAdminRouter({ store, logger, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth, auth.requireRole(ROLES.ADMIN));

  router.get('/complaints', async (req, res) => {
    const filters = validateFilters(req.query);
    const complaints = await store.complaints.listAll(filters);
    res.json({ complaints });
  });

  router.patch('/complaints/:id/status', async (req, res) => {
    const id = validateId(req.params.id);
    const { status, adminNote } = validateStatusUpdate(req.body);
    const updated = await store.complaints.updateStatus(id, {
      status,
      adminNote,
      updatedBy: req.user.userId,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new NotFoundError('Complaint not found');
    logger.info('complaint status updated', {
      complaintId: id,
      status,
      adminId: req.user.userId,
    });
    res.json({ complaint: updated });
  });

  router.get('/stats', async (req, res) => {
    const stats = await store.complaints.getStats();
    res.json({ stats });
  });

  return router;
}

module.exports = { createAdminRouter };
