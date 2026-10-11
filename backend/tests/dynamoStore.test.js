// Tests for the DynamoDB adapter. The AWS SDK client is replaced by a mock,
// so these tests check that the right DynamoDB requests are built without
// calling AWS (no cost, no credentials needed, no real data touched).

const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { createDynamoStore } = require('../src/db/dynamoStore');

const ddbMock = mockClient(DynamoDBDocumentClient);

function makeStore() {
  return createDynamoStore({
    client: new DynamoDBClient({ region: 'us-east-1' }),
    usersTable: 'test-users',
    complaintsTable: 'test-complaints',
  });
}

function conditionalCheckFailed() {
  const error = new Error('The conditional request failed');
  error.name = 'ConditionalCheckFailedException';
  return error;
}

beforeEach(() => ddbMock.reset());

describe('DynamoDB adapter', () => {
  test('creating a user uses a conditional put so emails stay unique', async () => {
    ddbMock.on(PutCommand).resolves({});
    await makeStore().users.create({ email: 'a@b.cd', userId: 'u1' });

    const call = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(call.TableName).toBe('test-users');
    expect(call.ConditionExpression).toBe('attribute_not_exists(email)');
  });

  test('a duplicate email is reported as a 409 conflict', async () => {
    ddbMock.on(PutCommand).rejects(conditionalCheckFailed());
    await expect(makeStore().users.create({ email: 'a@b.cd' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('finding a user is a key lookup by email', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { email: 'a@b.cd', userId: 'u1' } });
    const user = await makeStore().users.findByEmail('a@b.cd');

    expect(user.userId).toBe('u1');
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.Key).toEqual({ email: 'a@b.cd' });
  });

  test('a student\'s complaints are read with a Query on the user index, never a Scan', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ complaintId: 'c1' }] });
    const items = await makeStore().complaints.listByUser('u1', { category: 'WIFI' });

    expect(items).toEqual([{ complaintId: 'c1' }]);
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.IndexName).toBe('userId-createdAt-index');
    expect(input.ExpressionAttributeValues[':userId']).toBe('u1');
    expect(input.ScanIndexForward).toBe(false);
    expect(input.FilterExpression).toContain('#category = :category');
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(0);
  });

  test('query results are paginated using LastEvaluatedKey', async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ complaintId: 'c1' }], LastEvaluatedKey: { complaintId: 'c1' } })
      .resolvesOnce({ Items: [{ complaintId: 'c2' }] });
    const items = await makeStore().complaints.listByUser('u1');

    expect(items.map((i) => i.complaintId)).toEqual(['c1', 'c2']);
    expect(ddbMock.commandCalls(QueryCommand)[1].args[0].input.ExclusiveStartKey).toEqual({
      complaintId: 'c1',
    });
  });

  test('listing all complaints queries each status partition and merges newest first', async () => {
    ddbMock.on(QueryCommand).callsFake((input) => ({
      Items: [
        {
          complaintId: input.ExpressionAttributeValues[':status'],
          createdAt: { PENDING: '2026-01-02', IN_PROGRESS: '2026-01-03', RESOLVED: '2026-01-01' }[
            input.ExpressionAttributeValues[':status']
          ],
        },
      ],
    }));
    const items = await makeStore().complaints.listAll();

    const calls = ddbMock.commandCalls(QueryCommand).map((c) => c.args[0].input);
    expect(calls).toHaveLength(3);
    calls.forEach((input) => expect(input.IndexName).toBe('status-createdAt-index'));
    expect(items.map((i) => i.complaintId)).toEqual(['IN_PROGRESS', 'PENDING', 'RESOLVED']);
    expect(ddbMock.commandCalls(ScanCommand)).toHaveLength(0);
  });

  test('filtering by status queries only that partition', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    await makeStore().complaints.listAll({ status: 'RESOLVED' });

    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.ExpressionAttributeValues[':status']).toBe('RESOLVED');
  });

  test('status updates are conditional and return the updated item', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { complaintId: 'c1', status: 'RESOLVED' } });
    const updated = await makeStore().complaints.updateStatus('c1', {
      status: 'RESOLVED',
      adminNote: null,
      updatedBy: 'admin1',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(updated.status).toBe('RESOLVED');
    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(input.ConditionExpression).toBe('attribute_exists(complaintId)');
    expect(input.ExpressionAttributeNames).toEqual({ '#status': 'status' });
  });

  test('updating a complaint that does not exist returns null', async () => {
    ddbMock.on(UpdateCommand).rejects(conditionalCheckFailed());
    const result = await makeStore().complaints.updateStatus('missing', { status: 'RESOLVED' });
    expect(result).toBeNull();
  });

  test('statistics are counted from the status index with a small projection', async () => {
    ddbMock.on(QueryCommand).callsFake((input) =>
      input.ExpressionAttributeValues[':status'] === 'PENDING'
        ? { Items: [{ status: 'PENDING', category: 'WIFI' }, { status: 'PENDING', category: 'HOSTEL' }] }
        : { Items: [] },
    );
    const stats = await makeStore().complaints.getStats();

    expect(stats.total).toBe(2);
    expect(stats.byStatus.PENDING).toBe(2);
    expect(stats.byCategory.WIFI).toBe(1);
    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(input.ProjectionExpression).toBe('#status, #category');
  });

  test('ping performs a single key lookup', async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(makeStore().ping()).resolves.toBe(true);
    expect(ddbMock.commandCalls(GetCommand)[0].args[0].input.TableName).toBe('test-users');
  });
});
