const crypto = require('node:crypto');

// Logs one line per API request (method, path, status code, duration and the
// authenticated user id). Request bodies are never logged, so passwords and
// complaint text do not end up in CloudWatch.
function createRequestLogger(logger) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    // Capture the path now: Express changes req.path inside mounted routers.
    const path = req.originalUrl.split('?')[0];
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);

    res.on('finish', () => {
      // Skip the frequent load-balancer/EB health probes to keep logs useful.
      if (path === '/api/health') return;
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level]('request completed', {
        requestId: req.requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 10) / 10,
        userId: req.user?.userId,
      });
    });
    next();
  };
}

module.exports = { createRequestLogger };
