const express = require('express');
const {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const router = express.Router();

/**
 * Creates DynamoDBClient and DynamoDBDocumentClient based on options
 * or defaults to server environment variables.
 */
function getClients(options = {}) {
  const region = (options.region || process.env.AWS_REGION || 'us-east-1').trim();
  let endpoint = (options.endpoint !== undefined ? options.endpoint : (process.env.DYNAMODB_ENDPOINT || '')).trim();
  if (!endpoint) endpoint = undefined;

  const accessKeyId = (options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const sessionToken = (options.sessionToken || process.env.AWS_SESSION_TOKEN || '').trim() || undefined;

  const clientConfig = {
    region,
    ...(endpoint ? { endpoint } : {}),
  };

  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  const client = new DynamoDBClient(clientConfig);
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });

  return { client, docClient };
}

// 1. Configuração padrão do servidor / status do ambiente
router.get('/config', (req, res) => {
  const envAccessKey = process.env.AWS_ACCESS_KEY_ID || '';
  const maskedAccessKey = envAccessKey
    ? (envAccessKey.length > 6
      ? `${envAccessKey.slice(0, 4)}...${envAccessKey.slice(-2)}`
      : '******')
    : null;

  res.json({
    success: true,
    configuredViaEnv: !!(envAccessKey && process.env.AWS_SECRET_ACCESS_KEY),
    defaultRegion: process.env.AWS_REGION || 'us-east-1',
    defaultEndpoint: process.env.DYNAMODB_ENDPOINT || '',
    maskedAccessKey,
    hasSessionToken: !!process.env.AWS_SESSION_TOKEN,
  });
});

// 2. Listar tabelas disponíveis
router.post('/tables', async (req, res) => {
  try {
    const { client } = getClients(req.body);
    const command = new ListTablesCommand({});
    const response = await client.send(command);

    res.json({
      success: true,
      tables: response.TableNames || [],
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Falha ao listar tabelas do DynamoDB: ${err.message}`,
    });
  }
});

// 3. Obter metadados e esquema da tabela (PK, SK, contagem, etc.)
router.post('/describe-table', async (req, res) => {
  const { tableName } = req.body;
  if (!tableName || typeof tableName !== 'string') {
    return res.status(400).json({ success: false, error: 'O parâmetro tableName é obrigatório.' });
  }

  try {
    const { client } = getClients(req.body);
    const command = new DescribeTableCommand({ TableName: tableName.trim() });
    const response = await client.send(command);
    const table = response.Table || {};

    const keySchema = (table.KeySchema || []).map((k) => ({
      attributeName: k.AttributeName,
      keyType: k.KeyType, // 'HASH' (Partition Key) ou 'RANGE' (Sort Key)
    }));

    const attributeDefinitions = (table.AttributeDefinitions || []).map((a) => ({
      attributeName: a.AttributeName,
      attributeType: a.AttributeType, // 'S', 'N', 'B'
    }));

    res.json({
      success: true,
      table: {
        tableName: table.TableName,
        itemCount: table.ItemCount || 0,
        tableSizeBytes: table.TableSizeBytes || 0,
        tableStatus: table.TableStatus,
        keySchema,
        attributeDefinitions,
        creationDateTime: table.CreationDateTime,
      },
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Erro ao descrever tabela '${tableName}': ${err.message}`,
    });
  }
});

// 4. Scan / Listar itens de uma tabela
router.post('/scan', async (req, res) => {
  const { tableName, limit, startKey } = req.body;
  if (!tableName || typeof tableName !== 'string') {
    return res.status(400).json({ success: false, error: 'O parâmetro tableName é obrigatório.' });
  }

  try {
    const { docClient } = getClients(req.body);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const scanParams = {
      TableName: tableName.trim(),
      Limit: parsedLimit,
    };

    if (startKey && typeof startKey === 'object') {
      scanParams.ExclusiveStartKey = startKey;
    }

    const command = new ScanCommand(scanParams);
    const response = await docClient.send(command);

    res.json({
      success: true,
      items: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey || null,
      count: response.Count || 0,
      scannedCount: response.ScannedCount || 0,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Erro ao escanear tabela '${tableName}': ${err.message}`,
    });
  }
});

// 5. Obter item específico por Primary Key
router.post('/item/get', async (req, res) => {
  const { tableName, key } = req.body;
  if (!tableName || !key || typeof key !== 'object') {
    return res.status(400).json({ success: false, error: 'Parâmetros tableName e key são obrigatórios.' });
  }

  try {
    const { docClient } = getClients(req.body);
    const command = new GetCommand({
      TableName: tableName.trim(),
      Key: key,
    });
    const response = await docClient.send(command);

    res.json({
      success: true,
      item: response.Item || null,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Erro ao buscar item: ${err.message}`,
    });
  }
});

// 6. Salvar ou atualizar item (todas as variáveis/atributos)
router.post('/item/put', async (req, res) => {
  const { tableName, item } = req.body;
  if (!tableName || !item || typeof item !== 'object') {
    return res.status(400).json({ success: false, error: 'Parâmetros tableName e item são obrigatórios.' });
  }

  try {
    const { docClient } = getClients(req.body);
    const command = new PutCommand({
      TableName: tableName.trim(),
      Item: item,
    });
    await docClient.send(command);

    res.json({
      success: true,
      message: 'Item e variáveis salvos com sucesso no DynamoDB.',
      item,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Erro ao salvar item no DynamoDB: ${err.message}`,
    });
  }
});

// 7. Excluir item por Primary Key
router.post('/item/delete', async (req, res) => {
  const { tableName, key } = req.body;
  if (!tableName || !key || typeof key !== 'object') {
    return res.status(400).json({ success: false, error: 'Parâmetros tableName e key são obrigatórios.' });
  }

  try {
    const { docClient } = getClients(req.body);
    const command = new DeleteCommand({
      TableName: tableName.trim(),
      Key: key,
    });
    await docClient.send(command);

    res.json({
      success: true,
      message: 'Item excluído com sucesso.',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: `Erro ao excluir item: ${err.message}`,
    });
  }
});

module.exports = router;
