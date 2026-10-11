// Input validation helpers. Every request body is validated on the server,
// even though the React forms also validate, because clients can be bypassed.

const { CATEGORIES, STATUSES } = require('./constants');
const { ValidationError } = require('./errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function throwIfErrors(errors) {
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}

function validateRegistration(body = {}) {
  const errors = {};
  const name = asTrimmedString(body.name);
  const email = asTrimmedString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 2 || name.length > 80) {
    errors.name = 'Name must be between 2 and 80 characters';
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = 'A valid email address is required';
  }
  if (password.length < 8 || password.length > 72) {
    // bcrypt only uses the first 72 bytes of a password.
    errors.password = 'Password must be between 8 and 72 characters';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password must contain at least one letter and one number';
  }

  throwIfErrors(errors);
  return { name, email, password };
}

function validateLogin(body = {}) {
  const errors = {};
  const email = asTrimmedString(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  throwIfErrors(errors);
  return { email, password };
}

function validateComplaint(body = {}) {
  const errors = {};
  const title = asTrimmedString(body.title);
  const description = asTrimmedString(body.description);
  const category = asTrimmedString(body.category).toUpperCase();
  const location = asTrimmedString(body.location);

  if (title.length < 5 || title.length > 120) {
    errors.title = 'Title must be between 5 and 120 characters';
  }
  if (description.length < 10 || description.length > 2000) {
    errors.description = 'Description must be between 10 and 2000 characters';
  }
  if (!CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }
  if (location.length > 120) {
    errors.location = 'Location must be at most 120 characters';
  }

  throwIfErrors(errors);
  return { title, description, category, location: location || null };
}

function validateStatusUpdate(body = {}) {
  const errors = {};
  const status = asTrimmedString(body.status).toUpperCase();
  const adminNote = asTrimmedString(body.adminNote);

  if (!STATUSES.includes(status)) {
    errors.status = `Status must be one of: ${STATUSES.join(', ')}`;
  }
  if (adminNote.length > 500) {
    errors.adminNote = 'Admin note must be at most 500 characters';
  }

  throwIfErrors(errors);
  return { status, adminNote: adminNote || null };
}

// Filters arrive as query-string values. Unknown values are rejected rather
// than silently ignored so that the UI and API stay consistent.
function validateFilters(query = {}) {
  const errors = {};
  const filters = {};
  const status = asTrimmedString(query.status).toUpperCase();
  const category = asTrimmedString(query.category).toUpperCase();

  if (status) {
    if (STATUSES.includes(status)) filters.status = status;
    else errors.status = `Status must be one of: ${STATUSES.join(', ')}`;
  }
  if (category) {
    if (CATEGORIES.includes(category)) filters.category = category;
    else errors.category = `Category must be one of: ${CATEGORIES.join(', ')}`;
  }

  throwIfErrors(errors);
  return filters;
}

function validateId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new ValidationError({ id: 'Invalid complaint id' });
  }
  return id;
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateComplaint,
  validateStatusUpdate,
  validateFilters,
  validateId,
};
