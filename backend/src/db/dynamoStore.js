// Amazon DynamoDB database adapter (used on AWS and with DynamoDB Local).
//
// Design notes (see docs/DATABASE.md for the full explanation):
// * Every read used by the application is a GetItem or a Query on a key or
//   index. There are no full-table Scans.
// * Admin "all complaints" queries each of the three status partitions of
//   status-createdAt-index and merges the results, newest first.
// * Category filtering uses a FilterExpression on top of a Query. This is
//   simple and fine at campus scale; a dedicated category index would be the
//   next step if category filtering became the dominant access pattern.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { STATUSES } = require('../constants');
const { ConflictError } = require('../errors');
const { USER_INDEX, STATUS_INDEX } = require('./tableDefinitions');
const { newestFirst, emptyStats, addToStats } = require('./helpers');

// Safety limit so that a single request can never read an unbounded amount of
// data. Raise it (or add pagination to the UI) if the system grows.
const MAX_ITEMS_PER_QUERY = 1000;

function buildFilter(filters, { includeStatus }) {
  const parts = [];
  const names = {};
  const values = {};
  if (includeStatus && filters.status) {
    parts.push('#status = :statusFilter');
    names['#status'] = 'status';
    values[':statusFilter'] = filters.status;
  }
  if (filters.category) {
    parts.push('#category = :category');
    names['#category'] = 'category';
    values[':category'] = filters.category;
  }
  return { expression: parts.join(' AND '), names, values };
}

function createDynamoStore({ region, endpoint, usersTable, complaintsTable, client }) {
  const baseClient = client || new DynamoDBClient({ region, endpoint });
  const doc = DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  // Runs a Query and follows LastEvaluatedKey until all pages are read or
  // the safety limit is reached.
  async function queryAll(params) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const result = await doc.send(new QueryCommand({ ...params, ExclusiveStartKey }));
      items.push(...(result.Items || []));
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey && items.length < MAX_ITEMS_PER_QUERY);
    return items.slice(0, MAX_ITEMS_PER_QUERY);
  }

  async function queryStatusPartition(status, filters = {}, extra = {}) {
    const filter = buildFilter(filters, { includeStatus: false });
    return queryAll({
      TableName: complaintsTable,
      IndexName: STATUS_INDEX,
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status', ...filter.names, ...extra.names },
      ExpressionAttributeValues: { ':status': status, ...filter.values },
      ...(filter.expression ? { FilterExpression: filter.expression } : {}),
      ...(extra.projection ? { ProjectionExpression: extra.projection } : {}),
      ScanIndexForward: false,
    });
  }

  const users = {
    async findByEmail(email) {
      const result = await doc.send(new GetCommand({ TableName: usersTable, Key: { email } }));
      return result.Item || null;
    },
    async create(user) {
      try {
        await doc.send(
          new PutCommand({
            TableName: usersTable,
            Item: user,
            // Fails if the email is already registered: uniqueness is
            // enforced by the database, not just by application code.
            ConditionExpression: 'attribute_not_exists(email)',
          }),
        );
        return user;
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          throw new ConflictError('An account with this email already exists');
        }
        throw error;
      }
    },
  };

  const complaints = {
    async create(complaint) {
      await doc.send(
        new PutCommand({
          TableName: complaintsTable,
          Item: complaint,
          ConditionExpression: 'attribute_not_exists(complaintId)',
        }),
      );
      return complaint;
    },
    async getById(complaintId) {
      const result = await doc.send(
        new GetCommand({ TableName: complaintsTable, Key: { complaintId } }),
      );
      return result.Item || null;
    },
    async listByUser(userId, filters = {}) {
      const filter = buildFilter(filters, { includeStatus: true });
      return queryAll({
        TableName: complaintsTable,
        IndexName: USER_INDEX,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId, ...filter.values },
        ...(filter.expression
          ? { FilterExpression: filter.expression, ExpressionAttributeNames: filter.names }
          : {}),
        ScanIndexForward: false,
      });
    },
    async listAll(filters = {}) {
      const statuses = filters.status ? [filters.status] : STATUSES;
      const results = await Promise.all(statuses.map((s) => queryStatusPartition(s, filters)));
      return results.flat().sort(newestFirst);
    },
    async updateStatus(complaintId, { status, adminNote, updatedBy, updatedAt }) {
      try {
        const result = await doc.send(
          new UpdateCommand({
            TableName: complaintsTable,
            Key: { complaintId },
            UpdateExpression:
              'SET #status = :status, adminNote = :adminNote, updatedBy = :updatedBy, updatedAt = :updatedAt',
            ConditionExpression: 'attribute_exists(complaintId)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':status': status,
              ':adminNote': adminNote,
              ':updatedBy': updatedBy,
              ':updatedAt': updatedAt,
            },
            ReturnValues: 'ALL_NEW',
          }),
        );
        return result.Attributes;
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') return null;
        throw error;
      }
    },
    async getStats() {
      // Reads only the "status" and "category" attributes of each complaint
      // via the status index. See docs/DATABASE.md for how this would be
      // replaced by pre-computed counters at a much larger scale.
      const stats = emptyStats();
      const results = await Promise.all(
        STATUSES.map((s) =>
          queryStatusPartition(
            s,
            {},
            { projection: '#status, #category', names: { '#category': 'category' } },
          ),
        ),
      );
      results.flat().forEach((item) => addToStats(stats, item));
      return stats;
    },
  };

  return {
    driver: 'dynamodb',
    users,
    complaints,
    // Readiness check: a cheap single-item read proves that the table exists
    // and that the instance role has permission to use it.
    async ping() {
      await doc.send(
        new GetCommand({ TableName: usersTable, Key: { email: '__healthcheck__' } }),
      );
      return true;
    },
  };
}

module.exports = { createDynamoStore, MAX_ITEMS_PER_QUERY };
