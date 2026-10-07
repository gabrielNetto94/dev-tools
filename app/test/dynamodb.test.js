const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
} = require('@aws-sdk/client-dynamodb');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DYNAMO_HOST_ENDPOINT = process.env.TEST_DYNAMO_ENDPOINT || 'http://localhost:8000';

const api = (path, opts = {}) =>
  fetch(BASE_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

const ddbClient = new DynamoDBClient({
  endpoint: DYNAMO_HOST_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const TEST_TABLE = `test_vars_${Date.now()}`;

describe('DynamoDB API', () => {
  before(async () => {
    try {
      await ddbClient.send(
        new CreateTableCommand({
          TableName: TEST_TABLE,
          KeySchema: [
            { AttributeName: 'pk', KeyType: 'HASH' },
            { AttributeName: 'sk', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'pk', AttributeType: 'S' },
            { AttributeName: 'sk', AttributeType: 'S' },
          ],
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
    } catch (err) {
      console.warn('Could not create test DynamoDB table:', err.message);
    }
  });

  after(async () => {
    try {
      await ddbClient.send(new DeleteTableCommand({ TableName: TEST_TABLE }));
    } catch (_) {}
  });

  test('GET /api/dynamodb/config returns configuration info', async () => {
    const res = await api('/api/dynamodb/config');
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.defaultRegion === 'string');
    assert.ok('configuredViaEnv' in data);
    assert.ok('defaultEndpoint' in data);
  });

  test('POST /api/dynamodb/describe-table without tableName returns 400', async () => {
    const res = await api('/api/dynamodb/describe-table', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('POST /api/dynamodb/scan without tableName returns 400', async () => {
    const res = await api('/api/dynamodb/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('POST /api/dynamodb/item/put without item returns 400', async () => {
    const res = await api('/api/dynamodb/item/put', {
      method: 'POST',
      body: JSON.stringify({ tableName: 'test' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('POST /api/dynamodb/tables with unreachable endpoint returns 400', async () => {
    const res = await api('/api/dynamodb/tables', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: 'http://127.0.0.1:59999',
        region: 'us-east-1',
        accessKeyId: 'fake',
        secretAccessKey: 'fake',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('CRUD flow: list tables, describe, put item, scan, update variable, get, and delete', async () => {
    // 1. List tables
    const listRes = await api('/api/dynamodb/tables', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    assert.ok(listData.tables.includes(TEST_TABLE));

    // 2. Describe table schema
    const descRes = await api('/api/dynamodb/describe-table', {
      method: 'POST',
      body: JSON.stringify({ tableName: TEST_TABLE }),
    });
    assert.strictEqual(descRes.status, 200);
    const descData = await descRes.json();
    assert.strictEqual(descData.table.tableName, TEST_TABLE);
    assert.strictEqual(descData.table.keySchema.length, 2);

    // 3. Put item with variables
    const initialItem = {
      pk: 'config#env',
      sk: 'v1.0',
      APP_NAME: 'DBLab-Service',
      PORT: 8080,
      DEBUG: false,
      SETTINGS: { timeout: 30, retries: 3 },
    };
    const putRes = await api('/api/dynamodb/item/put', {
      method: 'POST',
      body: JSON.stringify({ tableName: TEST_TABLE, item: initialItem }),
    });
    assert.strictEqual(putRes.status, 200);

    // 4. Scan items
    const scanRes = await api('/api/dynamodb/scan', {
      method: 'POST',
      body: JSON.stringify({ tableName: TEST_TABLE }),
    });
    assert.strictEqual(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.strictEqual(scanData.count, 1);
    assert.strictEqual(scanData.items[0].APP_NAME, 'DBLab-Service');

    // 5. Update variables (PORT = 9000, DEBUG = true)
    const updatedItem = {
      ...initialItem,
      PORT: 9000,
      DEBUG: true,
      NEW_VAR: 'created_via_workbench',
    };
    const updateRes = await api('/api/dynamodb/item/put', {
      method: 'POST',
      body: JSON.stringify({ tableName: TEST_TABLE, item: updatedItem }),
    });
    assert.strictEqual(updateRes.status, 200);

    // 6. Get item by key
    const getRes = await api('/api/dynamodb/item/get', {
      method: 'POST',
      body: JSON.stringify({
        tableName: TEST_TABLE,
        key: { pk: 'config#env', sk: 'v1.0' },
      }),
    });
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.item.PORT, 9000);
    assert.strictEqual(getData.item.DEBUG, true);
    assert.strictEqual(getData.item.NEW_VAR, 'created_via_workbench');

    // 7. Delete item
    const delRes = await api('/api/dynamodb/item/delete', {
      method: 'POST',
      body: JSON.stringify({
        tableName: TEST_TABLE,
        key: { pk: 'config#env', sk: 'v1.0' },
      }),
    });
    assert.strictEqual(delRes.status, 200);

    // 8. Verify deletion with scan
    const scanAfter = await api('/api/dynamodb/scan', {
      method: 'POST',
      body: JSON.stringify({ tableName: TEST_TABLE }),
    });
    const scanAfterData = await scanAfter.json();
    assert.strictEqual(scanAfterData.count, 0);
  });
});
