const { createLocalStore } = require('./localStore');
const { createDynamoStore } = require('./dynamoStore');

function createStore(dbConfig) {
  if (dbConfig.driver === 'dynamodb') {
    return createDynamoStore(dbConfig);
  }
  return createLocalStore({ filePath: dbConfig.localFile || undefined });
}

module.exports = { createStore };
