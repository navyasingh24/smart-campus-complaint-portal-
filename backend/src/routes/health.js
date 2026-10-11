const express = require('express');

function createHealthRouter({ store, config, logger }) {
  const router = express.Router();
  const startedAt = Date.now();

  // Liveness check used by Elastic Beanstalk and Docker. It does not touch
  // the database, so it is fast and cannot be throttled.
  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      version: config.appVersion,
      environment: config.nodeEnv,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness check used after each deployment: proves the app can reach
  // its database with the permissions it has been given.
  router.get('/ready', async (req, res) => {
    try {
      await store.ping();
      res.json({ status: 'ok', database: store.driver, version: config.appVersion });
    } catch (error) {
      logger.error('readiness check failed', { errorName: error.name, errorMessage: error.message });
      res.status(503).json({ status: 'unavailable', database: store.driver });
    }
  });

  return router;
}

module.exports = { createHealthRouter };
