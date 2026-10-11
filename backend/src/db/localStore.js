// Local development database adapter.
//
// It implements exactly the same interface as the DynamoDB adapter, so the
// rest of the application does not know which one it is using. Data is kept
// in memory and, when a file path is given, saved to a JSON file after every
// change so that it survives server restarts. Tests use it without a file so
// they never touch real data or AWS.

const fs = require('node:fs');
const path = require('node:path');
const { ConflictError } = require('../errors');
const { newestFirst, matchesFilters, emptyStats, addToStats } = require('./helpers');

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

function createLocalStore({ filePath } = {}) {
  let state = { users: {}, complaints: {} };

  if (filePath && fs.existsSync(filePath)) {
    state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  function persist() {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Write to a temporary file then rename, so a crash cannot leave a
    // half-written database file behind.
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, filePath);
  }

  const users = {
    async findByEmail(email) {
      return clone(state.users[email]) || null;
    },
    async create(user) {
      if (state.users[user.email]) {
        throw new ConflictError('An account with this email already exists');
      }
      state.users[user.email] = clone(user);
      persist();
      return clone(user);
    },
  };

  const complaints = {
    async create(complaint) {
      state.complaints[complaint.complaintId] = clone(complaint);
      persist();
      return clone(complaint);
    },
    async getById(complaintId) {
      return clone(state.complaints[complaintId]) || null;
    },
    async listByUser(userId, filters = {}) {
      return Object.values(state.complaints)
        .filter((c) => c.userId === userId && matchesFilters(c, filters))
        .sort(newestFirst)
        .map(clone);
    },
    async listAll(filters = {}) {
      return Object.values(state.complaints)
        .filter((c) => matchesFilters(c, filters))
        .sort(newestFirst)
        .map(clone);
    },
    async updateStatus(complaintId, { status, adminNote, updatedBy, updatedAt }) {
      const existing = state.complaints[complaintId];
      if (!existing) return null;
      Object.assign(existing, { status, adminNote, updatedBy, updatedAt });
      persist();
      return clone(existing);
    },
    async getStats() {
      const stats = emptyStats();
      Object.values(state.complaints).forEach((c) => addToStats(stats, c));
      return stats;
    },
  };

  return {
    driver: 'local',
    users,
    complaints,
    async ping() {
      return true;
    },
  };
}

module.exports = { createLocalStore };
