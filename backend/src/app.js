// Builds the Express application. It is created by a function (instead of at
// import time) so tests can create an app with an in-memory database.

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createAuthMiddleware } = require('./middleware/auth');
const { createRequestLogger } = require('./middleware/requestLogger');
const { notFoundHandler, createErrorHandler } = require('./middleware/errorHandler');
const { createHealthRouter } = require('./routes/health');
const { createAuthRouter } = require('./routes/auth');
const { createComplaintsRouter } = require('./routes/complaints');
const { createAdminRouter } = require('./routes/admin');
const { AppError } = require('./errors');

function createApp({ config, store, logger }) {
  const app = express();
  const auth = createAuthMiddleware(config);

  // Elastic Beanstalk puts nginx in front of the container. Trusting one
  // proxy hop gives the real client IP for rate limiting.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // Only upgrade requests to HTTPS when the site is actually served
          // over HTTPS; otherwise the HTTP-only demo URL would break.
          upgradeInsecureRequests: config.cookieSecure ? [] : null,
        },
      },
      strictTransportSecurity: config.cookieSecure,
    }),
  );

  // CORS: the React app is served from the same origin as the API, so by
  // default no cross-origin access is allowed at all. Extra origins can be
  // allowed explicitly with CORS_ORIGINS (comma-separated).
  app.use(
    '/api',
    cors({
      origin(origin, callback) {
        callback(null, Boolean(origin) && config.corsOrigins.includes(origin));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use(createRequestLogger(logger));

  // CSRF defence in depth (on top of SameSite=strict cookies): state-changing
  // API requests must be JSON. HTML forms on other sites cannot send JSON
  // without a CORS preflight, which is rejected above.
  app.use('/api', (req, res, next) => {
    const changesState = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (changesState && !req.is('application/json')) {
      return next(new AppError(415, 'Content-Type must be application/json'));
    }
    return next();
  });

  app.use('/api/health', createHealthRouter({ store, config, logger }));
  app.use('/api/auth', createAuthRouter({ store, config, logger, auth }));
  app.use('/api/complaints', createComplaintsRouter({ store, logger, auth }));
  app.use('/api/admin', createAdminRouter({ store, logger, auth }));
  app.use('/api', notFoundHandler);

  // In production the built React app is served by Express from ./public.
  const indexFile = path.join(config.staticDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    // Single-page app: any other GET returns index.html and React Router
    // shows the right page.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(indexFile);
    });
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp };
