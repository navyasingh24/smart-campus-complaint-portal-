const { AppError } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// Converts errors into safe JSON responses. Expected errors (AppError) keep
// their message; anything else is logged in full on the server but the client
// only sees a generic message, so stack traces and secrets never leak.
function createErrorHandler(logger) {
  // Express recognises error handlers by their four arguments.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err instanceof AppError) {
      const body = { error: err.message };
      if (err.details) body.details = err.details;
      return res.status(err.statusCode).json(body);
    }

    // Malformed JSON body sent by the client.
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }

    logger.error('unhandled error', {
      requestId: req.requestId,
      path: req.originalUrl,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  };
}

module.exports = { notFoundHandler, createErrorHandler };
