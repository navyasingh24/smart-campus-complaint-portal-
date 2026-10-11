const { CATEGORIES, STATUSES } = require('../constants');

function newestFirst(a, b) {
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

function matchesFilters(item, { status, category } = {}) {
  if (status && item.status !== status) return false;
  if (category && item.category !== category) return false;
  return true;
}

function emptyStats() {
  return {
    total: 0,
    byStatus: Object.fromEntries(STATUSES.map((s) => [s, 0])),
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
  };
}

function addToStats(stats, item) {
  stats.total += 1;
  stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
  stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
}

module.exports = { newestFirst, matchesFilters, emptyStats, addToStats };
