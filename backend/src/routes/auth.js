const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { ROLES, AUTH_COOKIE_NAME } = require('../constants');
const { AppError } = require('../errors');
const { validateRegistration, validateLogin } = require('../validation');

const BCRYPT_ROUNDS = 10;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-protection', BCRYPT_ROUNDS);

function publicUser(user) {
  return { userId: user.userId, name: user.name, email: user.email, role: user.role };
}

function createAuthRouter({ store, config, logger, auth }) {
  const router = express.Router();

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  });

  function issueSessionCookie(res, user) {
    const token = jwt.sign(
      { email: user.email, name: user.name, role: user.role },
      config.jwtSecret,
      { subject: user.userId, expiresIn: config.jwtExpiresIn, algorithm: 'HS256' },
    );
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true, // not readable from JavaScript
      secure: config.cookieSecure, // HTTPS only when enabled
      sameSite: 'strict', // not sent on cross-site requests (CSRF protection)
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
  }

  router.post('/register', authLimiter, async (req, res) => {
    const { name, email, password } = validateRegistration(req.body);
    const now = new Date().toISOString();
    const user = {
      userId: crypto.randomUUID(),
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      // Self-registration always creates a student. Administrators are only
      // created with the scripts/create-admin.js command.
      role: ROLES.STUDENT,
      createdAt: now,
      updatedAt: now,
    };
    await store.users.create(user);
    logger.info('user registered', { userId: user.userId, role: user.role });
    issueSessionCookie(res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = validateLogin(req.body);
    const user = await store.users.findByEmail(email);
    const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !passwordOk) {
      logger.warn('failed login attempt', { requestId: req.requestId });
      // Same message for unknown email and wrong password.
      throw new AppError(401, 'Invalid email or password');
    }
    issueSessionCookie(res, user);
    logger.info('user logged in', { userId: user.userId, role: user.role });
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
    });
    res.json({ message: 'Logged out' });
  });

  router.get('/me', auth.requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}

module.exports = { createAuthRouter, publicUser, BCRYPT_ROUNDS };
