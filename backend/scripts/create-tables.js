// Creates the DynamoDB tables if they do not already exist.
//
// Intended for DynamoDB Local (docker compose). On AWS the tables are created
// by infrastructure/cloudformation.yml, which is the recommended approach.

const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} = require('@aws-sdk/client-dynamodb');
const { loadConfig } = require('../src/config');
const { usersTableDefinition, complaintsTableDefinition } = require('../src/db/tableDefinitions');

async function ensureTable(client, definition) {
  try {
    await client.send(new DescribeTableCommand({ TableName: definition.TableName }));
    console.log(`Table ${definition.TableName} already exists`);
    return;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') throw error;
  }
  await client.send(new CreateTableCommand(definition));
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: definition.TableName });
  console.log(`Created table ${definition.TableName}`);
}

async function main() {
  const config = loadConfig({ ...process.env, JWT_SECRET: 'x'.repeat(32), DB_DRIVER: 'dynamodb' });
  const { region, endpoint, usersTable, complaintsTable } = config.db;
  const client = new DynamoDBClient({ region, endpoint });
  console.log(`Using DynamoDB endpoint: ${endpoint || `AWS (${region})`}`);
  await ensureTable(client, usersTableDefinition(usersTable));
  await ensureTable(client, complaintsTableDefinition(complaintsTable));
}

main().catch((error) => {
  console.error(`Failed to create tables: ${error.message}`);
  process.exit(1);
});
