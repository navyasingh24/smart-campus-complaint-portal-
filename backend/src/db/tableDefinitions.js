// DynamoDB table definitions. These are used by scripts/create-tables.js for
// DynamoDB Local, and mirror infrastructure/cloudformation.yml for AWS.
//
// Users table
//   Partition key: email (string). Login looks users up by email, and a
//   conditional write on the key guarantees that emails are unique.
//
// Complaints table
//   Partition key: complaintId (string, UUID).
//   GSI userId-createdAt-index  (userId, createdAt): "my complaints", newest first.
//   GSI status-createdAt-index  (status, createdAt): admin views and statistics.

const USER_INDEX = 'userId-createdAt-index';
const STATUS_INDEX = 'status-createdAt-index';

function usersTableDefinition(tableName) {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
  };
}

function complaintsTableDefinition(tableName) {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'complaintId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'complaintId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: USER_INDEX,
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: STATUS_INDEX,
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  };
}

module.exports = { USER_INDEX, STATUS_INDEX, usersTableDefinition, complaintsTableDefinition };
