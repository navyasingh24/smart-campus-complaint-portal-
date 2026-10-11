// Authentication and authorization middleware.
//
// The JWT is stored in an httpOnly cookie, so JavaScript running in the
// browser (including any injected script) cannot read it. Every protected
// route uses requireAuth, and admin routes additionally use requireRole.

const jwt = require('jsonwebtoken');
const { AUTH_COOKIE_NAME } = require('../constants');
const { AppError } = require('../errors');

function createAuthMiddleware(config) {
  function requireAuth(req, res, next) {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      return next(new AppError(401, 'Authentication required'));
    }
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      req.user = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      return next();
    } catch {
      return next(new AppError(401, 'Your session is invalid or has expired. Please log in again.'));
    }
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return next(new AppError(403, 'You do not have permission to perform this action'));
      }
      return next();
    };
  }

  return { requireAuth, requireRole };
}

module.exports = { createAuthMiddleware };
