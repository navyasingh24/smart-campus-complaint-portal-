// Shared constants used across the API. Keeping them in one place means the
// validation rules, database queries and tests always agree.

const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  ADMIN: 'ADMIN',
});

const CATEGORIES = Object.freeze([
  'WIFI',
  'CLASSROOM',
  'HOSTEL',
  'ELECTRICITY',
  'SANITATION',
  'OTHER',
]);

const STATUSES = Object.freeze(['PENDING', 'IN_PROGRESS', 'RESOLVED']);

const AUTH_COOKIE_NAME = 'scc_token';

module.exports = { ROLES, CATEGORIES, STATUSES, AUTH_COOKIE_NAME };
